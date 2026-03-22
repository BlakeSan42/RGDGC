"""
Business logic for disc registration, QR code generation, and lost/found workflow.

Disc codes follow the format RGDG-XXXX where XXXX is a zero-padded sequential number.
QR codes point to disc.rgdgc.com/{disc_code} for public lookup pages.
"""

import io
import random
import string
from datetime import datetime, timezone

import qrcode
import qrcode.image.svg
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.disc import DiscFoundReport, DiscMessage, RegisteredDisc
from app.models.user import User
from app.schemas.disc import DiscFoundCreate, DiscMessageCreate, DiscRegister

# Base URL for public disc lookup pages
DISC_BASE_URL = "https://disc.rgdgc.com"


async def generate_disc_code(db: AsyncSession) -> str:
    """
    Generate a unique disc code in the format RGDG-XXXX.

    Uses the next sequential number based on existing disc count,
    with a collision check and fallback to random suffix.
    """
    # Get current max numeric suffix
    result = await db.execute(
        select(func.count(RegisteredDisc.id))
    )
    count = result.scalar() or 0
    next_num = count + 1

    # Try sequential code first
    code = f"RGDG-{next_num:04d}"
    existing = await db.execute(
        select(RegisteredDisc.id).where(RegisteredDisc.disc_code == code)
    )
    if existing.scalar_one_or_none() is None:
        return code

    # Fallback: random alphanumeric suffix if collision
    for _ in range(100):
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        code = f"RGDG-{suffix}"
        existing = await db.execute(
            select(RegisteredDisc.id).where(RegisteredDisc.disc_code == code)
        )
        if existing.scalar_one_or_none() is None:
            return code

    raise RuntimeError("Failed to generate a unique disc code after 100 attempts")


def generate_qr_svg(disc_code: str, base_url: str = DISC_BASE_URL) -> str:
    """
    Generate a QR code as an SVG string that points to the disc's public page.

    Args:
        disc_code: The disc's unique code (e.g. RGDG-0042).
        base_url: Base URL for the disc lookup page.

    Returns:
        SVG markup as a string.
    """
    url = f"{base_url}/{disc_code}"

    qr = qrcode.QRCode(
        version=None,  # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    factory = qrcode.image.svg.SvgPathImage
    img = qr.make_image(image_factory=factory)

    buffer = io.BytesIO()
    img.save(buffer)
    return buffer.getvalue().decode("utf-8")


async def register_disc(
    db: AsyncSession, user_id: int, data: DiscRegister
) -> RegisteredDisc:
    """
    Register a new disc for a player and generate its unique code.

    Args:
        db: Database session.
        user_id: ID of the registering player.
        data: Disc registration input data.

    Returns:
        The newly created RegisteredDisc instance.
    """
    disc_code = await generate_disc_code(db)

    disc = RegisteredDisc(
        disc_code=disc_code,
        owner_id=user_id,
        manufacturer=data.manufacturer,
        mold=data.mold,
        plastic=data.plastic,
        weight_grams=data.weight_grams,
        color=data.color,
        notes=data.notes,
        status="active",
    )
    db.add(disc)
    await db.flush()
    await db.refresh(disc)
    return disc


async def get_user_discs(db: AsyncSession, user_id: int) -> list[RegisteredDisc]:
    """Get all discs registered to a player, ordered by registration date."""
    result = await db.execute(
        select(RegisteredDisc)
        .where(RegisteredDisc.owner_id == user_id)
        .order_by(RegisteredDisc.registered_at.desc())
    )
    return list(result.scalars().all())


async def lookup_disc(db: AsyncSession, disc_code: str) -> RegisteredDisc | None:
    """
    Look up a disc by its code. Used for QR scan lookups.

    Eagerly loads the owner relationship for display name access.
    """
    result = await db.execute(
        select(RegisteredDisc)
        .options(selectinload(RegisteredDisc.owner))
        .where(RegisteredDisc.disc_code == disc_code)
    )
    return result.scalar_one_or_none()


async def get_disc_by_code(db: AsyncSession, disc_code: str) -> RegisteredDisc | None:
    """Get a disc by its code without loading relationships."""
    result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.disc_code == disc_code)
    )
    return result.scalar_one_or_none()


async def report_found(
    db: AsyncSession,
    disc_code: str,
    data: DiscFoundCreate,
    finder_user_id: int | None = None,
) -> DiscFoundReport:
    """
    Create a found-disc report and update the disc status to 'found'.

    Args:
        db: Database session.
        disc_code: The disc's unique code.
        data: Found report input data.
        finder_user_id: Optional user ID if finder is a registered player.

    Returns:
        The created DiscFoundReport.

    Raises:
        ValueError: If disc_code does not match any registered disc.
    """
    disc = await get_disc_by_code(db, disc_code)
    if disc is None:
        raise ValueError(f"No disc found with code {disc_code}")

    report = DiscFoundReport(
        disc_id=disc.id,
        finder_user_id=finder_user_id,
        finder_name=data.finder_name,
        finder_contact=data.finder_contact,
        found_location=data.found_location,
        found_lat=data.found_lat,
        found_lng=data.found_lng,
        message=data.message,
    )
    db.add(report)

    # Update disc status
    disc.status = "found"
    await db.flush()
    await db.refresh(report)
    return report


async def report_lost(db: AsyncSession, disc_code: str, user_id: int) -> RegisteredDisc:
    """
    Mark a disc as lost. Only the owner can do this.

    Raises:
        ValueError: If disc not found.
        PermissionError: If user is not the disc owner.
    """
    disc = await get_disc_by_code(db, disc_code)
    if disc is None:
        raise ValueError(f"No disc found with code {disc_code}")
    if disc.owner_id != user_id:
        raise PermissionError("Only the disc owner can mark it as lost")

    disc.status = "lost"
    await db.flush()
    await db.refresh(disc)
    return disc


async def confirm_returned(db: AsyncSession, disc_code: str, user_id: int) -> RegisteredDisc:
    """
    Confirm a disc has been returned to the owner. Resolves all open found reports.

    Raises:
        ValueError: If disc not found.
        PermissionError: If user is not the disc owner.
    """
    disc = await get_disc_by_code(db, disc_code)
    if disc is None:
        raise ValueError(f"No disc found with code {disc_code}")
    if disc.owner_id != user_id:
        raise PermissionError("Only the disc owner can confirm return")

    disc.status = "active"

    # Resolve all open found reports
    result = await db.execute(
        select(DiscFoundReport).where(
            DiscFoundReport.disc_id == disc.id,
            DiscFoundReport.resolved.is_(False),
        )
    )
    now = datetime.now(timezone.utc)
    for report in result.scalars().all():
        report.resolved = True
        report.resolved_at = now

    await db.flush()
    await db.refresh(disc)
    return disc


async def send_disc_message(
    db: AsyncSession,
    disc_code: str,
    data: DiscMessageCreate,
    sender_user_id: int | None = None,
) -> DiscMessage:
    """
    Send a message on a disc's thread (e.g. finder contacting owner).

    Args:
        db: Database session.
        disc_code: The disc's unique code.
        data: Message input data.
        sender_user_id: Optional user ID if sender is authenticated.

    Raises:
        ValueError: If disc not found or sender_name missing for anonymous users.
    """
    disc = await get_disc_by_code(db, disc_code)
    if disc is None:
        raise ValueError(f"No disc found with code {disc_code}")

    # Determine sender name
    sender_name = data.sender_name
    if sender_user_id and not sender_name:
        # Fetch user display name
        result = await db.execute(select(User).where(User.id == sender_user_id))
        user = result.scalar_one_or_none()
        sender_name = user.display_name or user.username if user else "Unknown"
    if not sender_name:
        raise ValueError("sender_name is required for anonymous messages")

    msg = DiscMessage(
        disc_id=disc.id,
        sender_user_id=sender_user_id,
        sender_name=sender_name,
        message=data.message,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return msg


async def get_disc_messages(db: AsyncSession, disc_code: str) -> list[DiscMessage]:
    """Get all messages for a disc, newest first."""
    disc = await get_disc_by_code(db, disc_code)
    if disc is None:
        raise ValueError(f"No disc found with code {disc_code}")

    result = await db.execute(
        select(DiscMessage)
        .where(DiscMessage.disc_id == disc.id)
        .order_by(DiscMessage.created_at.desc())
    )
    return list(result.scalars().all())
