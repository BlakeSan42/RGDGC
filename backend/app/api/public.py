"""
Public HTML page served when someone scans a disc QR code.

GET /disc/{disc_code} — Returns a styled, mobile-responsive HTML page showing:
    - Disc info (mold, color, manufacturer)
    - Owner display name (no email/phone)
    - "I Found This Disc" form
    - Deep link to RGDGC app
    - App download fallback
"""

from html import escape as html_escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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

    # XSS protection: escape all user-controlled values before HTML rendering
    disc_code = html_escape(disc_code)
    mold = html_escape(mold or "")
    manufacturer = html_escape(manufacturer or "")
    plastic = html_escape(plastic or "")
    color = html_escape(color or "")
    status = html_escape(status or "")
    owner_name = html_escape(owner_name or "")

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


# ---------------------------------------------------------------------------
# Public Scorecard Page
# ---------------------------------------------------------------------------


def _score_color(diff: int) -> str:
    """Return CSS color for a score relative to par."""
    if diff <= -2:
        return "#7B1FA2"  # Eagle or better — purple
    if diff == -1:
        return "#1B5E20"  # Birdie — green
    if diff == 0:
        return "#424242"  # Par — gray
    if diff == 1:
        return "#E65100"  # Bogey — orange
    return "#B71C1C"  # Double bogey+ — red


def _score_bg(diff: int) -> str:
    """Return light background for a score cell."""
    if diff <= -2:
        return "#F3E5F5"
    if diff == -1:
        return "#E8F5E9"
    if diff == 0:
        return "#F5F5F5"
    if diff == 1:
        return "#FFF3E0"
    return "#FFEBEE"


def _render_scorecard_page(
    player_name: str,
    course_name: str,
    layout_name: str,
    date_str: str,
    total_strokes: int,
    total_score: int,
    holes_data: list[dict],
    breakdown: dict,
) -> str:
    """Render the public scorecard HTML page with inline CSS."""

    # XSS protection
    player_name = html_escape(player_name or "Player")
    course_name = html_escape(course_name or "Course")
    layout_name = html_escape(layout_name or "Layout")
    date_str = html_escape(date_str or "")

    score_display = f"{total_score:+d}" if total_score != 0 else "E"

    # Build hole rows
    hole_rows = ""
    for h in holes_data:
        diff = h["strokes"] - h["par"]
        color = _score_color(diff)
        bg = _score_bg(diff)
        hole_rows += f"""
        <div class="score-row">
            <span class="hole-num">{h["hole_number"]}</span>
            <span class="hole-par">{h["par"]}</span>
            <span class="hole-dist">{h["distance"] or "—"}</span>
            <span class="hole-score" style="background:{bg};color:{color};">{h["strokes"]}</span>
        </div>"""

    # Breakdown badges
    breakdown_html = ""
    labels = [
        ("Eagles", breakdown.get("eagles", 0), "#7B1FA2", "#F3E5F5"),
        ("Birdies", breakdown.get("birdies", 0), "#1B5E20", "#E8F5E9"),
        ("Pars", breakdown.get("pars", 0), "#424242", "#F5F5F5"),
        ("Bogeys", breakdown.get("bogeys", 0), "#E65100", "#FFF3E0"),
        ("Doubles+", breakdown.get("doubles", 0) + breakdown.get("others", 0), "#B71C1C", "#FFEBEE"),
    ]
    for label, count, fg, bg in labels:
        if count > 0:
            breakdown_html += (
                f'<span class="breakdown-badge" style="background:{bg};color:{fg};">'
                f'{count} {label}</span> '
            )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scorecard — {player_name} — RGDGC</title>
    <meta property="og:title" content="{player_name} shot {score_display} at {course_name}">
    <meta property="og:description" content="{layout_name} layout — {total_strokes} strokes — RGDGC">
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
            max-width: 480px;
        }}
        .player-name {{
            font-family: 'Poppins', sans-serif;
            font-size: 1.4rem;
            font-weight: 700;
            color: #1B5E20;
            text-align: center;
        }}
        .round-meta {{
            text-align: center;
            color: #757575;
            font-size: 0.9rem;
            margin-top: 4px;
        }}
        .total-score {{
            text-align: center;
            margin: 16px 0;
        }}
        .total-score .big {{
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            font-size: 2.4rem;
            font-weight: 700;
            color: #1B5E20;
        }}
        .total-score .label {{
            font-size: 0.85rem;
            color: #757575;
            display: block;
            margin-top: 2px;
        }}
        .breakdown {{
            text-align: center;
            margin-bottom: 16px;
        }}
        .breakdown-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
            margin: 2px;
        }}
        .score-header, .score-row {{
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #EEEEEE;
            font-size: 0.9rem;
        }}
        .score-header {{
            font-weight: 600;
            color: #757575;
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .score-row:last-child {{ border-bottom: none; }}
        .hole-num {{ width: 40px; text-align: center; font-weight: 600; }}
        .hole-par {{ width: 40px; text-align: center; color: #757575; }}
        .hole-dist {{ flex: 1; text-align: center; color: #9E9E9E; font-size: 0.85rem; }}
        .hole-score {{
            width: 44px;
            text-align: center;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 1rem;
            border-radius: 6px;
            padding: 4px 0;
        }}
        .footer {{
            margin-top: auto;
            padding: 20px 16px;
            text-align: center;
            font-size: 0.8rem;
            color: #9E9E9E;
        }}
        .footer a {{ color: #1B5E20; text-decoration: none; }}
        .app-link {{
            display: block;
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            background: #FF6B35;
            color: white;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
        }}
        .app-link:hover {{ background: #E55A25; }}
    </style>
</head>
<body>

<div class="header">
    <h1>River Grove Disc Golf Club</h1>
    <div class="subtitle">Scorecard</div>
</div>

<div class="card">
    <div class="player-name">{player_name}</div>
    <div class="round-meta">{course_name} &mdash; {layout_name} &mdash; {date_str}</div>
    <div class="total-score">
        <span class="big">{score_display}</span>
        <span class="label">{total_strokes} strokes</span>
    </div>
    <div class="breakdown">{breakdown_html}</div>
    <div class="score-header">
        <span class="hole-num">Hole</span>
        <span class="hole-par">Par</span>
        <span class="hole-dist">Dist</span>
        <span class="hole-score">Score</span>
    </div>
    {hole_rows}
    <a href="https://rgdgc.com" class="app-link">Join RGDGC</a>
</div>

<div class="footer">
    <a href="https://rgdgc.com">rgdgc.com</a> &middot; River Grove, IL
</div>

</body>
</html>"""


def _render_scorecard_not_found(share_code: str) -> str:
    """Render a 404 page for invalid share codes."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scorecard Not Found — RGDGC</title>
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
    <h1>Scorecard Not Found</h1>
    <p>No scorecard found for code <span class="code">{share_code}</span>.</p>
    <a href="https://rgdgc.com">Visit RGDGC</a>
</body>
</html>"""


@router.get("/round/{share_code}", response_class=HTMLResponse)
@limiter.limit("60/minute")
async def public_scorecard(
    share_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public HTML scorecard page for sharing.
    No authentication required. Displays hole-by-hole scores with par comparison.
    """
    from app.models.round import Round
    from app.models.course import Hole, Layout, Course

    result = await db.execute(
        select(Round)
        .where(Round.share_code == share_code)
        .options(selectinload(Round.scores), selectinload(Round.user), selectinload(Round.layout))
    )
    round_ = result.scalar_one_or_none()

    if round_ is None or round_.completed_at is None:
        return HTMLResponse(
            content=_render_scorecard_not_found(share_code),
            status_code=404,
        )

    # Get course name via layout
    layout = round_.layout
    course_result = await db.execute(select(Course).where(Course.id == layout.course_id))
    course = course_result.scalar_one_or_none()
    course_name = course.name if course else "Unknown Course"

    # Get hole details for this layout
    holes_result = await db.execute(
        select(Hole).where(Hole.layout_id == layout.id).order_by(Hole.hole_number)
    )
    holes_by_id = {h.id: h for h in holes_result.scalars().all()}

    # Build holes data sorted by hole number
    holes_data = []
    eagles = birdies = pars = bogeys = doubles = others = 0
    for s in round_.scores:
        hole = holes_by_id.get(s.hole_id)
        if not hole:
            continue
        par = hole.par
        diff = s.strokes - par
        if diff <= -2:
            eagles += 1
        elif diff == -1:
            birdies += 1
        elif diff == 0:
            pars += 1
        elif diff == 1:
            bogeys += 1
        elif diff == 2:
            doubles += 1
        else:
            others += 1
        holes_data.append({
            "hole_number": hole.hole_number,
            "par": par,
            "distance": hole.distance,
            "strokes": s.strokes,
        })
    holes_data.sort(key=lambda h: h["hole_number"])

    player = round_.user
    player_name = player.display_name or player.username
    date_str = round_.completed_at.strftime("%b %d, %Y")

    breakdown = {
        "eagles": eagles,
        "birdies": birdies,
        "pars": pars,
        "bogeys": bogeys,
        "doubles": doubles,
        "others": others,
    }

    return HTMLResponse(
        content=_render_scorecard_page(
            player_name=player_name,
            course_name=course_name,
            layout_name=layout.name,
            date_str=date_str,
            total_strokes=round_.total_strokes,
            total_score=round_.total_score,
            holes_data=holes_data,
            breakdown=breakdown,
        )
    )
