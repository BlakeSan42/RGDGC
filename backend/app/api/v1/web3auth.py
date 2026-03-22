"""
Web3 wallet authentication endpoints.

Flow:
1. Client calls POST /auth/web3/nonce with their wallet address.
2. Backend returns a nonce message to sign.
3. Client signs the message with their wallet (MetaMask / WalletConnect).
4. Client calls POST /auth/web3/verify with the signature.
5. Backend verifies the signature, finds or creates the user, returns JWT tokens.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, create_refresh_token
from app.db.database import get_db
from app.models.user import User
from app.schemas.blockchain import (
    WalletNonceRequest,
    WalletNonceResponse,
    WalletVerifyRequest,
)
from app.schemas.user import SocialAuthResponse, UserOut
from app.services.blockchain_service import (
    BlockchainUnavailableError,
    generate_nonce,
    is_valid_address,
    verify_wallet_signature,
)

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address, enabled=get_settings().environment != "testing")

# In-memory nonce store. In production, use Redis with TTL.
# Keys: lowercase wallet address -> nonce string
_nonce_store: dict[str, str] = {}


@router.post("/web3/nonce", response_model=WalletNonceResponse)
@limiter.limit("20/minute")
async def web3_nonce(request: Request, data: WalletNonceRequest):
    """Generate a nonce message for the wallet to sign.

    The client should call personal_sign with the returned message.
    """
    if not is_valid_address(data.wallet_address):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Ethereum address.",
        )

    nonce = generate_nonce()
    address_lower = data.wallet_address.lower()
    _nonce_store[address_lower] = nonce

    message = (
        f"Sign this message to log in to River Grove Disc Golf Club.\n\n"
        f"Nonce: {nonce}\n"
        f"Wallet: {data.wallet_address}"
    )

    return WalletNonceResponse(nonce=nonce, message=message)


@router.post("/web3/verify", response_model=SocialAuthResponse)
@limiter.limit("10/minute")
async def web3_verify(
    request: Request,
    data: WalletVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify wallet signature and return JWT tokens.

    Creates a new user account if the wallet address is not yet registered.
    """
    address_lower = data.wallet_address.lower()

    # Validate nonce
    stored_nonce = _nonce_store.get(address_lower)
    if not stored_nonce or stored_nonce != data.nonce:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired nonce. Request a new one.",
        )

    # Build the same message that was returned by /nonce
    message = (
        f"Sign this message to log in to River Grove Disc Golf Club.\n\n"
        f"Nonce: {data.nonce}\n"
        f"Wallet: {data.wallet_address}"
    )

    # Verify signature
    try:
        valid = verify_wallet_signature(data.wallet_address, message, data.signature)
    except BlockchainUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Signature verification unavailable: {exc}",
        )

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature verification failed.",
        )

    # Consume the nonce (single use)
    _nonce_store.pop(address_lower, None)

    # Find or create user by wallet address
    result = await db.execute(
        select(User).where(User.wallet_address == data.wallet_address)
    )
    user = result.scalar_one_or_none()
    is_new_user = False

    if user is None:
        # Create a new user with wallet-based auth
        short_addr = f"{data.wallet_address[:6]}...{data.wallet_address[-4:]}"
        user = User(
            email=f"{address_lower}@wallet.rgdgc.com",  # Placeholder email
            username=f"player_{data.wallet_address[-8:].lower()}",
            wallet_address=data.wallet_address,
            auth_provider="web3",
            display_name=short_addr,
        )
        db.add(user)
        await db.flush()
        is_new_user = True
        logger.info("Created new user via Web3 auth: %s", data.wallet_address)
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled.",
            )

    return SocialAuthResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        is_new_user=is_new_user,
        user=UserOut.model_validate(user),
    )
