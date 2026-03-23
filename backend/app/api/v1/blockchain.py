"""
Blockchain API endpoints for $RGDG token operations.

Endpoints:
- GET  /blockchain/balance       — User's RGDG token balance
- POST /blockchain/pay-fee       — Verify on-chain event fee payment
- GET  /blockchain/transactions  — User's transaction history (from DB)
- GET  /blockchain/treasury      — Treasury stats (admin only)
- POST /blockchain/mint          — Mint RGDG tokens to treasury (admin only)
- POST /blockchain/distribute/{league_id} — Distribute prizes to league winners (admin only)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user, get_current_user
from app.db.database import get_db
from app.models.league import Event, Prize, Result
from app.models.transaction import Transaction
from app.models.user import User
from app.models.disc import RegisteredDisc
from app.schemas.blockchain import (
    DiscNFTStatus,
    MintDiscNFTResponse,
    MintRequest,
    PayFeeRequest,
    PayFeeResponse,
    TokenBalanceResponse,
    TransactionListResponse,
    TransactionResponse,
    TransferDiscNFTRequest,
    TreasuryStatsResponse,
)
from app.services.blockchain_service import (
    BlockchainUnavailableError,
    distribute_prizes,
    get_disc_nft_info,
    get_disc_owner_onchain,
    get_event_fee,
    get_token_balance,
    get_treasury_balance,
    mint_disc_nft,
    mint_tokens,
    transfer_disc_onchain,
    verify_fee_payment,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/balance", response_model=TokenBalanceResponse)
async def balance(user: User = Depends(get_current_user)):
    """Get the authenticated user's $RGDG token balance.

    Requires the user to have a linked wallet_address.
    """
    if not user.wallet_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No wallet address linked to this account. Connect a wallet first.",
        )

    try:
        bal = get_token_balance(user.wallet_address)
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    return TokenBalanceResponse(
        wallet_address=user.wallet_address,
        balance=bal,
    )


@router.post("/pay-fee", response_model=PayFeeResponse)
async def pay_fee(
    data: PayFeeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify that the user paid the event fee on-chain.

    The mobile app handles the actual blockchain transaction (approve + payEventFee).
    This endpoint verifies the tx receipt and records it in the database.
    """
    if not user.wallet_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No wallet address linked to this account.",
        )

    # Check for duplicate tx_hash
    existing = await db.execute(
        select(Transaction).where(Transaction.tx_hash == data.tx_hash)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This transaction has already been recorded.",
        )

    # Get the expected fee from the contract
    try:
        expected_fee = get_event_fee()
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    # Verify the on-chain payment
    try:
        verified = verify_fee_payment(
            tx_hash=data.tx_hash,
            expected_amount=expected_fee,
            payer_address=user.wallet_address,
        )
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    # Record the transaction in the database
    from app.config import get_settings
    settings = get_settings()

    tx = Transaction(
        user_id=user.id,
        tx_type="event_fee",
        amount=expected_fee,
        tx_hash=data.tx_hash,
        status="confirmed" if verified else "failed",
        event_id=data.event_id,
        from_address=user.wallet_address,
        to_address=settings.treasury_address or None,
    )
    db.add(tx)
    await db.flush()

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="On-chain payment verification failed. The transaction does not match the expected fee payment.",
        )

    return PayFeeResponse(
        verified=True,
        event_id=data.event_id,
        amount=expected_fee,
        tx_hash=data.tx_hash,
        message="Event fee payment verified and recorded.",
    )


@router.get("/transactions", response_model=TransactionListResponse)
async def transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's blockchain transaction history."""
    offset = (page - 1) * per_page

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == user.id)
    )
    total = count_result.scalar()

    # Fetch page
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    txs = result.scalars().all()

    return TransactionListResponse(
        transactions=[TransactionResponse.model_validate(tx) for tx in txs],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/treasury", response_model=TreasuryStatsResponse)
async def treasury(
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get treasury statistics. Admin only."""
    from app.config import get_settings
    settings = get_settings()

    try:
        treasury_bal = get_treasury_balance()
        fee = get_event_fee()
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    # Calculate totals from DB
    collected_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.tx_type == "event_fee",
            Transaction.status == "confirmed",
        )
    )
    total_collected = float(collected_result.scalar())

    distributed_result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.tx_type == "prize",
            Transaction.status == "confirmed",
        )
    )
    total_distributed = float(distributed_result.scalar())

    # Recent transactions (last 20)
    recent_result = await db.execute(
        select(Transaction)
        .order_by(Transaction.created_at.desc())
        .limit(20)
    )
    recent_txs = recent_result.scalars().all()

    return TreasuryStatsResponse(
        treasury_address=settings.treasury_address,
        balance=treasury_bal,
        total_collected=total_collected,
        total_distributed=total_distributed,
        event_fee=fee,
        recent_transactions=[TransactionResponse.model_validate(tx) for tx in recent_txs],
    )


@router.post("/mint", response_model=TransactionResponse)
async def mint(
    data: MintRequest,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Mint RGDG tokens to the treasury. Admin only.

    The deployer private key (contract owner) is used to sign the on-chain
    mint() call on the RGDGToken contract. Tokens are minted to the treasury
    address so they can later be distributed as prizes.
    """
    from app.config import get_settings
    settings = get_settings()

    if not settings.treasury_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="treasury_address is not configured.",
        )

    # Create a pending transaction record first
    tx_record = Transaction(
        user_id=user.id,
        tx_type="mint",
        amount=data.amount,
        status="pending",
        to_address=settings.treasury_address,
        from_address=None,  # Will be set after we know the deployer address
    )
    db.add(tx_record)
    await db.flush()

    try:
        tx_hash, block_number = mint_tokens(
            to_address=settings.treasury_address,
            amount=data.amount,
        )
    except BlockchainUnavailableError as exc:
        tx_record.status = "failed"
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    # Update the transaction record with on-chain data
    tx_record.tx_hash = tx_hash
    tx_record.block_number = block_number
    tx_record.status = "confirmed"
    await db.flush()

    logger.info(
        "Admin %s minted %s RGDG to treasury — reason: %s, tx: %s",
        user.username, data.amount, data.reason, tx_hash,
    )

    return TransactionResponse.model_validate(tx_record)


@router.post("/distribute/{league_id}", response_model=list[TransactionResponse])
async def distribute(
    league_id: int,
    user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Distribute prize tokens to league winners. Admin only.

    Reads the prize table for the league to determine amounts per position,
    then looks up final results across all completed events to determine
    season standings (total points). Winners must have a wallet_address linked.
    Calls distributePrizes() on the RGDGTreasury contract in a single batch tx.
    """
    from app.config import get_settings
    settings = get_settings()

    # 1. Fetch prizes for this league
    prize_result = await db.execute(
        select(Prize)
        .where(Prize.league_id == league_id)
        .order_by(Prize.position)
    )
    prizes = prize_result.scalars().all()
    if not prizes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No prize structure defined for league {league_id}.",
        )

    # Filter to prizes that have an RGDG amount
    rgdg_prizes = {p.position: p for p in prizes if p.amount_rgdg and p.amount_rgdg > 0}
    if not rgdg_prizes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No RGDG token prizes defined for this league.",
        )

    # 2. Calculate season standings: sum points_earned across completed events
    completed_event_ids_q = (
        select(Event.id)
        .where(Event.league_id == league_id, Event.status == "completed")
    )
    standings_result = await db.execute(
        select(
            Result.user_id,
            func.sum(Result.points_earned).label("total_points"),
        )
        .where(
            Result.event_id.in_(completed_event_ids_q),
            Result.dnf == False,  # noqa: E712
            Result.dq == False,   # noqa: E712
        )
        .group_by(Result.user_id)
        .order_by(func.sum(Result.points_earned).desc())
    )
    standings = standings_result.all()

    if not standings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed event results found for this league.",
        )

    # 3. Map positions to users, look up wallet addresses
    recipients: list[str] = []
    amounts: list[float] = []
    tx_records: list[Transaction] = []
    skipped: list[dict] = []

    for rank, (uid, total_pts) in enumerate(standings, start=1):
        if rank not in rgdg_prizes:
            continue  # No prize for this position

        prize = rgdg_prizes[rank]

        # Fetch the user to get wallet address
        user_result = await db.execute(select(User).where(User.id == uid))
        winner = user_result.scalar_one_or_none()
        if not winner:
            continue

        if not winner.wallet_address:
            skipped.append({
                "user_id": uid,
                "username": winner.username,
                "position": rank,
                "reason": "no wallet address",
            })
            logger.warning(
                "Skipping prize for user %s (position %d) — no wallet address",
                winner.username, rank,
            )
            continue

        recipients.append(winner.wallet_address)
        amounts.append(float(prize.amount_rgdg))

        # Pre-create pending transaction records
        tx_record = Transaction(
            user_id=uid,
            tx_type="prize",
            amount=float(prize.amount_rgdg),
            status="pending",
            from_address=settings.treasury_address,
            to_address=winner.wallet_address,
        )
        db.add(tx_record)
        tx_records.append(tx_record)

    if not recipients:
        detail = "No eligible winners with wallet addresses found."
        if skipped:
            detail += f" Skipped {len(skipped)} winner(s) without wallets."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    await db.flush()

    # 4. Send the batch on-chain transaction
    try:
        tx_hash, block_number = distribute_prizes(recipients, amounts)
    except BlockchainUnavailableError as exc:
        for tr in tx_records:
            tr.status = "failed"
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Blockchain service unavailable: {exc}",
        )

    # 5. Update all transaction records.
    # The tx_hash column has a unique constraint, so for batch distributions
    # we append a per-recipient index suffix (e.g. 0x…abc-0, 0x…abc-1).
    for idx, tr in enumerate(tx_records):
        if len(tx_records) == 1:
            tr.tx_hash = tx_hash
        else:
            tr.tx_hash = f"{tx_hash}-{idx}"
        tr.block_number = block_number
        tr.status = "confirmed"
    await db.flush()

    logger.info(
        "Admin %s distributed prizes for league %d to %d winners — tx %s",
        user.username, league_id, len(recipients), tx_hash,
    )

    return [TransactionResponse.model_validate(tr) for tr in tx_records]
