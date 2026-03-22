"""$RGDG token service — earning, spending, and balance management.

All amounts use Python Decimal. Every movement creates an immutable ledger entry
with a running balance_after for audit consistency.

Earning is automatic (triggered by game actions). Spending requires user intent.
All reward calls should be wrapped in try/except by callers — a token reward
failure must NEVER break the primary action.
"""

import logging
from decimal import Decimal

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_ledger import TokenLedger, RewardConfig
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)


# ── Default reward amounts (used when no RewardConfig row exists) ──

DEFAULTS: dict[str, Decimal] = {
    "event_attendance": Decimal("10"),
    "event_win": Decimal("25"),
    "event_podium": Decimal("15"),
    "event_third": Decimal("10"),
    "disc_return": Decimal("50"),
    "round_completion": Decimal("5"),
    "putting_milestone": Decimal("20"),
    "referral": Decimal("25"),
    "season_bonus": Decimal("100"),
}

# Valid transaction types
EARNING_TYPES = {
    "event_attendance",
    "event_win",
    "event_podium",
    "event_third",
    "disc_return",
    "putting_milestone",
    "round_completion",
    "referral",
    "season_bonus",
    "admin_grant",
}
SPENDING_TYPES = {
    "event_fee",
    "merch_purchase",
    "side_pot",
    "gift_sent",
    "admin_deduct",
}
RECEIVING_TYPES = {"gift_received"}
ALL_TX_TYPES = EARNING_TYPES | SPENDING_TYPES | RECEIVING_TYPES


class InsufficientBalance(Exception):
    """Raised when a player tries to spend more $RGDG than they have."""

    pass


# ---------------------------------------------------------------------------
# Balance & History
# ---------------------------------------------------------------------------


async def get_balance(db: AsyncSession, user_id: int) -> Decimal:
    """Get user's current $RGDG balance from the most recent ledger entry."""
    result = await db.execute(
        select(TokenLedger.balance_after)
        .where(TokenLedger.user_id == user_id)
        .order_by(desc(TokenLedger.created_at), desc(TokenLedger.id))
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return Decimal(str(row)) if row is not None else Decimal("0")


async def get_history(
    db: AsyncSession,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    tx_type: str | None = None,
) -> tuple[list[TokenLedger], int]:
    """Get token transaction history (paginated). Returns (entries, total_count)."""
    filters = [TokenLedger.user_id == user_id]
    if tx_type:
        filters.append(TokenLedger.tx_type == tx_type)

    # Count
    count_result = await db.execute(
        select(func.count(TokenLedger.id)).where(*filters)
    )
    total = count_result.scalar() or 0

    # Fetch
    entries_result = await db.execute(
        select(TokenLedger)
        .where(*filters)
        .order_by(desc(TokenLedger.created_at), desc(TokenLedger.id))
        .offset(offset)
        .limit(limit)
    )
    entries = list(entries_result.scalars().all())

    return entries, total


# ---------------------------------------------------------------------------
# Core ledger write
# ---------------------------------------------------------------------------


async def _record_entry(
    db: AsyncSession,
    *,
    user_id: int,
    tx_type: str,
    amount: Decimal,
    description: str,
    event_id: int | None = None,
    related_user_id: int | None = None,
) -> TokenLedger:
    """Create an immutable token ledger entry. Calculates balance_after."""
    if tx_type not in ALL_TX_TYPES:
        raise ValueError(f"Invalid token tx_type: {tx_type}")
    if amount == Decimal("0"):
        raise ValueError("Amount cannot be zero")

    current_balance = await get_balance(db, user_id)
    new_balance = current_balance + amount

    entry = TokenLedger(
        user_id=user_id,
        tx_type=tx_type,
        amount=amount,
        balance_after=new_balance,
        description=description,
        event_id=event_id,
        related_user_id=related_user_id,
    )
    db.add(entry)
    await db.flush()
    return entry


# ---------------------------------------------------------------------------
# Earning (called automatically by other endpoints)
# ---------------------------------------------------------------------------


async def award_tokens(
    db: AsyncSession,
    user_id: int,
    tx_type: str,
    amount: Decimal,
    description: str,
    event_id: int | None = None,
    related_user_id: int | None = None,
) -> TokenLedger:
    """Award tokens to a user. Amount must be positive."""
    if amount <= Decimal("0"):
        raise ValueError("Award amount must be positive")
    return await _record_entry(
        db,
        user_id=user_id,
        tx_type=tx_type,
        amount=amount,
        description=description,
        event_id=event_id,
        related_user_id=related_user_id,
    )


async def award_event_attendance(db: AsyncSession, user_id: int, event_id: int) -> None:
    """Award tokens for attending an event. Called from event check-in."""
    amount = await get_reward_amount(db, "event_attendance")
    if amount <= 0:
        return
    await award_tokens(
        db,
        user_id=user_id,
        tx_type="event_attendance",
        amount=amount,
        description="Event attendance reward",
        event_id=event_id,
    )
    logger.info("Awarded %s RGDG to user %d for event %d attendance", amount, user_id, event_id)


async def award_event_placement(
    db: AsyncSession, user_id: int, event_id: int, position: int
) -> None:
    """Award tokens based on finish position. Called from event finalization."""
    if position == 1:
        reward_type = "event_win"
        desc_text = "1st place finish"
    elif position == 2:
        reward_type = "event_podium"
        desc_text = "2nd place finish"
    elif position == 3:
        reward_type = "event_third"
        desc_text = "3rd place finish"
    else:
        return  # No token reward below 3rd

    amount = await get_reward_amount(db, reward_type)
    if amount <= 0:
        return
    await award_tokens(
        db,
        user_id=user_id,
        tx_type=reward_type,
        amount=amount,
        description=desc_text,
        event_id=event_id,
    )
    logger.info(
        "Awarded %s RGDG to user %d for %s at event %d",
        amount, user_id, desc_text, event_id,
    )


async def award_disc_return(
    db: AsyncSession, finder_user_id: int, disc_owner_id: int
) -> None:
    """Award tokens for returning a found disc. Called from disc confirm_returned."""
    amount = await get_reward_amount(db, "disc_return")
    if amount <= 0:
        return
    await award_tokens(
        db,
        user_id=finder_user_id,
        tx_type="disc_return",
        amount=amount,
        description="Disc return reward — thanks for being a good sport!",
        related_user_id=disc_owner_id,
    )
    logger.info(
        "Awarded %s RGDG to user %d for returning disc to user %d",
        amount, finder_user_id, disc_owner_id,
    )


async def award_round_completion(db: AsyncSession, user_id: int) -> None:
    """Small reward for completing a round. Called from round completion."""
    amount = await get_reward_amount(db, "round_completion")
    if amount <= 0:
        return
    await award_tokens(
        db,
        user_id=user_id,
        tx_type="round_completion",
        amount=amount,
        description="Round completion reward",
    )
    logger.info("Awarded %s RGDG to user %d for round completion", amount, user_id)


async def award_putting_milestone(
    db: AsyncSession, user_id: int, milestone: str
) -> None:
    """Award for putting milestones (100 putts logged, etc)."""
    amount = await get_reward_amount(db, "putting_milestone")
    if amount <= 0:
        return
    await award_tokens(
        db,
        user_id=user_id,
        tx_type="putting_milestone",
        amount=amount,
        description=f"Putting milestone: {milestone}",
    )
    logger.info("Awarded %s RGDG to user %d for milestone: %s", amount, user_id, milestone)


# ---------------------------------------------------------------------------
# Spending
# ---------------------------------------------------------------------------


async def spend_tokens(
    db: AsyncSession,
    user_id: int,
    tx_type: str,
    amount: Decimal,
    description: str,
    event_id: int | None = None,
) -> TokenLedger:
    """Spend tokens. Checks balance first, raises InsufficientBalance if short."""
    if amount <= Decimal("0"):
        raise ValueError("Spend amount must be positive")

    balance = await get_balance(db, user_id)
    if balance < amount:
        raise InsufficientBalance(
            f"Need {amount} RGDG, have {balance}"
        )
    return await _record_entry(
        db,
        user_id=user_id,
        tx_type=tx_type,
        amount=-amount,  # negative = tokens out
        description=description,
        event_id=event_id,
    )


async def pay_event_fee(
    db: AsyncSession, user_id: int, event_id: int, amount: Decimal
) -> TokenLedger:
    """Pay event entry fee with tokens."""
    return await spend_tokens(
        db,
        user_id=user_id,
        tx_type="event_fee",
        amount=amount,
        description=f"Event fee payment (event {event_id})",
        event_id=event_id,
    )


async def send_gift(
    db: AsyncSession,
    from_user_id: int,
    to_user_id: int,
    amount: Decimal,
    message: str = "",
) -> tuple[TokenLedger, TokenLedger]:
    """Send tokens to another player. Returns (debit_entry, credit_entry)."""
    if from_user_id == to_user_id:
        raise ValueError("Cannot send tokens to yourself")
    if amount <= Decimal("0"):
        raise ValueError("Gift amount must be positive")

    balance = await get_balance(db, from_user_id)
    if balance < amount:
        raise InsufficientBalance(f"Need {amount} RGDG, have {balance}")

    desc_suffix = f" — \"{message}\"" if message else ""

    # Debit sender
    debit = await _record_entry(
        db,
        user_id=from_user_id,
        tx_type="gift_sent",
        amount=-amount,
        description=f"Gift sent to player {to_user_id}{desc_suffix}",
        related_user_id=to_user_id,
    )

    # Credit receiver
    credit = await _record_entry(
        db,
        user_id=to_user_id,
        tx_type="gift_received",
        amount=amount,
        description=f"Gift from player {from_user_id}{desc_suffix}",
        related_user_id=from_user_id,
    )

    return debit, credit


# ---------------------------------------------------------------------------
# Admin operations
# ---------------------------------------------------------------------------


async def admin_grant(
    db: AsyncSession,
    admin_id: int,
    user_id: int,
    amount: Decimal,
    reason: str,
) -> TokenLedger:
    """Admin grants tokens to a player."""
    entry = await award_tokens(
        db,
        user_id=user_id,
        tx_type="admin_grant",
        amount=amount,
        description=f"Admin grant: {reason}",
        related_user_id=admin_id,
    )
    await log_action(
        db,
        admin_id=admin_id,
        action="token_grant",
        target_type="user",
        target_id=str(user_id),
        details={"amount": str(amount), "reason": reason},
    )
    return entry


async def admin_deduct(
    db: AsyncSession,
    admin_id: int,
    user_id: int,
    amount: Decimal,
    reason: str,
) -> TokenLedger:
    """Admin deducts tokens from a player."""
    if amount <= Decimal("0"):
        raise ValueError("Deduct amount must be positive")

    balance = await get_balance(db, user_id)
    if balance < amount:
        raise InsufficientBalance(f"Player has {balance} RGDG, cannot deduct {amount}")

    entry = await _record_entry(
        db,
        user_id=user_id,
        tx_type="admin_deduct",
        amount=-amount,
        description=f"Admin deduction: {reason}",
        related_user_id=admin_id,
    )
    await log_action(
        db,
        admin_id=admin_id,
        action="token_deduct",
        target_type="user",
        target_id=str(user_id),
        details={"amount": str(amount), "reason": reason},
    )
    return entry


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


async def get_reward_amount(db: AsyncSession, reward_type: str) -> Decimal:
    """Get configured reward amount, falling back to built-in defaults."""
    result = await db.execute(
        select(RewardConfig).where(
            RewardConfig.reward_type == reward_type,
            RewardConfig.is_active.is_(True),
        )
    )
    config = result.scalar_one_or_none()
    if config:
        return config.amount
    return DEFAULTS.get(reward_type, Decimal("0"))


async def get_all_reward_configs(db: AsyncSession) -> list[dict]:
    """Return all reward configs, merging DB rows with defaults."""
    result = await db.execute(select(RewardConfig).order_by(RewardConfig.reward_type))
    db_configs = {c.reward_type: c for c in result.scalars().all()}

    configs = []
    for reward_type, default_amount in sorted(DEFAULTS.items()):
        if reward_type in db_configs:
            c = db_configs[reward_type]
            configs.append({
                "reward_type": c.reward_type,
                "amount": str(c.amount),
                "description": c.description,
                "is_active": c.is_active,
                "updated_at": str(c.updated_at) if c.updated_at else None,
                "source": "database",
            })
        else:
            configs.append({
                "reward_type": reward_type,
                "amount": str(default_amount),
                "description": None,
                "is_active": True,
                "updated_at": None,
                "source": "default",
            })

    # Include any DB-only configs not in defaults
    for reward_type, c in db_configs.items():
        if reward_type not in DEFAULTS:
            configs.append({
                "reward_type": c.reward_type,
                "amount": str(c.amount),
                "description": c.description,
                "is_active": c.is_active,
                "updated_at": str(c.updated_at) if c.updated_at else None,
                "source": "database",
            })

    return configs


async def update_reward_config(
    db: AsyncSession, reward_type: str, amount: Decimal, description: str | None = None
) -> RewardConfig:
    """Admin: upsert a reward amount."""
    result = await db.execute(
        select(RewardConfig).where(RewardConfig.reward_type == reward_type)
    )
    config = result.scalar_one_or_none()

    if config:
        config.amount = amount
        if description is not None:
            config.description = description
    else:
        config = RewardConfig(
            reward_type=reward_type,
            amount=amount,
            description=description,
        )
        db.add(config)

    await db.flush()
    return config


# ---------------------------------------------------------------------------
# Stats (admin)
# ---------------------------------------------------------------------------


async def get_token_stats(db: AsyncSession) -> dict:
    """Aggregate token economy stats for the admin dashboard."""
    # Total minted (sum of all positive entries)
    minted_result = await db.execute(
        select(func.coalesce(func.sum(TokenLedger.amount), 0)).where(
            TokenLedger.amount > 0
        )
    )
    total_minted = Decimal(str(minted_result.scalar()))

    # Total spent (sum of all negative entries, as positive number)
    spent_result = await db.execute(
        select(func.coalesce(func.sum(TokenLedger.amount), 0)).where(
            TokenLedger.amount < 0
        )
    )
    total_spent = abs(Decimal(str(spent_result.scalar())))

    # Total in circulation
    total_circulation = total_minted - total_spent

    # Unique holders (users with positive balance)
    # We approximate by counting users with any ledger entry
    holders_result = await db.execute(
        select(func.count(func.distinct(TokenLedger.user_id)))
    )
    unique_holders = holders_result.scalar() or 0

    # Top earners
    top_earners_result = await db.execute(
        select(
            TokenLedger.user_id,
            func.sum(TokenLedger.amount).label("net_tokens"),
        )
        .group_by(TokenLedger.user_id)
        .order_by(desc(func.sum(TokenLedger.amount)))
        .limit(10)
    )
    top_earners = [
        {"user_id": row[0], "net_tokens": str(row[1])}
        for row in top_earners_result.all()
    ]

    return {
        "total_minted": str(total_minted),
        "total_spent": str(total_spent),
        "total_in_circulation": str(total_circulation),
        "unique_holders": unique_holders,
        "top_earners": top_earners,
    }


async def get_token_leaderboard(
    db: AsyncSession, limit: int = 20
) -> list[dict]:
    """Top token holders by current balance."""
    # Get each user's latest balance_after
    # Subquery: max(id) per user = most recent entry
    latest_id_subq = (
        select(
            TokenLedger.user_id,
            func.max(TokenLedger.id).label("max_id"),
        )
        .group_by(TokenLedger.user_id)
        .subquery()
    )

    result = await db.execute(
        select(TokenLedger.user_id, TokenLedger.balance_after)
        .join(
            latest_id_subq,
            (TokenLedger.user_id == latest_id_subq.c.user_id)
            & (TokenLedger.id == latest_id_subq.c.max_id),
        )
        .where(TokenLedger.balance_after > 0)
        .order_by(desc(TokenLedger.balance_after))
        .limit(limit)
    )
    rows = result.all()

    # Fetch usernames
    if not rows:
        return []

    from app.models.user import User

    user_ids = [r[0] for r in rows]
    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    return [
        {
            "user_id": row[0],
            "username": (users_by_id[row[0]].display_name or users_by_id[row[0]].username)
            if row[0] in users_by_id
            else f"Player {row[0]}",
            "balance": str(row[1]),
        }
        for row in rows
    ]
