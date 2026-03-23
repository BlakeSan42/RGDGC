import logging

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_admin_user, verify_password
from app.db.database import get_db
from app.models.user import User
from app.models.round import Round
from app.models.league import Result, Event
from app.schemas.user import DeleteAccountRequest, PushTokenRequest, UserOut, UserPublicOut, UserUpdate, WalletLinkRequest
from app.services.stats_service import get_player_stats, get_hole_averages
from app.services.storage_service import delete_file, upload_file

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    season: str | None = Query(None),
    _current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Comprehensive player stats including per-hole analytics and scoring distribution."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Comprehensive round + hole-level stats from stats_service
    player_stats = await get_player_stats(db, user_id)

    # League stats
    league_stmt = select(
        func.count(Result.id).label("events_played"),
        func.sum(Result.points_earned).label("total_points"),
        func.sum(case((Result.position == 1, 1), else_=0)).label("wins"),
        func.sum(case((Result.position <= 3, 1), else_=0)).label("podiums"),
        func.min(Result.position).label("best_finish"),
    ).where(Result.user_id == user_id)

    if season:
        league_stmt = league_stmt.join(Event).where(
            Event.status == "completed"
        )

    league_result = await db.execute(league_stmt)
    lr = league_result.one()

    return {
        "user": UserOut.model_validate(user).model_dump(),
        "rounds": {
            "total": player_stats["total_rounds"],
            "avg_score": player_stats["avg_score"],
            "best_score": player_stats["best_round"],
            "worst_score": player_stats["worst_round"],
            "avg_strokes": player_stats["avg_strokes"],
        },
        "per_hole": {
            "fairway_hit_pct": player_stats["fairway_hit_pct"],
            "c1_in_regulation": player_stats["c1_in_regulation"],
            "c2_in_regulation": player_stats["c2_in_regulation"],
            "scramble_rate": player_stats["scramble_rate"],
            "parked_pct": player_stats["parked_pct"],
            "avg_putts_per_hole": player_stats["avg_putts_per_hole"],
            "avg_ob_per_round": player_stats["avg_ob_per_round"],
        },
        "scoring_distribution": player_stats["scoring_distribution"],
        "personal_bests": player_stats["personal_bests"],
        "league": {
            "events_played": lr.events_played or 0,
            "total_points": lr.total_points or 0,
            "wins": lr.wins or 0,
            "podiums": lr.podiums or 0,
            "best_finish": lr.best_finish,
        },
        "handicap": float(user.handicap) if user.handicap else None,
    }


@router.get("/{user_id}/hole-averages")
async def get_user_hole_averages(
    user_id: int,
    layout_id: int = Query(..., description="Layout to get hole averages for"),
    _current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Average score per hole on a layout for a specific player."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return await get_hole_averages(db, layout_id, user_id=user_id)


@router.get("", response_model=list[UserOut])
async def list_users(
    limit: int = Query(50, le=200),
    role: str | None = None,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.is_active.is_(True)).limit(limit)
    if role:
        stmt = stmt.where(User.role == role)
    result = await db.execute(stmt)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/me/wallet")
async def link_wallet(
    data: WalletLinkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a MetaMask wallet to your account.

    Requires signing a message to prove wallet ownership.
    The client should call personal_sign with the provided message,
    then submit the wallet_address, signature, and original message.
    """
    from app.services.blockchain_service import (
        BlockchainUnavailableError,
        is_valid_address,
        verify_wallet_signature,
    )

    # Validate address format
    if not is_valid_address(data.wallet_address):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Ethereum wallet address.",
        )

    # Verify the signature proves wallet ownership
    try:
        valid = verify_wallet_signature(data.wallet_address, data.message, data.signature)
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Signature verification unavailable: {exc}",
        )

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature verification failed. The signature does not match the wallet address.",
        )

    # Check if wallet is already linked to another user
    existing = await db.execute(
        select(User).where(User.wallet_address == data.wallet_address, User.id != user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This wallet is already linked to another account.",
        )

    user.wallet_address = data.wallet_address
    await db.flush()

    logger.info("User %s linked wallet %s", user.username, data.wallet_address)

    return {
        "wallet_address": data.wallet_address,
        "message": "Wallet linked successfully.",
    }


@router.put("/me", response_model=UserOut)
async def update_profile(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields."""
    if data.username is not None:
        # Check uniqueness
        existing = await db.execute(
            select(User).where(User.username == data.username, User.id != user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already taken",
            )
        user.username = data.username

    if data.display_name is not None:
        user.display_name = data.display_name
    if data.phone is not None:
        user.phone = data.phone
    if data.bio is not None:
        user.bio = data.bio
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url

    await db.flush()
    return UserOut.model_validate(user)


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_account(
    data: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete the current user's account. Requires password confirmation."""
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account uses social login; contact support to delete.",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )

    user.is_active = False
    await db.flush()
    return {"message": "Account deactivated successfully"}


@router.post("/me/push-token", status_code=status.HTTP_200_OK)
async def register_push_token(
    data: PushTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a push notification token for the current user."""
    if data.platform not in ("ios", "android"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Platform must be 'ios' or 'android'",
        )

    user.push_token = data.token
    user.push_platform = data.platform
    await db.flush()
    return {"message": "Push token registered", "platform": data.platform}


@router.post("/me/avatar", response_model=dict)
async def upload_avatar(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload user avatar photo."""
    # Delete previous avatar if it exists
    if current_user.avatar_url:
        await delete_file(current_user.avatar_url)

    url = await upload_file(file, folder="avatars", filename=f"user-{current_user.id}")
    current_user.avatar_url = url
    await db.flush()
    return {"avatar_url": url}
