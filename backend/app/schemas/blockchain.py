from datetime import datetime

from pydantic import BaseModel, Field


# --- Web3 Auth ---

class WalletNonceRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$", description="Ethereum wallet address")


class WalletNonceResponse(BaseModel):
    nonce: str
    message: str  # The full message to sign


class WalletVerifyRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    signature: str = Field(..., description="Hex-encoded signature from wallet")
    nonce: str


# --- Token Balance ---

class TokenBalanceResponse(BaseModel):
    wallet_address: str
    balance: float
    symbol: str = "RGDG"


# --- Pay Fee ---

class PayFeeRequest(BaseModel):
    event_id: int
    tx_hash: str = Field(..., pattern=r"^0x[a-fA-F0-9]{64}$", description="Transaction hash")


class PayFeeResponse(BaseModel):
    verified: bool
    event_id: int
    amount: float
    tx_hash: str
    message: str


# --- Transaction ---

class TransactionResponse(BaseModel):
    id: int
    tx_type: str
    amount: float
    tx_hash: str | None
    status: str
    event_id: int | None
    from_address: str | None
    to_address: str | None
    block_number: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    transactions: list[TransactionResponse]
    total: int
    page: int
    per_page: int


# --- Treasury ---

class TreasuryStatsResponse(BaseModel):
    treasury_address: str
    balance: float
    total_collected: float
    total_distributed: float
    event_fee: float
    recent_transactions: list[TransactionResponse]
