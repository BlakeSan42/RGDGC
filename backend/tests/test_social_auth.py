"""Tests for social authentication (Google and Apple sign-in)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.social_auth import (
    get_or_create_apple_user,
    get_or_create_google_user,
    verify_apple_token,
    verify_google_token,
)
from tests.conftest import TestSession


# ── Fixtures ──


GOOGLE_USER_INFO = {
    "sub": "google-uid-12345",
    "email": "gplayer@gmail.com",
    "email_verified": True,
    "name": "Google Player",
    "picture": "https://lh3.googleusercontent.com/photo.jpg",
    "given_name": "Google",
    "family_name": "Player",
    "iss": "https://accounts.google.com",
    "aud": "test-google-client-id",
}

APPLE_USER_INFO = {
    "sub": "apple-uid-67890",
    "email": "applayer@icloud.com",
    "email_verified": True,
    "iss": "https://appleid.apple.com",
    "aud": "com.rgdgc.app",
}


# ── verify_google_token ──


@patch("app.services.social_auth.get_settings")
@patch("app.services.social_auth.google_id_token.verify_oauth2_token")
def test_verify_google_token_success(mock_verify, mock_settings):
    mock_settings.return_value.google_client_id = "test-google-client-id"
    mock_settings.return_value.google_ios_client_id = ""
    mock_verify.return_value = GOOGLE_USER_INFO.copy()

    result = verify_google_token("fake-google-token")

    assert result["sub"] == "google-uid-12345"
    assert result["email"] == "gplayer@gmail.com"
    mock_verify.assert_called_once()


@patch("app.services.social_auth.get_settings")
@patch("app.services.social_auth.google_id_token.verify_oauth2_token")
def test_verify_google_token_invalid_raises(mock_verify, mock_settings):
    mock_settings.return_value.google_client_id = "test-google-client-id"
    mock_settings.return_value.google_ios_client_id = ""
    mock_verify.side_effect = ValueError("Token expired")

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        verify_google_token("expired-token")
    assert exc_info.value.status_code == 401


@patch("app.services.social_auth.get_settings")
@patch("app.services.social_auth.google_id_token.verify_oauth2_token")
def test_verify_google_token_wrong_audience(mock_verify, mock_settings):
    mock_settings.return_value.google_client_id = "test-google-client-id"
    mock_settings.return_value.google_ios_client_id = ""

    bad_info = GOOGLE_USER_INFO.copy()
    bad_info["aud"] = "wrong-client-id"
    mock_verify.return_value = bad_info

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        verify_google_token("fake-token")
    assert exc_info.value.status_code == 401


@patch("app.services.social_auth.get_settings")
@patch("app.services.social_auth.google_id_token.verify_oauth2_token")
def test_verify_google_token_unverified_email(mock_verify, mock_settings):
    mock_settings.return_value.google_client_id = "test-google-client-id"
    mock_settings.return_value.google_ios_client_id = ""

    unverified = GOOGLE_USER_INFO.copy()
    unverified["email_verified"] = False
    mock_verify.return_value = unverified

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        verify_google_token("fake-token")
    assert exc_info.value.status_code == 403


# ── get_or_create_google_user ──


@pytest.mark.asyncio
async def test_google_new_user_creation(db: AsyncSession):
    user, is_new = await get_or_create_google_user(db, GOOGLE_USER_INFO)

    assert is_new is True
    assert user.email == "gplayer@gmail.com"
    assert user.google_id == "google-uid-12345"
    assert user.auth_provider == "google"
    assert user.display_name == "Google Player"
    assert user.avatar_url == "https://lh3.googleusercontent.com/photo.jpg"
    assert user.password_hash is None
    assert user.id is not None


@pytest.mark.asyncio
async def test_google_existing_user_by_google_id(db: AsyncSession):
    # Create user first
    user1, _ = await get_or_create_google_user(db, GOOGLE_USER_INFO)
    await db.commit()

    # Lookup by google_id
    user2, is_new = await get_or_create_google_user(db, GOOGLE_USER_INFO)
    assert is_new is False
    assert user2.id == user1.id


@pytest.mark.asyncio
async def test_google_existing_user_by_email_links_account(db: AsyncSession):
    # Create an email-based user first
    existing = User(
        email="gplayer@gmail.com",
        username="gplayer_email",
        password_hash="hashed",
        auth_provider="email",
    )
    db.add(existing)
    await db.flush()
    original_id = existing.id

    # Now sign in via Google with the same email
    user, is_new = await get_or_create_google_user(db, GOOGLE_USER_INFO)

    assert is_new is False
    assert user.id == original_id
    assert user.google_id == "google-uid-12345"
    # auth_provider stays as "email" (user has a password)
    assert user.auth_provider == "email"


# ── verify_apple_token ──


@pytest.mark.asyncio
@patch("app.services.social_auth._fetch_apple_public_keys")
async def test_verify_apple_token_invalid_format(mock_fetch):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await verify_apple_token("not-a-jwt", "com.rgdgc.app")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
@patch("app.services.social_auth._fetch_apple_public_keys")
async def test_verify_apple_token_unknown_kid(mock_fetch):
    """Token with a kid that doesn't match any Apple key should fail."""
    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend

    # Generate a throwaway RSA key
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )

    token = pyjwt.encode(
        {"sub": "apple-test", "iss": "https://appleid.apple.com"},
        private_key,
        algorithm="RS256",
        headers={"kid": "unknown-kid-123"},
    )

    # Return empty keys from Apple (kid not found)
    mock_fetch.return_value = {}

    from fastapi import HTTPException

    # Reset cached keys
    import app.services.social_auth as sa
    sa._apple_public_keys = None

    with pytest.raises(HTTPException) as exc_info:
        await verify_apple_token(token, "com.rgdgc.app")
    assert exc_info.value.status_code == 401


# ── get_or_create_apple_user ──


@pytest.mark.asyncio
async def test_apple_new_user_creation(db: AsyncSession):
    user, is_new = await get_or_create_apple_user(
        db, APPLE_USER_INFO, full_name="Apple Player"
    )

    assert is_new is True
    assert user.apple_id == "apple-uid-67890"
    assert user.email == "applayer@icloud.com"
    assert user.auth_provider == "apple"
    assert user.display_name == "Apple Player"
    assert user.password_hash is None
    assert user.id is not None


@pytest.mark.asyncio
async def test_apple_existing_user_by_apple_id(db: AsyncSession):
    user1, _ = await get_or_create_apple_user(db, APPLE_USER_INFO, full_name="Player")
    await db.commit()

    user2, is_new = await get_or_create_apple_user(db, APPLE_USER_INFO)
    assert is_new is False
    assert user2.id == user1.id


@pytest.mark.asyncio
async def test_apple_existing_user_by_email_links_account(db: AsyncSession):
    existing = User(
        email="applayer@icloud.com",
        username="applayer_email",
        password_hash="hashed",
        auth_provider="email",
    )
    db.add(existing)
    await db.flush()
    original_id = existing.id

    user, is_new = await get_or_create_apple_user(db, APPLE_USER_INFO, full_name="Apple Player")

    assert is_new is False
    assert user.id == original_id
    assert user.apple_id == "apple-uid-67890"


@pytest.mark.asyncio
async def test_apple_user_without_email_uses_relay(db: AsyncSession):
    """When Apple hides the email, a relay address is generated."""
    info_no_email = {"sub": "apple-private-user"}
    user, is_new = await get_or_create_apple_user(db, info_no_email, full_name="Private User")

    assert is_new is True
    assert "privaterelay.appleid.com" in user.email
    assert user.apple_id == "apple-private-user"


# ── Auth endpoints (integration) ──


@pytest.mark.asyncio
@patch("app.api.v1.auth.verify_google_token")
async def test_google_auth_endpoint_success(mock_verify, client: AsyncClient):
    mock_verify.return_value = GOOGLE_USER_INFO.copy()

    res = await client.post("/api/v1/auth/google", json={"id_token": "fake-google-token"})

    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["is_new_user"] is True
    assert data["user"]["email"] == "gplayer@gmail.com"


@pytest.mark.asyncio
@patch("app.api.v1.auth.verify_google_token")
async def test_google_auth_endpoint_returning_user(mock_verify, client: AsyncClient):
    mock_verify.return_value = GOOGLE_USER_INFO.copy()

    # First call creates user
    await client.post("/api/v1/auth/google", json={"id_token": "token1"})

    # Second call finds existing user
    res = await client.post("/api/v1/auth/google", json={"id_token": "token2"})
    assert res.status_code == 200
    assert res.json()["is_new_user"] is False


@pytest.mark.asyncio
@patch("app.api.v1.auth.verify_google_token")
async def test_google_auth_endpoint_invalid_token(mock_verify, client: AsyncClient):
    from fastapi import HTTPException

    mock_verify.side_effect = HTTPException(status_code=401, detail="Invalid token")

    res = await client.post("/api/v1/auth/google", json={"id_token": "bad-token"})
    assert res.status_code == 401


@pytest.mark.asyncio
@patch("app.api.v1.auth.verify_apple_token")
async def test_apple_auth_endpoint_success(mock_verify, client: AsyncClient):
    mock_verify.return_value = APPLE_USER_INFO.copy()

    res = await client.post(
        "/api/v1/auth/apple",
        json={
            "id_token": "fake-apple-token",
            "full_name": "Apple Player",
        },
    )

    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["is_new_user"] is True
    assert data["user"]["email"] == "applayer@icloud.com"


@pytest.mark.asyncio
@patch("app.api.v1.auth.verify_apple_token")
async def test_apple_auth_endpoint_invalid_token(mock_verify, client: AsyncClient):
    from fastapi import HTTPException

    mock_verify.side_effect = HTTPException(status_code=401, detail="Invalid Apple token")

    res = await client.post(
        "/api/v1/auth/apple",
        json={"id_token": "bad-token"},
    )
    assert res.status_code == 401
