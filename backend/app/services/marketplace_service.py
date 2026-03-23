"""Disc marketplace service — listing, buying, and trading discs.

Handles:
- Creating and managing disc listings
- Executing purchases via $RGDG tokens or cash
- Transferring disc ownership (DB + optional on-chain NFT)
"""

import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.disc import RegisteredDisc
from app.models.marketplace import DiscListing
from app.models.user import User

logger = logging.getLogger(__name__)


class MarketplaceError(Exception):
    """Base exception for marketplace operations."""
    pass


class ListingNotFoundError(MarketplaceError):
    pass


class NotSellerError(MarketplaceError):
    pass


class DiscNotOwnedError(MarketplaceError):
    pass


class DiscNotAvailableError(MarketplaceError):
    pass


class ListingNotActiveError(MarketplaceError):
    pass


class PaymentMethodNotAcceptedError(MarketplaceError):
    pass


class CannotBuyOwnDiscError(MarketplaceError):
    pass


# ---------------------------------------------------------------------------
# Create listing
# ---------------------------------------------------------------------------


async def create_listing(
    db: AsyncSession,
    seller_id: int,
    disc_id: int,
    *,
    price_usd: Decimal | None = None,
    price_rgdg: Decimal | None = None,
    condition: str,
    description: str | None = None,
    accepts_cash: bool = True,
    accepts_rgdg: bool = True,
    accepts_trade: bool = False,
    photos: list[str] | None = None,
) -> DiscListing:
    """List a disc for sale on the marketplace.

    Validates:
    - The seller owns the disc
    - The disc is in 'active' status (not lost, retired, or already listed)

    Sets the disc status to 'listed' to prevent duplicate listings.
    """
    # Fetch and validate the disc
    disc_result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.id == disc_id)
    )
    disc = disc_result.scalar_one_or_none()
    if disc is None:
        raise DiscNotOwnedError("Disc not found.")

    if disc.owner_id != seller_id:
        raise DiscNotOwnedError("You can only list discs you own.")

    if disc.status != "active":
        raise DiscNotAvailableError(
            f"Disc cannot be listed — current status is '{disc.status}'. "
            "Only active discs can be listed for sale."
        )

    # Check for existing active listing
    existing_result = await db.execute(
        select(DiscListing).where(
            DiscListing.disc_id == disc_id,
            DiscListing.status == "active",
        )
    )
    if existing_result.scalar_one_or_none():
        raise DiscNotAvailableError("This disc already has an active listing.")

    # Create the listing
    listing = DiscListing(
        disc_id=disc_id,
        seller_id=seller_id,
        price_usd=price_usd,
        price_rgdg=price_rgdg,
        condition=condition,
        description=description,
        accepts_cash=accepts_cash,
        accepts_rgdg=accepts_rgdg,
        accepts_trade=accepts_trade,
        photos=photos,
        status="active",
    )
    db.add(listing)

    # Mark disc as listed
    disc.status = "listed"
    await db.flush()

    logger.info(
        "User %d listed disc %d for sale (listing %d) — USD: %s, RGDG: %s",
        seller_id, disc_id, listing.id, price_usd, price_rgdg,
    )

    return listing


# ---------------------------------------------------------------------------
# Buy disc
# ---------------------------------------------------------------------------


async def buy_disc(
    db: AsyncSession,
    listing_id: int,
    buyer_id: int,
    payment_method: str,
) -> DiscListing:
    """Execute a disc purchase.

    - Validates listing is active and buyer is not the seller
    - If RGDG: deducts tokens from buyer, credits seller via token_service
    - Transfers disc ownership (disc.owner_id = buyer_id)
    - If NFT: initiates on-chain transfer (fire and forget)
    - If cash: marks as sold; buyer and seller arrange payment offline
    - Updates listing status to 'sold'
    """
    # Fetch listing
    listing_result = await db.execute(
        select(DiscListing).where(DiscListing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing is None:
        raise ListingNotFoundError("Listing not found.")

    if listing.status != "active":
        raise ListingNotActiveError(
            f"This listing is no longer active (status: {listing.status})."
        )

    if listing.seller_id == buyer_id:
        raise CannotBuyOwnDiscError("You cannot buy your own disc.")

    # Validate payment method is accepted
    if payment_method == "rgdg" and not listing.accepts_rgdg:
        raise PaymentMethodNotAcceptedError("This listing does not accept $RGDG tokens.")
    if payment_method == "cash" and not listing.accepts_cash:
        raise PaymentMethodNotAcceptedError("This listing does not accept cash.")

    # Fetch the disc
    disc_result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.id == listing.disc_id)
    )
    disc = disc_result.scalar_one_or_none()
    if disc is None:
        raise MarketplaceError("Disc no longer exists.")

    sold_price = None

    # Process payment
    if payment_method == "rgdg":
        if listing.price_rgdg is None or listing.price_rgdg <= 0:
            raise MarketplaceError("No RGDG price set for this listing.")

        from app.services.token_service import InsufficientBalance, award_tokens, spend_tokens

        # Deduct from buyer
        try:
            await spend_tokens(
                db,
                user_id=buyer_id,
                tx_type="marketplace_purchase",
                amount=listing.price_rgdg,
                description=f"Marketplace purchase: {disc.mold} (listing #{listing.id})",
            )
        except InsufficientBalance:
            raise MarketplaceError(
                f"Insufficient $RGDG balance. This disc costs {listing.price_rgdg} RGDG."
            )

        # Credit seller
        await award_tokens(
            db,
            user_id=listing.seller_id,
            tx_type="marketplace_sale",
            amount=listing.price_rgdg,
            description=f"Marketplace sale: {disc.mold} (listing #{listing.id})",
            related_user_id=buyer_id,
        )

        sold_price = listing.price_rgdg
        logger.info(
            "Marketplace RGDG sale: buyer %d paid %s RGDG to seller %d for disc %d",
            buyer_id, listing.price_rgdg, listing.seller_id, disc.id,
        )

    elif payment_method == "cash":
        sold_price = listing.price_usd
        logger.info(
            "Marketplace cash sale: buyer %d purchasing disc %d from seller %d for $%s (arranged offline)",
            buyer_id, disc.id, listing.seller_id, listing.price_usd,
        )

    # Transfer disc ownership
    disc.owner_id = buyer_id
    disc.status = "active"  # Back to active now that it belongs to the buyer

    # Update listing
    listing.status = "sold"
    listing.buyer_id = buyer_id
    listing.sold_at = datetime.utcnow()
    listing.sold_price = sold_price
    listing.sold_currency = payment_method
    await db.flush()

    # If disc is an NFT, transfer on-chain (fire and forget)
    nft_transfer_initiated = False
    if disc.is_nft and disc.token_id:
        try:
            # Get buyer's wallet address
            buyer_result = await db.execute(
                select(User).where(User.id == buyer_id)
            )
            buyer = buyer_result.scalar_one_or_none()
            if buyer and buyer.wallet_address:
                from app.services.blockchain_service import transfer_disc_onchain
                transfer_disc_onchain(disc.token_id, buyer.wallet_address)
                nft_transfer_initiated = True
                logger.info(
                    "Initiated NFT transfer for disc token %d to %s",
                    disc.token_id, buyer.wallet_address,
                )
            else:
                logger.warning(
                    "Buyer %d has no wallet — NFT transfer for token %d skipped",
                    buyer_id, disc.token_id,
                )
        except Exception as exc:
            logger.error(
                "NFT transfer failed for disc token %d: %s (sale still completed)",
                disc.token_id, exc,
            )

    # Store nft_transfer_initiated on the listing object for the caller
    listing._nft_transfer_initiated = nft_transfer_initiated  # type: ignore[attr-defined]

    return listing


# ---------------------------------------------------------------------------
# Cancel listing
# ---------------------------------------------------------------------------


async def cancel_listing(
    db: AsyncSession,
    listing_id: int,
    seller_id: int,
) -> DiscListing:
    """Cancel a listing. Only the seller can cancel. Sets disc status back to 'active'."""
    listing_result = await db.execute(
        select(DiscListing).where(DiscListing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing is None:
        raise ListingNotFoundError("Listing not found.")

    if listing.seller_id != seller_id:
        raise NotSellerError("Only the seller can cancel this listing.")

    if listing.status != "active":
        raise ListingNotActiveError(
            f"Cannot cancel — listing status is '{listing.status}'."
        )

    listing.status = "cancelled"

    # Restore disc to active
    disc_result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.id == listing.disc_id)
    )
    disc = disc_result.scalar_one_or_none()
    if disc and disc.status == "listed":
        disc.status = "active"

    await db.flush()

    logger.info("User %d cancelled listing %d", seller_id, listing_id)

    return listing


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------


async def get_listing_detail(
    db: AsyncSession,
    listing_id: int,
) -> DiscListing | None:
    """Fetch a single listing with disc and seller loaded."""
    result = await db.execute(
        select(DiscListing).where(DiscListing.id == listing_id)
    )
    return result.scalar_one_or_none()


async def browse_listings(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    manufacturer: str | None = None,
    mold: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    condition: str | None = None,
    sort: str = "newest",
) -> tuple[list[DiscListing], int]:
    """Browse active marketplace listings with filters.

    Returns (listings, total_count).
    """
    base = select(DiscListing).where(DiscListing.status == "active")

    # Apply disc-level filters via a subquery join
    if manufacturer or mold:
        base = base.join(RegisteredDisc, DiscListing.disc_id == RegisteredDisc.id)
        if manufacturer:
            base = base.where(RegisteredDisc.manufacturer.ilike(f"%{manufacturer}%"))
        if mold:
            base = base.where(RegisteredDisc.mold.ilike(f"%{mold}%"))

    # Price filters (USD-based)
    if min_price is not None:
        base = base.where(DiscListing.price_usd >= min_price)
    if max_price is not None:
        base = base.where(DiscListing.price_usd <= max_price)

    if condition:
        base = base.where(DiscListing.condition == condition)

    # Count
    count_stmt = select(func.count()).select_from(base.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    # Sort
    if sort == "cheapest":
        base = base.order_by(DiscListing.price_usd.asc().nullslast())
    elif sort == "most_expensive":
        base = base.order_by(DiscListing.price_usd.desc().nullslast())
    else:  # newest
        base = base.order_by(DiscListing.created_at.desc())

    # Paginate
    offset = (page - 1) * per_page
    base = base.offset(offset).limit(per_page)

    result = await db.execute(base)
    listings = list(result.scalars().all())

    return listings, total


async def get_seller_listings(
    db: AsyncSession,
    seller_id: int,
    include_sold: bool = False,
) -> list[DiscListing]:
    """Get all listings for a seller."""
    stmt = select(DiscListing).where(DiscListing.seller_id == seller_id)
    if not include_sold:
        stmt = stmt.where(DiscListing.status == "active")
    stmt = stmt.order_by(DiscListing.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_buyer_purchases(
    db: AsyncSession,
    buyer_id: int,
) -> list[DiscListing]:
    """Get all completed purchases for a buyer."""
    stmt = (
        select(DiscListing)
        .where(
            DiscListing.buyer_id == buyer_id,
            DiscListing.status == "sold",
        )
        .order_by(DiscListing.sold_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
