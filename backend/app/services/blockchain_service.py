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
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]

DISC_REGISTRY_ABI = [
    # mint(address, string, string, string, string, uint16, string) → uint256
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "discCode", "type": "string"},
            {"name": "manufacturer", "type": "string"},
            {"name": "mold", "type": "string"},
            {"name": "plastic", "type": "string"},
            {"name": "weightGrams", "type": "uint16"},
            {"name": "color", "type": "string"},
        ],
        "name": "mint",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # reportLost(uint256)
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "reportLost",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # reportFound(uint256, address)
    {
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "finderAddress", "type": "address"},
        ],
        "name": "reportFound",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # confirmReturn(uint256)
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "confirmReturn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # transferDisc(uint256, address)
    {
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "to", "type": "address"},
        ],
        "name": "transferDisc",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    # getDiscByCode(string) → uint256
    {
        "inputs": [{"name": "discCode", "type": "string"}],
        "name": "getDiscByCode",
        "outputs": [{"name": "tokenId", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    # getDiscInfo(uint256) → tuple
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "getDiscInfo",
        "outputs": [
            {
                "components": [
                    {"name": "discCode", "type": "string"},
                    {"name": "manufacturer", "type": "string"},
                    {"name": "mold", "type": "string"},
                    {"name": "plastic", "type": "string"},
                    {"name": "weightGrams", "type": "uint16"},
                    {"name": "color", "type": "string"},
                    {"name": "status", "type": "uint8"},
                ],
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    # ownerOf(uint256) → address  (ERC-721)
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    # DiscMinted event — used to extract tokenId from mint receipt
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "tokenId", "type": "uint256"},
            {"indexed": True, "name": "owner", "type": "address"},
            {"indexed": False, "name": "discCode", "type": "string"},
        ],
        "name": "DiscMinted",
        "type": "event",
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
    {
        "inputs": [
            {"name": "recipients", "type": "address[]"},
            {"name": "amounts", "type": "uint256[]"},
        ],
        "name": "distributePrizes",
        "outputs": [],
        "stateMutability": "nonpayable",
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
_disc_registry_contract = None


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


def _get_disc_registry_contract():
    """Return cached DiscRegistry contract instance."""
    global _disc_registry_contract
    if _disc_registry_contract is not None:
        return _disc_registry_contract

    settings = get_settings()
    if not settings.disc_registry_address:
        raise BlockchainUnavailableError("disc_registry_address is not configured")

    w3 = _get_web3()
    _disc_registry_contract = w3.eth.contract(
        address=w3.to_checksum_address(settings.disc_registry_address),
        abi=DISC_REGISTRY_ABI,
    )
    return _disc_registry_contract


def reset_connections():
    """Reset cached connections (useful for testing or config changes)."""
    global _w3, _token_contract, _treasury_contract, _disc_registry_contract
    _w3 = None
    _token_contract = None
    _treasury_contract = None
    _disc_registry_contract = None


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


# ---------------------------------------------------------------------------
#  Admin write operations (require deployer private key)
# ---------------------------------------------------------------------------

def _get_deployer_account():
    """Return (w3, account) for the deployer/owner wallet.

    The deployer private key must be configured in settings.
    """
    settings = get_settings()
    if not settings.deployer_private_key:
        raise BlockchainUnavailableError(
            "deployer_private_key is not configured. "
            "Set DEPLOYER_PRIVATE_KEY in the environment to sign admin transactions."
        )
    w3 = _get_web3()
    try:
        from eth_account import Account
        account = Account.from_key(settings.deployer_private_key)
        return w3, account
    except ImportError:
        raise BlockchainUnavailableError(
            "eth-account package is not installed. Run: pip install eth-account"
        )
    except Exception as exc:
        raise BlockchainUnavailableError(f"Invalid deployer private key: {exc}") from exc


def _send_signed_tx(w3, account, tx_data: dict) -> str:
    """Build, sign, and send a transaction. Returns the tx hash hex string."""
    # Set core fields
    tx_data["nonce"] = w3.eth.get_transaction_count(account.address)
    tx_data["chainId"] = w3.eth.chain_id

    # Remove gas fields set by build_transaction — we'll recalculate cleanly
    for key in ("maxFeePerGas", "maxPriorityFeePerGas", "gasPrice"):
        tx_data.pop(key, None)

    # Estimate gas if not set
    if "gas" not in tx_data:
        tx_data["gas"] = w3.eth.estimate_gas(tx_data)

    # Set gas pricing — use legacy gasPrice for simplicity on testnets
    tx_data["gasPrice"] = w3.eth.gas_price

    signed = w3.eth.account.sign_transaction(tx_data, private_key=account.key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    return tx_hash.hex()


def mint_tokens(to_address: str, amount: float) -> tuple[str, int]:
    """Mint RGDG tokens to an address. Only the contract owner can call mint().

    Args:
        to_address: Recipient address (typically the treasury).
        amount: Number of tokens in whole units (converted to wei internally).

    Returns:
        (tx_hash, block_number) of the confirmed transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_token_contract()
        checksum_to = w3.to_checksum_address(to_address)
        amount_wei = w3.to_wei(amount, "ether")

        tx_data = contract.functions.mint(checksum_to, amount_wei).build_transaction({"from": account.address})
        tx_hash = _send_signed_tx(w3, account, tx_data)

        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"Mint transaction {tx_hash} reverted on-chain"
            )

        logger.info(
            "Minted %s RGDG to %s — tx %s (block %s)",
            amount, to_address, tx_hash, receipt["blockNumber"],
        )
        return tx_hash, receipt["blockNumber"]
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to mint tokens: %s", exc)
        raise BlockchainUnavailableError(f"Mint transaction failed: {exc}") from exc


def distribute_prizes(
    recipients: list[str], amounts: list[float]
) -> tuple[str, int]:
    """Call distributePrizes on the treasury contract.

    Args:
        recipients: List of winner wallet addresses.
        amounts: List of prize amounts in whole RGDG units.

    Returns:
        (tx_hash, block_number) of the confirmed transaction.
    """
    if len(recipients) != len(amounts):
        raise ValueError("recipients and amounts must have the same length")
    if not recipients:
        raise ValueError("recipients must not be empty")

    try:
        w3, account = _get_deployer_account()
        treasury_contract = _get_treasury_contract()

        checksum_recipients = [w3.to_checksum_address(addr) for addr in recipients]
        amounts_wei = [w3.to_wei(a, "ether") for a in amounts]

        tx_data = treasury_contract.functions.distributePrizes(
            checksum_recipients, amounts_wei
        ).build_transaction({"from": account.address})
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"distributePrizes transaction {tx_hash} reverted on-chain"
            )

        logger.info(
            "Distributed prizes to %d recipients — tx %s (block %s)",
            len(recipients), tx_hash, receipt["blockNumber"],
        )
        return tx_hash, receipt["blockNumber"]
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to distribute prizes: %s", exc)
        raise BlockchainUnavailableError(f"Prize distribution failed: {exc}") from exc


# ---------------------------------------------------------------------------
#  DiscRegistry NFT functions
# ---------------------------------------------------------------------------

# Map on-chain status enum to human-readable strings
_DISC_STATUS_MAP = {0: "active", 1: "lost", 2: "found", 3: "returned"}


def mint_disc_nft(
    to_address: str,
    disc_code: str,
    manufacturer: str,
    mold: str,
    plastic: str,
    weight_grams: int,
    color: str,
) -> tuple[str, int]:
    """Mint a disc as an NFT on the DiscRegistry contract.

    Args:
        to_address: Wallet address of the disc owner.
        disc_code: Unique RGDG disc code.
        manufacturer: Disc manufacturer name.
        mold: Disc mold name.
        plastic: Plastic type.
        weight_grams: Disc weight in grams (uint16, max 65535).
        color: Primary disc color.

    Returns:
        (tx_hash, token_id) of the confirmed mint transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_disc_registry_contract()
        checksum_to = w3.to_checksum_address(to_address)

        tx_data = contract.functions.mint(
            checksum_to,
            disc_code,
            manufacturer or "",
            mold,
            plastic or "",
            weight_grams or 0,
            color or "",
        ).build_transaction({"from": account.address})
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"DiscRegistry mint transaction {tx_hash} reverted on-chain"
            )

        # Extract token_id from DiscMinted event
        token_id = 0
        try:
            mint_events = contract.events.DiscMinted().process_receipt(receipt)
            if mint_events:
                token_id = mint_events[0]["args"]["tokenId"]
        except Exception:
            logger.warning("Could not parse DiscMinted event from tx %s", tx_hash)

        logger.info(
            "Minted disc NFT %s (token %d) to %s — tx %s",
            disc_code, token_id, to_address, tx_hash,
        )
        return tx_hash, token_id
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to mint disc NFT %s: %s", disc_code, exc)
        raise BlockchainUnavailableError(f"Disc NFT mint failed: {exc}") from exc


def report_disc_lost_onchain(token_id: int) -> str:
    """Report a disc as lost on the DiscRegistry contract.

    Returns:
        tx_hash of the confirmed transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_disc_registry_contract()

        tx_data = contract.functions.reportLost(token_id).build_transaction(
            {"from": account.address}
        )
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"reportLost transaction {tx_hash} reverted on-chain"
            )

        logger.info("Reported disc token %d as lost — tx %s", token_id, tx_hash)
        return tx_hash
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to report disc %d as lost on-chain: %s", token_id, exc)
        raise BlockchainUnavailableError(f"reportLost failed: {exc}") from exc


def report_disc_found_onchain(token_id: int, finder_address: str) -> str:
    """Report a disc as found on the DiscRegistry contract.

    Args:
        token_id: On-chain NFT token ID.
        finder_address: Wallet address of the finder (use zero address if unknown).

    Returns:
        tx_hash of the confirmed transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_disc_registry_contract()
        checksum_finder = w3.to_checksum_address(finder_address)

        tx_data = contract.functions.reportFound(
            token_id, checksum_finder
        ).build_transaction({"from": account.address})
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"reportFound transaction {tx_hash} reverted on-chain"
            )

        logger.info(
            "Reported disc token %d as found by %s — tx %s",
            token_id, finder_address, tx_hash,
        )
        return tx_hash
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to report disc %d as found on-chain: %s", token_id, exc)
        raise BlockchainUnavailableError(f"reportFound failed: {exc}") from exc


def confirm_disc_return_onchain(token_id: int) -> str:
    """Confirm disc return on the DiscRegistry contract.

    Returns:
        tx_hash of the confirmed transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_disc_registry_contract()

        tx_data = contract.functions.confirmReturn(token_id).build_transaction(
            {"from": account.address}
        )
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"confirmReturn transaction {tx_hash} reverted on-chain"
            )

        logger.info("Confirmed return for disc token %d — tx %s", token_id, tx_hash)
        return tx_hash
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to confirm return for disc %d on-chain: %s", token_id, exc)
        raise BlockchainUnavailableError(f"confirmReturn failed: {exc}") from exc


def transfer_disc_onchain(token_id: int, to_address: str) -> str:
    """Transfer a disc NFT to a new owner on the DiscRegistry contract.

    Args:
        token_id: On-chain NFT token ID.
        to_address: New owner's wallet address.

    Returns:
        tx_hash of the confirmed transaction.
    """
    try:
        w3, account = _get_deployer_account()
        contract = _get_disc_registry_contract()
        checksum_to = w3.to_checksum_address(to_address)

        tx_data = contract.functions.transferDisc(
            token_id, checksum_to
        ).build_transaction({"from": account.address})
        tx_hash = _send_signed_tx(w3, account, tx_data)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise BlockchainUnavailableError(
                f"transferDisc transaction {tx_hash} reverted on-chain"
            )

        logger.info(
            "Transferred disc token %d to %s — tx %s",
            token_id, to_address, tx_hash,
        )
        return tx_hash
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to transfer disc %d on-chain: %s", token_id, exc)
        raise BlockchainUnavailableError(f"transferDisc failed: {exc}") from exc


def get_disc_nft_info(disc_code: str) -> dict | None:
    """Look up disc NFT info by its RGDG code.

    Returns:
        Dict with token_id, owner, status, and disc metadata, or None if not found.
    """
    try:
        w3 = _get_web3()
        contract = _get_disc_registry_contract()

        token_id = contract.functions.getDiscByCode(disc_code).call()
        if token_id == 0:
            return None

        owner = contract.functions.ownerOf(token_id).call()
        info = contract.functions.getDiscInfo(token_id).call()

        return {
            "token_id": token_id,
            "owner": owner,
            "disc_code": info[0],
            "manufacturer": info[1],
            "mold": info[2],
            "plastic": info[3],
            "weight_grams": info[4],
            "color": info[5],
            "status": _DISC_STATUS_MAP.get(info[6], "unknown"),
        }
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get disc NFT info for %s: %s", disc_code, exc)
        return None


def get_disc_owner_onchain(token_id: int) -> str:
    """Get the current on-chain owner of a disc NFT.

    Returns:
        The owner wallet address as a checksum string.
    """
    try:
        contract = _get_disc_registry_contract()
        return contract.functions.ownerOf(token_id).call()
    except BlockchainUnavailableError:
        raise
    except Exception as exc:
        logger.error("Failed to get owner for disc token %d: %s", token_id, exc)
        raise BlockchainUnavailableError(f"ownerOf query failed: {exc}") from exc
