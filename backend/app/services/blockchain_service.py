"""
Web3 service for interacting with RGDGC smart contracts.

Handles:
- RGDGToken (ERC-20): balance queries
- RGDGTreasury: event fees, treasury balance
- Wallet signature verification for Web3 auth
- Transaction receipt lookups

All web3 calls are wrapped in try/except for graceful degradation
when the RPC endpoint is unavailable or not configured.
"""

import logging
import secrets
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
#  Minimal ABIs — only the functions we actually call from the backend.
#  This avoids needing the full Hardhat artifact JSON files at runtime.
# ---------------------------------------------------------------------------

ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

TREASURY_ABI = [
    {
        "inputs": [],
        "name": "treasuryBalance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "eventFee",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "rgdgToken",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    # FeePaid event for verifying payments
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "player", "type": "address"},
            {"indexed": False, "name": "amount", "type": "uint256"},
            {"indexed": False, "name": "timestamp", "type": "uint256"},
        ],
        "name": "FeePaid",
        "type": "event",
    },
]

# ---------------------------------------------------------------------------
#  Module-level cached state
# ---------------------------------------------------------------------------

_w3 = None
_token_contract = None
_treasury_contract = None


class BlockchainUnavailableError(Exception):
    """Raised when the blockchain RPC or contracts are not configured/reachable."""
    pass


# ---------------------------------------------------------------------------
#  Initialization helpers
# ---------------------------------------------------------------------------

def _get_web3():
    """Lazily initialise and return a Web3 instance."""
    global _w3
    if _w3 is not None:
        return _w3

    settings = get_settings()
    if not settings.web3_provider_url:
        raise BlockchainUnavailableError("web3_provider_url is not configured")

    try:
        from web3 import Web3
        _w3 = Web3(Web3.HTTPProvider(settings.web3_provider_url))
        if not _w3.is_connected():
            _w3 = None
            raise BlockchainUnavailableError(
                f"Cannot connect to Web3 provider at {settings.web3_provider_url}"
            )
        logger.info("Web3 connected to %s (chain %s)", settings.web3_provider_url, _w3.eth.chain_id)
        return _w3
    except ImportError:
        raise BlockchainUnavailableError("web3 package is not installed. Run: pip install web3")
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        _w3 = None
        raise BlockchainUnavailableError(f"Web3 initialization failed: {exc}") from exc


def _get_token_contract():
    """Return cached RGDGToken contract instance."""
    global _token_contract
    if _token_contract is not None:
        return _token_contract

    settings = get_settings()
    if not settings.rgdg_token_address:
        raise BlockchainUnavailableError("rgdg_token_address is not configured")

    w3 = _get_web3()
    _token_contract = w3.eth.contract(
        address=w3.to_checksum_address(settings.rgdg_token_address),
        abi=ERC20_ABI,
    )
    return _token_contract


def _get_treasury_contract():
    """Return cached RGDGTreasury contract instance."""
    global _treasury_contract
    if _treasury_contract is not None:
        return _treasury_contract

    settings = get_settings()
    if not settings.treasury_address:
        raise BlockchainUnavailableError("treasury_address is not configured")

    w3 = _get_web3()
    _treasury_contract = w3.eth.contract(
        address=w3.to_checksum_address(settings.treasury_address),
        abi=TREASURY_ABI,
    )
    return _treasury_contract


def reset_connections():
    """Reset cached connections (useful for testing or config changes)."""
    global _w3, _token_contract, _treasury_contract
    _w3 = None
    _token_contract = None
    _treasury_contract = None


# ---------------------------------------------------------------------------
#  Token functions
# ---------------------------------------------------------------------------

def get_token_balance(wallet_address: str) -> float:
    """Get the RGDG token balance for a wallet address.

    Returns balance in whole token units (not wei).
    """
    try:
        w3 = _get_web3()
        contract = _get_token_contract()
        checksum_addr = w3.to_checksum_address(wallet_address)
        balance_wei = contract.functions.balanceOf(checksum_addr).call()
        # RGDG uses 18 decimals like ETH
        return float(w3.from_wei(balance_wei, "ether"))
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get token balance for %s: %s", wallet_address, exc)
        raise BlockchainUnavailableError(f"Failed to query token balance: {exc}") from exc


def get_treasury_balance() -> float:
    """Get the current RGDG balance held by the treasury contract."""
    try:
        w3 = _get_web3()
        contract = _get_treasury_contract()
        balance_wei = contract.functions.treasuryBalance().call()
        return float(w3.from_wei(balance_wei, "ether"))
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get treasury balance: %s", exc)
        raise BlockchainUnavailableError(f"Failed to query treasury balance: {exc}") from exc


def get_event_fee() -> float:
    """Get the current event fee from the treasury contract (in RGDG tokens)."""
    try:
        w3 = _get_web3()
        contract = _get_treasury_contract()
        fee_wei = contract.functions.eventFee().call()
        return float(w3.from_wei(fee_wei, "ether"))
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get event fee: %s", exc)
        raise BlockchainUnavailableError(f"Failed to query event fee: {exc}") from exc


# ---------------------------------------------------------------------------
#  Transaction functions
# ---------------------------------------------------------------------------

def get_transaction_receipt(tx_hash: str) -> dict[str, Any] | None:
    """Get a transaction receipt by hash. Returns None if not found/pending."""
    try:
        w3 = _get_web3()
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        if receipt is None:
            return None
        return dict(receipt)
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get tx receipt for %s: %s", tx_hash, exc)
        return None


def verify_fee_payment(tx_hash: str, expected_amount: float, payer_address: str) -> bool:
    """Verify that a transaction is a valid event fee payment.

    Checks:
    1. Transaction exists and is confirmed (status=1)
    2. Transaction was sent to the treasury contract
    3. The FeePaid event was emitted with the correct player and amount
    """
    try:
        w3 = _get_web3()
        settings = get_settings()
        treasury_contract = _get_treasury_contract()

        receipt = w3.eth.get_transaction_receipt(tx_hash)
        if receipt is None:
            logger.warning("Transaction %s not found (may be pending)", tx_hash)
            return False

        # Check transaction succeeded
        if receipt["status"] != 1:
            logger.warning("Transaction %s failed (status=0)", tx_hash)
            return False

        # Check the transaction was sent to the treasury
        treasury_addr = w3.to_checksum_address(settings.treasury_address)
        if receipt["to"] and w3.to_checksum_address(receipt["to"]) != treasury_addr:
            logger.warning("Transaction %s not sent to treasury", tx_hash)
            return False

        # Parse FeePaid events from the receipt
        fee_paid_events = treasury_contract.events.FeePaid().process_receipt(receipt)
        if not fee_paid_events:
            logger.warning("No FeePaid event found in tx %s", tx_hash)
            return False

        # Verify the payer and amount
        payer_checksum = w3.to_checksum_address(payer_address)
        expected_wei = w3.to_wei(expected_amount, "ether")

        for event in fee_paid_events:
            if (
                w3.to_checksum_address(event["args"]["player"]) == payer_checksum
                and event["args"]["amount"] == expected_wei
            ):
                return True

        logger.warning(
            "FeePaid event in tx %s does not match payer=%s amount=%s",
            tx_hash, payer_address, expected_amount,
        )
        return False

    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to verify fee payment %s: %s", tx_hash, exc)
        raise BlockchainUnavailableError(f"Failed to verify payment: {exc}") from exc


# ---------------------------------------------------------------------------
#  Wallet authentication
# ---------------------------------------------------------------------------

def generate_nonce() -> str:
    """Generate a random nonce for wallet signature verification."""
    return secrets.token_hex(16)


def verify_wallet_signature(address: str, message: str, signature: str) -> bool:
    """Verify that `signature` was produced by the private key of `address`
    signing `message` (EIP-191 personal_sign).
    """
    try:
        from eth_account.messages import encode_defunct
        from web3 import Web3

        w3 = Web3()  # No provider needed for signature recovery
        msg = encode_defunct(text=message)
        recovered = w3.eth.account.recover_message(msg, signature=signature)
        return recovered.lower() == address.lower()
    except ImportError:
        raise BlockchainUnavailableError(
            "eth-account package is not installed. Run: pip install eth-account"
        )
    except Exception as exc:
        logger.error("Signature verification failed for %s: %s", address, exc)
        return False


def is_valid_address(address: str) -> bool:
    """Check if a string is a valid Ethereum address."""
    try:
        from web3 import Web3
        return Web3.is_address(address)
    except ImportError:
        # Fallback: basic regex check
        import re
        return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))
