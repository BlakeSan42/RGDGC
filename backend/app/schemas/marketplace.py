"""Pydantic v2 schemas for the disc marketplace."""

from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DiscCondition(str, Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    fair = "fair"
    beat = "beat"


class PaymentMethod(str, Enum):
    cash = "cash"
    rgdg = "rgdg"


class ListingSortBy(str, Enum):
    newest = "newest"
    cheapest = "cheapest"
    most_expensive = "most_expensive"


# --- Input schemas ---


class CreateListingRequest(BaseModel):
    """Create a new marketplace listing."""

    disc_id: int = Field(..., description="ID of the registered disc to list")
    price_usd: Decimal | None = Field(None, ge=0, le=99999, description="Cash price in USD")
    price_rgdg: Decimal | None = Field(None, ge=0, le=999999, description="Token price in $RGDG")
    condition: DiscCondition = Field(..., description="Disc condition: new, like_new, good, fair, beat")
    description: str | None = Field(None, max_length=2000, description="Listing description")
    accepts_cash: bool = Field(True, description="Accept USD cash payment")
    accepts_rgdg: bool = Field(True, description="Accept $RGDG token payment")
    accepts_trade: bool = Field(False, description="Accept disc trades")
    photos: list[str] | None = Field(None, max_length=10, description="Photo URLs (max 10)")

    @model_validator(mode="after")
    def validate_pricing(self):
        """Ensure at least one price is set for accepted payment methods."""
        if self.accepts_cash and self.price_usd is None:
            raise ValueError("price_usd is required when accepts_cash is true")
        if self.accepts_rgdg and self.price_rgdg is None:
            raise ValueError("price_rgdg is required when accepts_rgdg is true")
        if not self.accepts_cash and not self.accepts_rgdg and not self.accepts_trade:
            raise ValueError("Listing must accept at least one payment method")
        return self


class UpdateListingRequest(BaseModel):
    """Update an existing marketplace listing."""

    price_usd: Decimal | None = Field(None, ge=0, le=99999)
    price_rgdg: Decimal | None = Field(None, ge=0, le=999999)
    condition: DiscCondition | None = None
    description: str | None = Field(None, max_length=2000)
    accepts_cash: bool | None = None
    accepts_rgdg: bool | None = None
    accepts_trade: bool | None = None
    photos: list[str] | None = Field(None, max_length=10)


class BuyDiscRequest(BaseModel):
    """Purchase a listed disc."""

    payment_method: PaymentMethod = Field(..., description="How to pay: 'rgdg' or 'cash'")


# --- Response schemas ---


class DiscSummary(BaseModel):
    """Abbreviated disc info embedded in listing responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    disc_code: str
    manufacturer: str | None
    mold: str
    plastic: str | None
    weight_grams: int | None
    color: str | None
    photo_url: str | None
    is_nft: bool = False


class SellerSummary(BaseModel):
    """Public seller info embedded in listing responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str | None
    avatar_url: str | None


class ListingResponse(BaseModel):
    """Full marketplace listing response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    disc_id: int
    seller_id: int
    price_usd: Decimal | None
    price_rgdg: Decimal | None
    accepts_cash: bool
    accepts_rgdg: bool
    accepts_trade: bool
    condition: str
    description: str | None
    photos: list[str] | None
    status: str
    buyer_id: int | None = None
    sold_at: datetime | None = None
    sold_price: Decimal | None = None
    sold_currency: str | None = None
    created_at: datetime
    updated_at: datetime

    # Embedded related objects
    disc: DiscSummary | None = None
    seller: SellerSummary | None = None


class ListingListResponse(BaseModel):
    """Paginated listing results."""

    listings: list[ListingResponse]
    total: int
    page: int
    per_page: int


class BuyDiscResponse(BaseModel):
    """Response after purchasing a disc."""

    listing_id: int
    disc_id: int
    payment_method: str
    amount_paid: Decimal | None = None
    currency: str
    nft_transfer_initiated: bool = False
    message: str
