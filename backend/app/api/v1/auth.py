from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    AppleAuthRequest,
    GoogleAuthRequest,
    RefreshRequest,
    SocialAuthResponse,
    TokenResponse,
    UserLogin,
    UserOut,
    UserRegister,
    UserUpdate,
)
from app.services.social_auth import (
    get_or_create_apple_user,
    get_or_create_google_user,
    verify_apple_token,
    verify_google_token,
)

from jose import JWTError, jwt

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check existing
    existing = await db.execute(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or username already registered")

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    await db.flush()

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    try:
        payload = jwt.decode(data.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/google", response_model=SocialAuthResponse)
async def google_auth(request: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google. Works for both login and registration.

    Flow:
    1. Mobile/web client obtains a Google ID token via Google Sign-In SDK.
    2. Client sends the ID token to this endpoint.
    3. Backend verifies the token with Google, finds or creates the user,
       and returns RGDGC JWT tokens.
    """
    google_info = verify_google_token(request.id_token)
    user, is_new_user = await get_or_create_google_user(db, google_info)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return SocialAuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new_user,
        user=UserOut.model_validate(user),
    )


@router.post("/apple", response_model=SocialAuthResponse)
async def apple_auth(request: AppleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Apple Sign-In. Works for both login and registration.

    Flow:
    1. Mobile client obtains an Apple ID token via Apple Sign-In SDK.
    2. Client sends the ID token (and optionally full_name) to this endpoint.
    3. Backend verifies the token with Apple's JWKS, finds or creates the user,
       and returns RGDGC JWT tokens.

    Note: Apple only provides the user's name on the *first* authorization.
    The client should capture and send it via the full_name field.
    """
    settings = get_settings()
    apple_info = await verify_apple_token(request.id_token, settings.apple_client_id)
    user, is_new_user = await get_or_create_apple_user(db, apple_info, request.full_name)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    return SocialAuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new_user,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.phone is not None:
        user.phone = data.phone
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url

    await db.flush()
    return UserOut.model_validate(user)
