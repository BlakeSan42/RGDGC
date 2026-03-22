"""
API routes for disc registration, QR codes, and lost/found workflow.

Public endpoints (no auth required):
    GET  /{disc_code}/lookup  — QR scan lookup
    POST /{disc_code}/found   — Report finding a disc
    POST /{disc_code}/messages — Send a message (optional auth)

Authenticated endpoints:
    POST /register             — Register a new disc
    GET  /my-discs             — List user's discs
    GET  /{disc_code}          — Disc detail
    GET  /{disc_code}/qr       — Regenerate QR code
    POST /{disc_code}/lost     — Mark disc as lost
    POST /{disc_code}/returned — Confirm disc returned
    GET  /{disc_code}/messages — Get messages (owner only)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import get_current_user
from app.db.database import get_db
from app.models.disc import RegisteredDisc
from app.models.user import User
from app.services.storage_service import delete_file, upload_file
from app.schemas.disc import (
    DiscFoundCreate,
    DiscFoundResponse,
    DiscMessageCreate,
    DiscMessageResponse,
    DiscPublicResponse,
    DiscQRResponse,
    DiscRegister,
    DiscResponse,
)
from app.services.disc_service import (
    DISC_BASE_URL,
    confirm_returned,
    generate_qr_svg,
    get_disc_messages,
    get_user_discs,
    lookup_disc,
    register_disc,
    report_found,
    report_lost,
    send_disc_message,
)
from app.services.push_service import send_push_to_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address, enabled=get_settings().environment != "testing")

# Optional auth: returns User or None (does not raise on missing/invalid token)
_optional_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Extract user from token if present and valid; return None otherwise."""
    if credentials is None:
        return None
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = int(payload["sub"])
        if payload.get("type") != "access":
            return None
    except (JWTError, ValueError, KeyError):
        return None

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Authenticated endpoints
# ---------------------------------------------------------------------------


@router.post("/register", response_model=DiscResponse, status_code=status.HTTP_201_CREATED)
async def register_disc_endpoint(
    data: DiscRegister,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new disc and generate a unique RGDG code."""
    disc = await register_disc(db, user.id, data)
    return DiscResponse(
        id=disc.id,
        disc_code=disc.disc_code,
        owner_id=disc.owner_id,
        owner_display_name=user.display_name or user.username,
        manufacturer=disc.manufacturer,
        mold=disc.mold,
        plastic=disc.plastic,
        weight_grams=disc.weight_grams,
        color=disc.color,
        photo_url=disc.photo_url,
        status=disc.status,
        notes=disc.notes,
        registered_at=disc.registered_at,
        updated_at=disc.updated_at,
    )


@router.get("/my-discs", response_model=list[DiscResponse])
async def list_my_discs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all discs registered to the authenticated player."""
    discs = await get_user_discs(db, user.id)
    return [
        DiscResponse(
            id=d.id,
            disc_code=d.disc_code,
            owner_id=d.owner_id,
            owner_display_name=user.display_name or user.username,
            manufacturer=d.manufacturer,
            mold=d.mold,
            plastic=d.plastic,
            weight_grams=d.weight_grams,
            color=d.color,
            photo_url=d.photo_url,
            status=d.status,
            notes=d.notes,
            registered_at=d.registered_at,
            updated_at=d.updated_at,
        )
        for d in discs
    ]


@router.get("/{disc_code}", response_model=DiscResponse)
async def get_disc_detail(
    disc_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full detail for a registered disc. Requires authentication."""
    disc = await lookup_disc(db, disc_code)
    if disc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")

    owner = disc.owner
    return DiscResponse(
        id=disc.id,
        disc_code=disc.disc_code,
        owner_id=disc.owner_id,
        owner_display_name=owner.display_name or owner.username if owner else None,
        manufacturer=disc.manufacturer,
        mold=disc.mold,
        plastic=disc.plastic,
        weight_grams=disc.weight_grams,
        color=disc.color,
        photo_url=disc.photo_url,
        status=disc.status,
        notes=disc.notes,
        registered_at=disc.registered_at,
        updated_at=disc.updated_at,
    )


@router.get("/{disc_code}/qr", response_model=DiscQRResponse)
async def get_qr_code(
    disc_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the QR code SVG for a disc. Requires authentication."""
    disc = await lookup_disc(db, disc_code)
    if disc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")

    svg = generate_qr_svg(disc.disc_code)
    return DiscQRResponse(
        disc_code=disc.disc_code,
        qr_svg=svg,
        qr_url=f"{DISC_BASE_URL}/{disc.disc_code}",
    )


@router.post("/{disc_code}/lost", response_model=DiscResponse)
async def mark_disc_lost(
    disc_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a disc as lost. Only the disc owner can do this."""
    try:
        disc = await report_lost(db, disc_code, user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the disc owner can mark it as lost")

    return DiscResponse(
        id=disc.id,
        disc_code=disc.disc_code,
        owner_id=disc.owner_id,
        owner_display_name=user.display_name or user.username,
        manufacturer=disc.manufacturer,
        mold=disc.mold,
        plastic=disc.plastic,
        weight_grams=disc.weight_grams,
        color=disc.color,
        photo_url=disc.photo_url,
        status=disc.status,
        notes=disc.notes,
        registered_at=disc.registered_at,
        updated_at=disc.updated_at,
    )


@router.post("/{disc_code}/returned", response_model=DiscResponse)
async def confirm_disc_returned(
    disc_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a disc has been returned. Only the disc owner can do this."""
    # Grab finder user IDs from open found reports BEFORE resolving them
    from app.models.disc import DiscFoundReport
    finder_ids_result = await db.execute(
        select(DiscFoundReport.finder_user_id).join(
            RegisteredDisc, DiscFoundReport.disc_id == RegisteredDisc.id
        ).where(
            RegisteredDisc.disc_code == disc_code,
            DiscFoundReport.resolved.is_(False),
            DiscFoundReport.finder_user_id.isnot(None),
        )
    )
    finder_user_ids = [row[0] for row in finder_ids_result.all()]

    try:
        disc = await confirm_returned(db, disc_code, user.id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the disc owner can confirm return")

    # Award $RGDG tokens to finders who are registered users (fire and forget)
    try:
        from app.services.token_service import award_disc_return
        for finder_id in finder_user_ids:
            if finder_id != user.id:  # Don't reward yourself
                try:
                    await award_disc_return(db, finder_id, user.id)
                except Exception:
                    pass
    except Exception:
        pass  # Token reward failure must never break disc return

    return DiscResponse(
        id=disc.id,
        disc_code=disc.disc_code,
        owner_id=disc.owner_id,
        owner_display_name=user.display_name or user.username,
        manufacturer=disc.manufacturer,
        mold=disc.mold,
        plastic=disc.plastic,
        weight_grams=disc.weight_grams,
        color=disc.color,
        photo_url=disc.photo_url,
        status=disc.status,
        notes=disc.notes,
        registered_at=disc.registered_at,
        updated_at=disc.updated_at,
    )


@router.post("/{disc_code}/photo", response_model=dict)
async def upload_disc_photo(
    disc_code: str,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload disc photo. Owner only."""
    disc = await lookup_disc(db, disc_code)
    if disc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")
    if disc.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the disc owner can upload a photo",
        )

    # Delete previous photo if it exists
    if disc.photo_url:
        await delete_file(disc.photo_url)

    url = await upload_file(file, folder="discs", filename=f"disc-{disc.disc_code}")
    disc.photo_url = url
    await db.flush()
    return {"photo_url": url}


# ---------------------------------------------------------------------------
# Public endpoints (no auth required)
# ---------------------------------------------------------------------------


@router.get("/{disc_code}/lookup", response_model=DiscPublicResponse)
@limiter.limit("30/minute")
async def public_disc_lookup(
    request: Request,
    disc_code: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for QR code scans. Returns limited disc info without
    exposing owner contact details.
    """
    disc = await lookup_disc(db, disc_code)
    if disc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")

    owner = disc.owner
    return DiscPublicResponse(
        disc_code=disc.disc_code,
        manufacturer=disc.manufacturer,
        mold=disc.mold,
        plastic=disc.plastic,
        color=disc.color,
        status=disc.status,
        owner_display_name=owner.display_name or owner.username if owner else None,
    )


@router.post("/{disc_code}/found", response_model=DiscFoundResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def report_disc_found(
    request: Request,
    disc_code: str,
    data: DiscFoundCreate,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Report finding a disc. Public endpoint — authentication is optional.
    If the finder is logged in, their user ID is recorded.
    """
    try:
        report = await report_found(
            db, disc_code, data, finder_user_id=user.id if user else None
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")

    # Notify the disc owner that someone found their disc
    try:
        disc = await lookup_disc(db, disc_code)
        if disc and disc.owner_id:
            await send_push_to_user(
                db,
                disc.owner_id,
                "Someone Found Your Disc!",
                f"Your {disc.mold} was found. Check the app for details.",
                {"type": "disc_found", "disc_code": disc.disc_code},
            )
    except Exception:
        pass  # Push failure must never break the found report

    return DiscFoundResponse.model_validate(report)


@router.post("/{disc_code}/messages", response_model=DiscMessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_disc_message(
    request: Request,
    disc_code: str,
    data: DiscMessageCreate,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message on a disc thread. Authentication is optional.
    Anonymous users must provide sender_name in the request body.
    """
    try:
        msg = await send_disc_message(
            db, disc_code, data, sender_user_id=user.id if user else None
        )
    except ValueError as e:
        detail = str(e)
        if "No disc found" in detail:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    return DiscMessageResponse.model_validate(msg)


@router.get("/{disc_code}/messages", response_model=list[DiscMessageResponse])
async def list_disc_messages(
    disc_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all messages for a disc. Only the disc owner can view messages.
    """
    disc = await lookup_disc(db, disc_code)
    if disc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disc not found")
    if disc.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the disc owner can view messages")

    messages = await get_disc_messages(db, disc_code)
    return [DiscMessageResponse.model_validate(m) for m in messages]
