from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    username: str | None = Field(None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    phone: str | None = Field(None, max_length=20)
    bio: str | None = Field(None, max_length=500)
    avatar_url: str | None = Field(None, max_length=500, pattern=r"^(https?://|/uploads/).+")


class UserPublicOut(BaseModel):
    """Safe for returning to other users — no email, phone, or PII."""
    id: int
    username: str
    display_name: str | None
    avatar_url: str | None
    role: str
    handicap: float | None

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    """Full profile — only return for the user's own /me endpoint."""
    id: int
    email: str
    username: str
    display_name: str | None
    phone: str | None = None
    bio: str | None = None
    avatar_url: str | None
    role: str
    handicap: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DeleteAccountRequest(BaseModel):
    password: str


class PushTokenRequest(BaseModel):
    token: str
    platform: str  # "ios" or "android"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    id_token: str  # Google ID token from mobile/web client


class AppleAuthRequest(BaseModel):
    id_token: str
    authorization_code: str | None = None
    full_name: str | None = None  # Apple only sends name on first login


class SocialAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user: UserOut
