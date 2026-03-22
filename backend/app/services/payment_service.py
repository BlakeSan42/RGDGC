import stripe
from app.config import get_settings


def _stripe_configured() -> bool:
    """Check if Stripe keys are configured."""
    settings = get_settings()
    return bool(settings.stripe_secret_key)


def init_stripe():
    """Initialize Stripe with the secret key. No-op if not configured."""
    settings = get_settings()
    if settings.stripe_secret_key:
        stripe.api_key = settings.stripe_secret_key


async def create_checkout_session(
    event_id: int,
    user_id: int,
    amount_cents: int,
    event_name: str,
    success_url: str,
    cancel_url: str,
) -> dict:
    """Create a Stripe Checkout Session for event fee payment."""
    init_stripe()
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": f"RGDGC: {event_name}"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"event_id": str(event_id), "user_id": str(user_id)},
        )
        return {"session_id": session.id, "checkout_url": session.url}
    except stripe.error.StripeError as e:
        raise ValueError(f"Stripe error: {str(e)}")


async def verify_webhook(payload: bytes, sig_header: str) -> dict | None:
    """Verify and parse a Stripe webhook event."""
    settings = get_settings()
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
        return event
    except (ValueError, stripe.error.SignatureVerificationError):
        return None
