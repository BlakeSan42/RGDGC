"""$RGDG token endpoints — earn, spend, gift, and manage loyalty tokens.

Player endpoints require authentication. Admin endpoints require admin role.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user, get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.token import (
    AdminDeduct,
    AdminGrant,
    GiftTokens,
    PayEventFee,
    RewardConfigOut,
    TokenBalanceOut,
    TokenEntryOut,
    TokenHistoryPage,
    TokenLeaderboardEntry,
    TokenStatsOut,
    UpdateRewardConfig,
)
from app.services.token_service import (
    InsufficientBalance,
    admin_deduct,
    admin_grant,
    get_all_reward_configs,
    get_balance,
    get_history,
    get_token_leaderboard,
    get_token_stats,
    pay_event_fee,
    send_gift,
    update_reward_config,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Player endpoints
# ---------------------------------------------------------------------------


@router.get("/balance", response_model=TokenBalanceOut)
async def my_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get my current $RGDG token balance."""
    balance = await get_balance(db, user.id)
    return TokenBalanceOut(balance=str(balance))


@router.get("/history", response_model=TokenHistoryPage)
async def my_history(
    tx_type: str | None = Query(None, alias="type"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get my $RGDG transaction history (paginated)."""
    entries, total = await get_history(
        db, user.id, limit=limit, offset=offset, tx_type=tx_type
    )
    return TokenHistoryPage(
        entries=[TokenEntryOut.from_entry(e) for e in entries],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/pay-event-fee", response_model=TokenEntryOut, status_code=201)
async def pay_event_fee_endpoint(
    data: PayEventFee,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pay an event fee using $RGDG tokens."""
    try:
        entry = await pay_event_fee(db, user.id, data.event_id, data.amount)
    except InsufficientBalance as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TokenEntryOut.from_entry(entry)


@router.post("/gift", response_model=TokenEntryOut, status_code=201)
async def gift_tokens(
    data: GiftTokens,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send $RGDG tokens to another player."""
    try:
        debit, credit = await send_gift(
            db, user.id, data.to_user_id, data.amount, data.message
        )
    except InsufficientBalance as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TokenEntryOut.from_entry(debit)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.get("/leaderboard", response_model=list[TokenLeaderboardEntry])
async def token_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Top $RGDG token holders. Admin only."""
    rows = await get_token_leaderboard(db, limit=limit)
    return [TokenLeaderboardEntry(**r) for r in rows]


@router.post("/grant", response_model=TokenEntryOut, status_code=201)
async def grant_tokens(
    data: AdminGrant,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: grant $RGDG tokens to a player."""
    try:
        entry = await admin_grant(db, admin.id, data.user_id, data.amount, data.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TokenEntryOut.from_entry(entry)


@router.post("/deduct", response_model=TokenEntryOut, status_code=201)
async def deduct_tokens(
    data: AdminDeduct,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin: deduct $RGDG tokens from a player."""
    try:
        entry = await admin_deduct(db, admin.id, data.user_id, data.amount, data.reason)
    except (InsufficientBalance, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return TokenEntryOut.from_entry(entry)


@router.get("/config", response_model=list[RewardConfigOut])
async def list_reward_configs(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """View all reward configurations (defaults + overrides). Admin only."""
    configs = await get_all_reward_configs(db)
    return [RewardConfigOut(**c) for c in configs]


@router.put("/config/{reward_type}", response_model=RewardConfigOut)
async def update_config(
    reward_type: str,
    data: UpdateRewardConfig,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a reward amount. Admin only."""
    config = await update_reward_config(
        db, reward_type, data.amount, data.description
    )
    return RewardConfigOut(
        reward_type=config.reward_type,
        amount=str(config.amount),
        description=config.description,
        is_active=config.is_active,
        updated_at=str(config.updated_at) if config.updated_at else None,
        source="database",
    )


@router.get("/stats", response_model=TokenStatsOut)
async def token_stats(
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Token economy stats: total minted, spent, circulation. Admin only."""
    stats = await get_token_stats(db)
    return TokenStatsOut(**stats)
