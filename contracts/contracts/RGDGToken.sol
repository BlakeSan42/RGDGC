// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title RGDGToken
 * @author River Grove Disc Golf Club
 * @notice ERC-20 fungible token for the RGDGC ecosystem.
 * @dev Used for event fees, prize payouts, and club treasury operations.
 *
 * Key features:
 *   - Owner (club admin) can mint new tokens to the treasury.
 *   - Any holder can burn their own tokens.
 *   - Owner can pause all transfers in an emergency.
 *   - Standard ERC-20 transfer / approve / transferFrom.
 */
contract RGDGToken is ERC20, ERC20Burnable, Ownable, Pausable {
    /**
     * @notice Deploy the RGDG token and mint the initial supply to the deployer.
     * @param initialSupply The number of tokens (in whole units) to mint at deploy.
     *        The contract applies 18 decimals automatically.
     */
    constructor(
        uint256 initialSupply
    ) ERC20("River Grove Disc Golf Token", "RGDG") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // ---------------------------------------------------------------
    //  Admin functions
    // ---------------------------------------------------------------

    /**
     * @notice Mint new RGDG tokens. Only callable by the contract owner.
     * @param to   The address that receives the minted tokens.
     * @param amount The number of tokens to mint (in wei, i.e. 18-decimal units).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Pause all token transfers. Only callable by the contract owner.
     * @dev Use in an emergency to freeze all movement of RGDG tokens.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause token transfers. Only callable by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------
    //  Internal overrides
    // ---------------------------------------------------------------

    /**
     * @dev Hook that enforces the Pausable check on every transfer.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
