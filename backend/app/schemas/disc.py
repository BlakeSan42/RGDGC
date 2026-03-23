"""Pydantic v2 schemas for disc registration and NFT tracking."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Input schemas ---


class DiscRegister(BaseModel):
    """Input schema for registering a new disc."""

    mold: str = Field(..., min_length=1, max_length=100, description="Disc mold name (e.g. Destroyer, Buzzz)")
    manufacturer: str | None = Field(None, max_length=100, description="Disc manufacturer (e.g. Innova, Discraft)")
    plastic: str | None = Field(None, max_length=100, description="Plastic type (e.g. Star, ESP)")
    weight_grams: int | None = Field(None, ge=100, le=200, description="Disc weight in grams")
    color: str | None = Field(None, max_length=50, description="Primary disc color")
    notes: str | None = Field(None, max_length=500, description="Optional notes about the disc")


class DiscFoundCreate(BaseModel):
    """Input schema for reporting a found disc."""

    finder_name: str = Field(..., min_length=1, max_length=100, description="Name of the person who found the disc")
    finder_contact: str | None = Field(None, max_length=200, description="Phone, email, or social handle")
    found_location: str | None = Field(None, max_length=300, description="Where the disc was found")
    found_lat: float | None = Field(None, ge=-90, le=90, description="Latitude of find location")
    found_lng: float | None = Field(None, ge=-180, le=180, description="Longitude of find location")
    message: str | None = Field(None, max_length=1000, description="Message for the disc owner")


class DiscMessageCreate(BaseModel):
    """Input schema for sending a message about a disc."""

    message: str = Field(..., min_length=1, max_length=1000, description="Message text")
    sender_name: str | None = Field(None, max_length=100, description="Sender display name (for anonymous users)")


# --- Response schemas ---


class DiscResponse(BaseModel):
    """Full disc detail response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    disc_code: str
    owner_id: int
    owner_display_name: str | None = None
    manufacturer: str | None
    mold: str
    plastic: str | None
    weight_grams: int | None
    color: str | None
    photo_url: str | None
    status: str
    notes: str | None
    is_nft: bool = False
    token_id: int | None = None
    tx_hash: str | None = None
    registered_at: datetime
    updated_at: datetime


class DiscPublicResponse(BaseModel):
    """Limited disc info for public QR scan lookup (no sensitive owner data)."""

    model_config = ConfigDict(from_attributes=True)

    disc_code: str
    manufacturer: str | None
    mold: str
    plastic: str | None
    color: str | None
    status: str
    owner_display_name: str | None = None


class DiscFoundResponse(BaseModel):
    """Response for a found-disc report."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    disc_id: int
    finder_name: str
    finder_contact: str | None
    found_location: str | None
    found_lat: float | None
    found_lng: float | None
    message: str | None
    found_at: datetime
    resolved: bool
    resolved_at: datetime | None


class DiscMessageResponse(BaseModel):
    """Response for a disc message."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    disc_id: int
    sender_user_id: int | None
    sender_name: str
    message: str
    created_at: datetime


class DiscQRResponse(BaseModel):
    """Response containing QR code data for a registered disc."""

    disc_code: str
    qr_svg: str
    qr_url: str
