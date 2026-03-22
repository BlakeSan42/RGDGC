"""Social authentication service for Google and Apple sign-in."""

import logging
from typing import Any

import httpx
import jwt as pyjwt
from jwt.algorithms import RSAAlgorithm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

# Cache Apple's public keys for performance (refreshed on key rotation)
_apple_public_keys: dict[str, Any] | None = None


def verify_google_token(token: str) -> dict[str, Any]:
    """Verify a Google ID token and return the decoded user info.

    Accepts tokens issued for the web client ID or the iOS client ID.
    Raises HTTPException on any verification failure.

    Returns dict with keys: sub, email, email_verified, name, picture, given_name, family_name.
    """
    settings = get_settings()

    # Accept tokens minted for either the web or iOS client ID
    allowed_client_ids = [
        cid for cid in [settings.google_client_id, settings.google_ios_client_id] if cid
    ]
    if not allowed_client_ids:
        logger.error("Google OAuth client IDs not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google authentication is not configured",
        )

    # google-auth verifies signature, expiry, issuer, and audience in one call
    try:
        id_info = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=None,  # We check audience manually to support multiple client IDs
        )
    except ValueError as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token",
        )

    # Verify the audience matches one of our client IDs
    token_audience = id_info.get("aud")
    if token_audience not in allowed_client_ids:
        logger.warning(
            "Google token audience mismatch: got %s, expected one of %s",
            token_audience,
            allowed_client_ids,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token was not issued for this application",
        )

    # Verify the issuer
    if id_info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token issuer",
        )

    # Email must be verified by Google
    if not id_info.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google email is not verified",
        )

    return id_info


async def get_or_create_google_user(
    db: AsyncSession,
    google_info: dict[str, Any],
) -> tuple[User, bool]:
    """Find or create a user from verified Google token info.

    Account linking logic:
    1. If a user with this google_id already exists -> return that user.
    2. If a user with the same email exists -> link the google_id to that account.
    3. Otherwise -> create a brand-new user.

    Returns (user, is_new_user).
    """
    google_id: str = google_info["sub"]
    email: str = google_info["email"]
    name: str = google_info.get("name", "")
    picture: str | None = google_info.get("picture")

    # 1. Lookup by google_id (fastest, indexed unique column)
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if user:
        # Update avatar if it changed and user hasn't set a custom one
        if picture and not user.avatar_url:
            user.avatar_url = picture
        return user, False

    # 2. Lookup by email — link accounts
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.google_id = google_id
        # Keep existing auth_provider if it was already set to something meaningful,
        # but record that Google is now linked.  If user originally signed up via
        # email, we leave auth_provider as "email" since they have a password too.
        if not user.avatar_url and picture:
            user.avatar_url = picture
        logger.info("Linked Google account %s to existing user %s (email match)", google_id, user.id)
        return user, False

    # 3. Create new user
    # Generate a unique username from the email local part
    base_username = email.split("@")[0][:40]  # Truncate to leave room for suffix
    username = base_username

    # Ensure username uniqueness
    for suffix in range(1, 100):
        existing = await db.execute(select(User.id).where(User.username == username))
        if not existing.scalar_one_or_none():
            break
        username = f"{base_username}{suffix}"
    else:
        # Extremely unlikely: 99 collisions
        import uuid
        username = f"{base_username}_{uuid.uuid4().hex[:6]}"

    user = User(
        email=email,
        username=username,
        display_name=name or base_username,
        avatar_url=picture,
        auth_provider="google",
        google_id=google_id,
        password_hash=None,  # Social-only accounts have no password
    )
    db.add(user)
    await db.flush()  # Populate user.id

    logger.info("Created new user %s via Google OAuth (google_id=%s)", user.id, google_id)
    return user, True


# ── Apple Sign-In ──


async def _fetch_apple_public_keys() -> dict[str, Any]:
    """Fetch Apple's public keys from their JWKS endpoint.

    Keys are cached in-memory and refreshed if a kid is not found.
    """
    global _apple_public_keys
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://appleid.apple.com/auth/keys")
        resp.raise_for_status()
        keys_data = resp.json()
    _apple_public_keys = {key["kid"]: key for key in keys_data["keys"]}
    return _apple_public_keys


async def verify_apple_token(id_token: str, client_id: str) -> dict[str, Any]:
    """Verify an Apple ID token and return decoded user info.

    Fetches Apple's JWKS public keys, decodes the JWT, and verifies
    signature, audience, issuer, and expiry.

    Returns dict with keys: sub (apple_id), email, email_verified.
    """
    global _apple_public_keys

    # Decode the header to get the key ID
    try:
        unverified_header = pyjwt.get_unverified_header(id_token)
    except pyjwt.exceptions.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple token format",
        )

    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple token missing key ID",
        )

    # Fetch keys if not cached, or if kid not found (key rotation)
    if _apple_public_keys is None or kid not in _apple_public_keys:
        try:
            _apple_public_keys = await _fetch_apple_public_keys()
        except httpx.HTTPError as exc:
            logger.error("Failed to fetch Apple public keys: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not verify Apple token — key fetch failed",
            )

    apple_key = _apple_public_keys.get(kid)
    if not apple_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple token signed with unknown key",
        )

    # Build the RSA public key from the JWK
    public_key = RSAAlgorithm.from_jwk(apple_key)

    # Verify and decode the token
    try:
        decoded = pyjwt.decode(
            id_token,
            key=public_key,
            algorithms=["RS256"],
            audience=client_id,
            issuer="https://appleid.apple.com",
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple token has expired",
        )
    except pyjwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple token was not issued for this application",
        )
    except pyjwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple token issuer",
        )
    except pyjwt.InvalidTokenError as exc:
        logger.warning("Apple token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Apple token",
        )

    return decoded


async def get_or_create_apple_user(
    db: AsyncSession,
    apple_info: dict[str, Any],
    full_name: str | None = None,
) -> tuple[User, bool]:
    """Find or create a user from verified Apple token info.

    Account linking logic:
    1. If a user with this apple_id already exists -> return that user.
    2. If email is available and a user with that email exists -> link apple_id.
    3. Otherwise -> create a brand-new user.

    Note: Apple only sends the email on the *first* authorization. After that,
    the apple_id (sub claim) is the only reliable identifier.

    Returns (user, is_new_user).
    """
    apple_id: str = apple_info["sub"]
    email: str | None = apple_info.get("email")

    # 1. Lookup by apple_id (primary key for Apple users)
    result = await db.execute(select(User).where(User.apple_id == apple_id))
    user = result.scalar_one_or_none()
    if user:
        # Update display name if provided and user hasn't set one
        if full_name and not user.display_name:
            user.display_name = full_name
        return user, False

    # 2. Lookup by email — link accounts (only if Apple provided the email)
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.apple_id = apple_id
            if full_name and not user.display_name:
                user.display_name = full_name
            logger.info("Linked Apple account %s to existing user %s (email match)", apple_id, user.id)
            return user, False

    # 3. Create new user
    if not email:
        # Apple privatized the email — use a placeholder
        # The user can update their email later in profile settings
        email = f"{apple_id}@privaterelay.appleid.com"

    base_username = email.split("@")[0][:40]
    username = base_username

    # Ensure username uniqueness
    for suffix in range(1, 100):
        existing = await db.execute(select(User.id).where(User.username == username))
        if not existing.scalar_one_or_none():
            break
        username = f"{base_username}{suffix}"
    else:
        import uuid
        username = f"{base_username}_{uuid.uuid4().hex[:6]}"

    user = User(
        email=email,
        username=username,
        display_name=full_name or base_username,
        auth_provider="apple",
        apple_id=apple_id,
        password_hash=None,  # Social-only accounts have no password
    )
    db.add(user)
    await db.flush()

    logger.info("Created new user %s via Apple Sign-In (apple_id=%s)", user.id, apple_id)
    return user, True
