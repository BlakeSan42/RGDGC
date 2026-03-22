"""
Public HTML page served when someone scans a disc QR code.

GET /disc/{disc_code} — Returns a styled, mobile-responsive HTML page showing:
    - Disc info (mold, color, manufacturer)
    - Owner display name (no email/phone)
    - "I Found This Disc" form
    - Deep link to RGDGC app
    - App download fallback
"""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.database import get_db
from app.services.disc_service import lookup_disc

router = APIRouter(tags=["public"])
limiter = Limiter(key_func=get_remote_address, enabled=get_settings().environment != "testing")

# RGDGC deep link scheme (configurable for prod vs dev)
APP_DEEP_LINK = "rgdgc://disc/{disc_code}"
APP_STORE_URL = "https://apps.apple.com/app/rgdgc"
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.rgdgc.app"
API_BASE = "/api/v1/discs"


def _render_disc_page(
    disc_code: str,
    mold: str,
    manufacturer: str | None,
    plastic: str | None,
    color: str | None,
    status: str,
    owner_name: str | None,
) -> str:
    """Render the public disc lookup HTML page with inline CSS."""

    status_badge_colors = {
        "active": ("#1B5E20", "#E8F5E9"),
        "lost": ("#B71C1C", "#FFEBEE"),
        "found": ("#E65100", "#FFF3E0"),
        "retired": ("#424242", "#F5F5F5"),
    }
    fg, bg = status_badge_colors.get(status, ("#424242", "#F5F5F5"))

    disc_description = mold
    if manufacturer:
        disc_description = f"{manufacturer} {mold}"
    if plastic:
        disc_description += f" ({plastic})"

    color_display = color or "—"
    owner_display = owner_name or "RGDGC Member"

    deep_link = APP_DEEP_LINK.format(disc_code=disc_code)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{disc_code} — RGDGC Disc</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #F5F5F5;
            color: #212121;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .header {{
            background: #1B5E20;
            color: white;
            width: 100%;
            padding: 20px 16px;
            text-align: center;
        }}
        .header h1 {{
            font-family: 'Poppins', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: 0.5px;
        }}
        .header .subtitle {{
            font-size: 0.85rem;
            opacity: 0.85;
            margin-top: 4px;
        }}
        .card {{
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 20px 16px;
            padding: 24px;
            width: 100%;
            max-width: 440px;
        }}
        .disc-code {{
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            font-size: 1.8rem;
            font-weight: 700;
            color: #1B5E20;
            text-align: center;
            margin-bottom: 16px;
        }}
        .status-badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: {bg};
            color: {fg};
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #EEEEEE;
            font-size: 0.95rem;
        }}
        .info-row:last-child {{ border-bottom: none; }}
        .info-label {{ color: #757575; font-weight: 500; }}
        .info-value {{ font-weight: 600; text-align: right; }}
        .center {{ text-align: center; }}
        .mt-12 {{ margin-top: 12px; }}
        .mt-20 {{ margin-top: 20px; }}

        .btn {{
            display: block;
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            margin-top: 12px;
            min-height: 44px;
        }}
        .btn-primary {{
            background: #FF6B35;
            color: white;
        }}
        .btn-primary:hover {{ background: #E55A25; }}
        .btn-secondary {{
            background: #1B5E20;
            color: white;
        }}
        .btn-secondary:hover {{ background: #145218; }}
        .btn-outline {{
            background: transparent;
            color: #1B5E20;
            border: 2px solid #1B5E20;
        }}
        .btn-outline:hover {{ background: #E8F5E9; }}

        .form-group {{
            margin-bottom: 14px;
        }}
        .form-group label {{
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: #424242;
            margin-bottom: 4px;
        }}
        .form-group input,
        .form-group textarea {{
            width: 100%;
            padding: 10px 12px;
            border: 1.5px solid #BDBDBD;
            border-radius: 6px;
            font-size: 0.95rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
        }}
        .form-group input:focus,
        .form-group textarea:focus {{
            border-color: #1B5E20;
        }}
        .form-group textarea {{ resize: vertical; min-height: 60px; }}

        .success-msg {{
            display: none;
            background: #E8F5E9;
            color: #1B5E20;
            padding: 14px;
            border-radius: 8px;
            text-align: center;
            font-weight: 600;
        }}
        .error-msg {{
            display: none;
            background: #FFEBEE;
            color: #B71C1C;
            padding: 14px;
            border-radius: 8px;
            text-align: center;
            font-weight: 600;
        }}

        .footer {{
            margin-top: auto;
            padding: 20px 16px;
            text-align: center;
            font-size: 0.8rem;
            color: #9E9E9E;
        }}
        .footer a {{ color: #1B5E20; text-decoration: none; }}
    </style>
</head>
<body>

<div class="header">
    <h1>River Grove Disc Golf Club</h1>
    <div class="subtitle">Registered Disc</div>
</div>

<div class="card">
    <div class="disc-code">{disc_code}</div>
    <div class="center mt-12">
        <span class="status-badge">{status}</span>
    </div>
    <div class="mt-20">
        <div class="info-row">
            <span class="info-label">Disc</span>
            <span class="info-value">{disc_description}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Color</span>
            <span class="info-value">{color_display}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Owner</span>
            <span class="info-value">{owner_display}</span>
        </div>
    </div>
    <a href="{deep_link}" class="btn btn-secondary mt-20">Contact Owner in App</a>
    <a href="{APP_STORE_URL}" class="btn btn-outline">Download RGDGC (iOS)</a>
    <a href="{PLAY_STORE_URL}" class="btn btn-outline">Download RGDGC (Android)</a>
</div>

<div class="card">
    <h2 style="font-size: 1.1rem; margin-bottom: 16px;">I Found This Disc</h2>
    <form id="found-form">
        <div class="form-group">
            <label for="finder_name">Your Name *</label>
            <input type="text" id="finder_name" name="finder_name" required maxlength="100">
        </div>
        <div class="form-group">
            <label for="finder_contact">Contact (phone, email, or social)</label>
            <input type="text" id="finder_contact" name="finder_contact" maxlength="200">
        </div>
        <div class="form-group">
            <label for="found_location">Where did you find it?</label>
            <input type="text" id="found_location" name="found_location" maxlength="300"
                   placeholder="e.g. Hole 7, left side of fairway">
        </div>
        <div class="form-group">
            <label for="message">Message for the owner</label>
            <textarea id="message" name="message" maxlength="1000"
                      placeholder="e.g. I'll leave it in the lost & found bin"></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Submit Found Report</button>
    </form>
    <div class="success-msg" id="success-msg">
        Thank you! The owner has been notified.
    </div>
    <div class="error-msg" id="error-msg">
        Something went wrong. Please try again.
    </div>
</div>

<div class="footer">
    <a href="https://rgdgc.com">rgdgc.com</a> &middot; Kingwood, TX
</div>

<script>
    document.getElementById('found-form').addEventListener('submit', async function(e) {{
        e.preventDefault();
        const form = e.target;
        const successMsg = document.getElementById('success-msg');
        const errorMsg = document.getElementById('error-msg');
        successMsg.style.display = 'none';
        errorMsg.style.display = 'none';

        const body = {{
            finder_name: form.finder_name.value.trim(),
            finder_contact: form.finder_contact.value.trim() || null,
            found_location: form.found_location.value.trim() || null,
            message: form.message.value.trim() || null,
        }};

        if (!body.finder_name) {{
            errorMsg.textContent = 'Please enter your name.';
            errorMsg.style.display = 'block';
            return;
        }}

        try {{
            const resp = await fetch('{API_BASE}/{disc_code}/found', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify(body),
            }});

            if (resp.ok) {{
                form.style.display = 'none';
                successMsg.style.display = 'block';
            }} else {{
                const data = await resp.json().catch(() => ({{}}));
                errorMsg.textContent = data.detail || 'Something went wrong. Please try again.';
                errorMsg.style.display = 'block';
            }}
        }} catch (err) {{
            errorMsg.textContent = 'Network error. Please check your connection.';
            errorMsg.style.display = 'block';
        }}
    }});
</script>

</body>
</html>"""


def _render_not_found_page(disc_code: str) -> str:
    """Render a 404 page for invalid disc codes."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Disc Not Found — RGDGC</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #F5F5F5;
            color: #212121;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
        }}
        h1 {{ color: #1B5E20; font-size: 1.5rem; margin-bottom: 12px; }}
        p {{ color: #757575; font-size: 1rem; margin-bottom: 24px; }}
        .code {{ font-family: monospace; font-size: 1.2rem; color: #B71C1C; }}
        a {{
            display: inline-block;
            padding: 12px 24px;
            background: #1B5E20;
            color: white;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    <h1>Disc Not Found</h1>
    <p>No disc is registered with code <span class="code">{disc_code}</span>.</p>
    <a href="https://rgdgc.com">Visit RGDGC</a>
</body>
</html>"""


@router.get("/disc/{disc_code}", response_class=HTMLResponse)
@limiter.limit("60/minute")
async def public_disc_page(
    disc_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public HTML page served when someone scans a disc's QR code.
    No authentication required. Shows disc info and a found-report form.
    """
    disc = await lookup_disc(db, disc_code)

    if disc is None:
        return HTMLResponse(
            content=_render_not_found_page(disc_code),
            status_code=404,
        )

    owner = disc.owner
    owner_name = (owner.display_name or owner.username) if owner else None

    return HTMLResponse(
        content=_render_disc_page(
            disc_code=disc.disc_code,
            mold=disc.mold,
            manufacturer=disc.manufacturer,
            plastic=disc.plastic,
            color=disc.color,
            status=disc.status,
            owner_name=owner_name,
        )
    )
