"""
Image processing tasks — offloaded to Celery so uploads return immediately.

All tasks are idempotent: re-processing an image overwrites the previous result.
"""

import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


def _get_sync_db():
    """Create a synchronous SQLAlchemy session for Celery tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.config import get_settings

    settings = get_settings()
    sync_url = settings.database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url)
    return engine, Session(engine)


@celery_app.task(
    bind=True,
    name="process_avatar_upload",
    max_retries=3,
    default_retry_delay=30,
)
def process_avatar_upload(self, user_id: int, file_url: str) -> dict:
    """Resize and optimize avatar image after upload.

    Generates three sizes:
      - thumb: 64x64 (for lists, chat)
      - medium: 200x200 (for profile cards)
      - original: preserved but compressed

    Stores results back via the storage service and updates the user record.
    """
    try:
        from io import BytesIO

        import httpx
        from PIL import Image

        SIZES = {
            "thumb": (64, 64),
            "medium": (200, 200),
        }

        # Download the original image
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(file_url)
            resp.raise_for_status()
            image_data = resp.content

        img = Image.open(BytesIO(image_data))

        # Convert RGBA to RGB for JPEG output
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        results = {}

        for size_name, dimensions in SIZES.items():
            resized = img.copy()
            resized.thumbnail(dimensions, Image.Resampling.LANCZOS)

            buffer = BytesIO()
            resized.save(buffer, format="JPEG", quality=85, optimize=True)
            buffer.seek(0)

            # TODO: Upload buffer to S3/R2 storage
            # For now, log the operation
            results[size_name] = {
                "width": resized.width,
                "height": resized.height,
                "size_bytes": buffer.tell(),
            }

        # Update user record with avatar URLs
        engine, db = _get_sync_db()
        try:
            from sqlalchemy import text

            # TODO: Set actual URLs once storage upload is implemented
            db.execute(
                text("UPDATE users SET updated_at = NOW() WHERE id = :user_id"),
                {"user_id": user_id},
            )
            db.commit()
        finally:
            db.close()
            engine.dispose()

        logger.info("Processed avatar for user %d: %s", user_id, results)
        return {"user_id": user_id, "sizes": results}

    except ImportError:
        logger.error(
            "Pillow not installed — cannot process images. "
            "Add 'Pillow>=10.0.0' to requirements.txt"
        )
        return {"error": "Pillow not installed"}
    except Exception as exc:
        logger.exception("Error processing avatar for user %d", user_id)
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="generate_scorecard_image",
    max_retries=2,
    default_retry_delay=60,
)
def generate_scorecard_image(self, round_id: int) -> dict:
    """Generate a shareable scorecard image for social sharing.

    Creates a styled PNG scorecard showing:
      - Player name and date
      - Course/layout name
      - Hole-by-hole scores with color coding
      - Total score relative to par
      - RGDGC branding
    """
    try:
        from io import BytesIO

        from PIL import Image, ImageDraw, ImageFont

        engine, db = _get_sync_db()
        try:
            from sqlalchemy import text

            # Fetch round data
            round_data = db.execute(
                text("""
                    SELECT r.id, r.total_score, r.total_strokes, r.completed_at,
                           u.username, l.name as layout_name, c.name as course_name,
                           l.total_par
                    FROM rounds r
                    JOIN users u ON u.id = r.user_id
                    JOIN layouts l ON l.id = r.layout_id
                    JOIN courses c ON c.id = l.course_id
                    WHERE r.id = :round_id
                """),
                {"round_id": round_id},
            ).fetchone()

            if not round_data:
                logger.warning("Round %d not found for scorecard generation", round_id)
                return {"error": "Round not found"}

            (
                _, total_score, total_strokes, completed_at,
                username, layout_name, course_name, total_par,
            ) = round_data

            # Fetch hole scores
            hole_scores = db.execute(
                text("""
                    SELECT h.hole_number, h.par, hs.strokes
                    FROM hole_scores hs
                    JOIN holes h ON h.id = hs.hole_id
                    WHERE hs.round_id = :round_id
                    ORDER BY h.hole_number
                """),
                {"round_id": round_id},
            ).fetchall()
        finally:
            db.close()
            engine.dispose()

        # Design system colors
        COLORS = {
            "bg": (255, 255, 255),
            "text": (33, 33, 33),
            "eagle": (123, 31, 162),      # #7B1FA2
            "birdie": (27, 94, 32),       # #1B5E20
            "par": (66, 66, 66),          # #424242
            "bogey": (230, 81, 0),        # #E65100
            "double_plus": (183, 28, 28), # #B71C1C
            "brand": (27, 94, 32),        # Forest Green
            "accent": (255, 107, 53),     # Disc Orange
        }

        # Create image (600x400 for social sharing)
        width, height = 600, 400
        img = Image.new("RGB", (width, height), COLORS["bg"])
        draw = ImageDraw.Draw(img)

        # Use default font (Pillow built-in)
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
            font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
            font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        except (OSError, IOError):
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Header bar
        draw.rectangle([(0, 0), (width, 60)], fill=COLORS["brand"])
        draw.text((20, 15), f"RGDGC — {course_name}", fill=(255, 255, 255), font=font_large)

        # Player info
        score_display = f"{total_score:+d}" if total_score != 0 else "E"
        draw.text((20, 75), f"{username}  •  {layout_name}", fill=COLORS["text"], font=font_medium)
        draw.text((20, 100), f"Score: {score_display} ({total_strokes} strokes)", fill=COLORS["text"], font=font_medium)

        # Hole scores grid
        y_start = 140
        col_width = 30
        x_start = 20

        for i, (hole_num, par, strokes) in enumerate(hole_scores):
            x = x_start + (i % 18) * col_width
            y = y_start + (i // 18) * 80

            # Hole number
            draw.text((x + 5, y), str(hole_num), fill=COLORS["text"], font=font_small)

            # Score with color coding
            diff = strokes - par
            if diff <= -2:
                color = COLORS["eagle"]
            elif diff == -1:
                color = COLORS["birdie"]
            elif diff == 0:
                color = COLORS["par"]
            elif diff == 1:
                color = COLORS["bogey"]
            else:
                color = COLORS["double_plus"]

            draw.text((x + 5, y + 18), str(strokes), fill=color, font=font_medium)
            draw.text((x + 5, y + 40), f"({par})", fill=COLORS["par"], font=font_small)

        # Footer
        draw.rectangle([(0, height - 30), (width, height)], fill=COLORS["brand"])
        draw.text((20, height - 24), "River Grove Disc Golf Club", fill=(255, 255, 255), font=font_small)

        # Save to buffer
        buffer = BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        buffer.seek(0)

        # TODO: Upload to S3/R2 and store URL in rounds table
        size_bytes = buffer.tell()

        logger.info(
            "Generated scorecard for round %d (%s at %s): %d bytes",
            round_id, username, course_name, size_bytes,
        )
        return {
            "round_id": round_id,
            "size_bytes": size_bytes,
            "width": width,
            "height": height,
        }

    except ImportError:
        logger.error(
            "Pillow not installed — cannot generate scorecards. "
            "Add 'Pillow>=10.0.0' to requirements.txt"
        )
        return {"error": "Pillow not installed"}
    except Exception as exc:
        logger.exception("Error generating scorecard for round %d", round_id)
        raise self.retry(exc=exc)
