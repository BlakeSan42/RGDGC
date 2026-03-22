"""
Blockchain API endpoints for $RGDG token operations.

Endpoints:
- GET  /blockchain/balance       — User's RGDG token balance
- POST /blockchain/pay-fee       — Verify on-chain event fee payment
- GET  /blockchain/transactions  — User's transaction history (from DB)
- GET  /blockchain/treasury      — Treasury stats (admin only)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_admin_user, get_current_user
from app.db.database import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.blockchain import (
    PayFeeRequest,
    PayFeeResponse,
    TokenBalanceResponse,
    TransactionListResponse,
    TransactionResponse,
    TreasuryStatsResponse,
)
from app.services.blockchain_service import (
    BlockchainUnavailableError,
    get_event_fee,
    get_token_balance,
    get_treasury_balance,
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
