"""
Disc marketplace API — browse, list, buy, and trade discs.

Level 3 feature enabling peer-to-peer disc trading with $RGDG token
integration and automatic NFT transfer for on-chain discs.

Endpoints:
    GET    /marketplace                    — Browse listings (paginated, filterable)
    GET    /marketplace/{listing_id}       — Listing detail
    POST   /marketplace                    — Create listing (auth, must own disc)
    PUT    /marketplace/{listing_id}       — Update listing (seller only)
    DELETE /marketplace/{listing_id}       — Cancel listing (seller only)
    POST   /marketplace/{listing_id}/buy   — Buy a disc
    GET    /marketplace/my-listings        — Seller's active listings
    GET    /marketplace/my-purchases       — Buyer's purchase history
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.disc import RegisteredDisc
from app.models.marketplace import DiscListing
from app.models.user import User
from app.schemas.marketplace import (
    BuyDiscRequest,
    BuyDiscResponse,
    CreateListingRequest,
    DiscCondition,
    DiscSummary,
    ListingListResponse,
    ListingResponse,
    ListingSortBy,
    SellerSummary,
    UpdateListingRequest,
)
from app.services.marketplace_service import (
    CannotBuyOwnDiscError,
    DiscNotAvailableError,
    DiscNotOwnedError,
    ListingNotActiveError,
    ListingNotFoundError,
    MarketplaceError,
    NotSellerError,
    PaymentMethodNotAcceptedError,
    browse_listings,
    buy_disc,
    cancel_listing,
    create_listing,
    get_buyer_purchases,
    get_listing_detail,
    get_seller_listings,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _enrich_listing(db: AsyncSession, listing: DiscListing) -> ListingResponse:
    """Build a ListingResponse with embedded disc and seller summaries."""
    # Fetch disc
    disc_summary = None
    disc_result = await db.execute(
        select(RegisteredDisc).where(RegisteredDisc.id == listing.disc_id)
    )
    disc = disc_result.scalar_one_or_none()
    if disc:
        disc_summary = DiscSummary(
            id=disc.id,
            disc_code=disc.disc_code,
            manufacturer=disc.manufacturer,
            mold=disc.mold,
            plastic=disc.plastic,
            weight_grams=disc.weight_grams,
            color=disc.color,
            photo_url=disc.photo_url,
            is_nft=disc.is_nft,
        )

    # Fetch seller
    seller_summary = None
    seller_result = await db.execute(
        select(User).where(User.id == listing.seller_id)
    )
    seller = seller_result.scalar_one_or_none()
    if seller:
        seller_summary = SellerSummary(
            id=seller.id,
            username=seller.username,
            display_name=seller.display_name,
            avatar_url=seller.avatar_url,
        )

    return ListingResponse(
        id=listing.id,
        disc_id=listing.disc_id,
        seller_id=listing.seller_id,
        price_usd=listing.price_usd,
        price_rgdg=listing.price_rgdg,
        accepts_cash=listing.accepts_cash,
        accepts_rgdg=listing.accepts_rgdg,
        accepts_trade=listing.accepts_trade,
        condition=listing.condition,
        description=listing.description,
        photos=listing.photos,
        status=listing.status,
        buyer_id=listing.buyer_id,
        sold_at=listing.sold_at,
        sold_price=listing.sold_price,
        sold_currency=listing.sold_currency,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        disc=disc_summary,
        seller=seller_summary,
    )


# ---------------------------------------------------------------------------
# Browse & detail (public-ish, but require auth for consistency)
# ---------------------------------------------------------------------------


@router.get("", response_model=ListingListResponse)
async def browse_marketplace(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    manufacturer: str | None = Query(None, description="Filter by disc manufacturer"),
    mold: str | None = Query(None, description="Filter by disc mold"),
    min_price: float | None = Query(None, ge=0, description="Min USD price"),
    max_price: float | None = Query(None, ge=0, description="Max USD price"),
    condition: DiscCondition | None = Query(None, description="Filter by condition"),
    sort: ListingSortBy = Query(ListingSortBy.newest, description="Sort order"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Browse active marketplace listings with optional filters."""
    listings, total = await browse_listings(
        db,
        page=page,
        per_page=per_page,
        manufacturer=manufacturer,
        mold=mold,
        min_price=min_price,
        max_price=max_price,
        condition=condition.value if condition else None,
        sort=sort.value,
    )

    enriched = [await _enrich_listing(db, lst) for lst in listings]

    return ListingListResponse(
        listings=enriched,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/my-listings", response_model=list[ListingResponse])
async def my_listings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all of the authenticated player's active marketplace listings."""
    listings = await get_seller_listings(db, user.id)
    return [await _enrich_listing(db, lst) for lst in listings]


@router.get("/my-purchases", response_model=list[ListingResponse])
async def my_purchases(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the authenticated player's marketplace purchase history."""
    listings = await get_buyer_purchases(db, user.id)
    return [await _enrich_listing(db, lst) for lst in listings]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific marketplace listing."""
    listing = await get_listing_detail(db, listing_id)
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )
    return await _enrich_listing(db, listing)


# ---------------------------------------------------------------------------
# Create, update, delete
# ---------------------------------------------------------------------------


@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_marketplace_listing(
    data: CreateListingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new marketplace listing. You must own the disc."""
    try:
        listing = await create_listing(
            db,
            seller_id=user.id,
            disc_id=data.disc_id,
            price_usd=data.price_usd,
            price_rgdg=data.price_rgdg,
            condition=data.condition.value,
            description=data.description,
            accepts_cash=data.accepts_cash,
            accepts_rgdg=data.accepts_rgdg,
            accepts_trade=data.accepts_trade,
            photos=data.photos,
        )
    except DiscNotOwnedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )
    except DiscNotAvailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return await _enrich_listing(db, listing)


@router.put("/{listing_id}", response_model=ListingResponse)
async def update_marketplace_listing(
    listing_id: int,
    data: UpdateListingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a marketplace listing. Seller only."""
    listing_result = await db.execute(
        select(DiscListing).where(DiscListing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )

    if listing.seller_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller can update this listing.",
        )

    if listing.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot update — listing status is '{listing.status}'.",
        )

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "condition" and value is not None:
            value = value.value if hasattr(value, "value") else value
        setattr(listing, field, value)

    await db.flush()
    return await _enrich_listing(db, listing)


@router.delete("/{listing_id}", status_code=status.HTTP_200_OK)
async def delete_marketplace_listing(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a marketplace listing. Seller only. Disc returns to active status."""
    try:
        listing = await cancel_listing(db, listing_id, user.id)
    except ListingNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )
    except NotSellerError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller can cancel this listing.",
        )
    except ListingNotActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    return {"message": "Listing cancelled.", "listing_id": listing.id}


# ---------------------------------------------------------------------------
# Buy
# ---------------------------------------------------------------------------


@router.post("/{listing_id}/buy", response_model=BuyDiscResponse)
async def buy_marketplace_disc(
    listing_id: int,
    data: BuyDiscRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buy a disc from the marketplace.

    - **rgdg**: Tokens are deducted from your balance and credited to the seller.
    - **cash**: The listing is marked sold; arrange payment with the seller offline.

    If the disc is an NFT and you have a linked wallet, the on-chain transfer
    is initiated automatically.
    """
    try:
        listing = await buy_disc(
            db,
            listing_id=listing_id,
            buyer_id=user.id,
            payment_method=data.payment_method.value,
        )
    except ListingNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found.",
        )
    except ListingNotActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except CannotBuyOwnDiscError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot buy your own disc.",
        )
    except PaymentMethodNotAcceptedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except MarketplaceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    nft_transfer = getattr(listing, "_nft_transfer_initiated", False)

    if data.payment_method.value == "rgdg":
        message = f"Purchase complete! {listing.sold_price} $RGDG has been transferred to the seller."
    else:
        message = "Purchase recorded. Please arrange payment with the seller."

    if nft_transfer:
        message += " NFT ownership transfer has been initiated on-chain."

    return BuyDiscResponse(
        listing_id=listing.id,
        disc_id=listing.disc_id,
        payment_method=data.payment_method.value,
        amount_paid=listing.sold_price,
        currency=listing.sold_currency or data.payment_method.value,
        nft_transfer_initiated=nft_transfer,
        message=message,
    )
