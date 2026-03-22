from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.security import get_current_user
from app.db.database import get_db
from app.models.league import Event, Result
from app.models.payment import EventPayment
from app.models.user import User
from app.services.payment_service import (
    _stripe_configured,
    create_checkout_session,
    verify_webhook,
)

router = APIRouter()


# ── Request / Response schemas ──────────────────────────────────────────────


class CheckoutRequest(BaseModel):
    event_id: int
    success_url: str = "https://rgdgc.com/payment/success"
    cancel_url: str = "https://rgdgc.com/payment/cancel"


class CheckoutResponse(BaseModel):
    session_id: str
    checkout_url: str


class PaymentOut(BaseModel):
    id: int
    event_id: int
    amount_cents: int
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime
    event_name: str | None = None

    model_config = {"from_attributes": True}


class StripeConfigOut(BaseModel):
    publishable_key: str


# ── Helper ──────────────────────────────────────────────────────────────────


def _require_stripe():
    if not _stripe_configured():
        raise HTTPException(status_code=503, detail="Payments not configured")


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/config", response_model=StripeConfigOut)
async def get_stripe_config():
    """Return the Stripe publishable key for client-side initialization."""
    _require_stripe()
    settings = get_settings()
    return StripeConfigOut(publishable_key=settings.stripe_publishable_key)


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for an event entry fee."""
    _require_stripe()

    # Look up the event
    event = await db.get(Event, body.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != "upcoming":
        raise HTTPException(status_code=400, detail="Event is not open for registration")
    if not event.entry_fee or float(event.entry_fee) <= 0:
        raise HTTPException(status_code=400, detail="This event has no entry fee")

    # Check for existing completed payment
    existing = await db.execute(
        select(EventPayment).where(
            EventPayment.event_id == body.event_id,
            EventPayment.user_id == user.id,
            EventPayment.status == "completed",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already paid for this event")

    amount_cents = int(float(event.entry_fee) * 100)
    event_name = event.name or f"Event #{event.id}"

    try:
        result = await create_checkout_session(
            event_id=event.id,
            user_id=user.id,
            amount_cents=amount_cents,
            event_name=event_name,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Record the pending payment
    payment = EventPayment(
        event_id=event.id,
        user_id=user.id,
        amount_cents=amount_cents,
        stripe_session_id=result["session_id"],
        status="pending",
    )
    db.add(payment)
    await db.flush()

    return CheckoutResponse(**result)


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events. No auth — Stripe calls this directly."""
    if not _stripe_configured():
        raise HTTPException(status_code=503, detail="Payments not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    event = await verify_webhook(payload, sig_header)
    if event is None:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session["id"]
        metadata = session.get("metadata", {})
        event_id = int(metadata.get("event_id", 0))
        user_id = int(metadata.get("user_id", 0))
        payment_intent = session.get("payment_intent")

        if not event_id or not user_id:
            return {"status": "ignored", "reason": "missing metadata"}

        # Update payment record
        result = await db.execute(
            select(EventPayment).where(EventPayment.stripe_session_id == session_id)
        )
        payment = result.scalar_one_or_none()
        if payment:
            payment.status = "completed"
            payment.stripe_payment_intent = payment_intent
            payment.paid_at = datetime.utcnow()
        else:
            # Create payment record if webhook arrived before flush
            payment = EventPayment(
                event_id=event_id,
                user_id=user_id,
                amount_cents=session.get("amount_total", 0),
                stripe_session_id=session_id,
                stripe_payment_intent=payment_intent,
                status="completed",
                paid_at=datetime.utcnow(),
            )
            db.add(payment)

        # Auto check-in: create a Result placeholder if not already checked in
        existing_checkin = await db.execute(
            select(Result).where(Result.event_id == event_id, Result.user_id == user_id)
        )
        if not existing_checkin.scalar_one_or_none():
            checkin_result = Result(
                event_id=event_id,
                user_id=user_id,
                total_strokes=0,
                total_score=0,
            )
            db.add(checkin_result)

            # Update player count on event
            db_event = await db.get(Event, event_id)
            if db_event:
                count = await db.execute(
                    select(Result).where(Result.event_id == event_id)
                )
                db_event.num_players = len(list(count.scalars().all())) + 1

        await db.flush()

    return {"status": "ok"}


@router.get("/history", response_model=list[PaymentOut])
async def payment_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated user's payment history."""
    _require_stripe()

    result = await db.execute(
        select(EventPayment)
        .where(EventPayment.user_id == user.id)
        .order_by(EventPayment.created_at.desc())
    )
    payments = result.scalars().all()

    out = []
    for p in payments:
        event = await db.get(Event, p.event_id)
        out.append(
            PaymentOut(
                id=p.id,
                event_id=p.event_id,
                amount_cents=p.amount_cents,
                currency=p.currency,
                status=p.status,
                paid_at=p.paid_at,
                created_at=p.created_at,
                event_name=event.name if event else None,
            )
        )
    return out
