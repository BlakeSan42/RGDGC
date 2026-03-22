// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RGDGTreasury
 * @author River Grove Disc Golf Club
 * @notice Manages the club treasury of $RGDG tokens.
 * @dev Handles event fee collection, prize distribution, and admin withdrawals.
 *
 * Flow:
 *   1. Admin deposits RGDG tokens to fund the treasury.
 *   2. Players call `payEventFee` to pay into the treasury for events.
 *   3. Admin calls `distributePrizes` to batch-pay winners after an event.
 *   4. Admin can withdraw tokens for other club operations.
 */
contract RGDGTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The RGDG token contract.
    IERC20 public immutable rgdgToken;

    /// @notice Default event fee in RGDG token wei.
    uint256 public eventFee;

    // ---------------------------------------------------------------
    //  Events
    // ---------------------------------------------------------------

    /// @notice Emitted when a player pays an event fee.
    event FeePaid(address indexed player, uint256 amount, uint256 timestamp);

    /// @notice Emitted when prizes are distributed to winners.
    event PrizeDistributed(
        address[] recipients,
        uint256[] amounts,
        uint256 timestamp
    );

    /// @notice Emitted when the admin updates the event fee.
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when the admin withdraws tokens.
    event Withdrawal(address indexed to, uint256 amount);

    /// @notice Emitted when tokens are deposited into the treasury.
    event Deposit(address indexed from, uint256 amount);

    // ---------------------------------------------------------------
    //  Constructor
    // ---------------------------------------------------------------

    /**
     * @notice Deploy the treasury bound to a specific RGDG token.
     * @param _rgdgToken Address of the deployed RGDGToken contract.
     * @param _eventFee  Initial event fee in token wei.
     */
    constructor(
        address _rgdgToken,
        uint256 _eventFee
    ) Ownable(msg.sender) {
        require(_rgdgToken != address(0), "Treasury: zero token address");
        rgdgToken = IERC20(_rgdgToken);
        eventFee = _eventFee;
    }

    // ---------------------------------------------------------------
    //  Player functions
    // ---------------------------------------------------------------

    /**
     * @notice Pay the current event fee. Caller must have approved this
     *         contract to spend at least `eventFee` RGDG tokens.
     */
    function payEventFee() external nonReentrant {
        require(eventFee > 0, "Treasury: event fee not set");
        rgdgToken.safeTransferFrom(msg.sender, address(this), eventFee);
        emit FeePaid(msg.sender, eventFee, block.timestamp);
    }

    /**
     * @notice Check how many RGDG tokens the treasury currently holds.
     * @return The token balance of this contract.
     */
    function treasuryBalance() external view returns (uint256) {
        return rgdgToken.balanceOf(address(this));
    }

    // ---------------------------------------------------------------
    //  Admin functions
    // ---------------------------------------------------------------

    /**
     * @notice Deposit RGDG tokens into the treasury. Caller must have
     *         approved this contract for `amount`.
     * @param amount The number of tokens (in wei) to deposit.
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Treasury: zero deposit");
        rgdgToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Withdraw RGDG tokens from the treasury. Only callable by owner.
     * @param to     Recipient address.
     * @param amount Number of tokens (in wei) to withdraw.
     */
    function withdraw(
        address to,
        uint256 amount
    ) external onlyOwner nonReentrant {
        require(to != address(0), "Treasury: zero address");
        require(amount > 0, "Treasury: zero amount");
        rgdgToken.safeTransfer(to, amount);
        emit Withdrawal(to, amount);
    }

    /**
     * @notice Distribute prizes to multiple winners in a single transaction.
     * @param recipients Array of winner addresses.
     * @param amounts    Array of prize amounts (in token wei), matching recipients.
     */
    function distributePrizes(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        require(
            recipients.length == amounts.length,
            "Treasury: length mismatch"
        );
        require(recipients.length > 0, "Treasury: empty arrays");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Treasury: zero address");
            require(amounts[i] > 0, "Treasury: zero amount");
            rgdgToken.safeTransfer(recipients[i], amounts[i]);
        }

        emit PrizeDistributed(recipients, amounts, block.timestamp);
    }

    /**
     * @notice Update the event fee. Only callable by owner.
     * @param newFee The new event fee in token wei.
     */
    function setEventFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = eventFee;
        eventFee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }
}
