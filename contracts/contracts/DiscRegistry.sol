// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DiscRegistry
 * @author River Grove Disc Golf Club
 * @notice ERC-721 NFT registry for tracking physical disc golf discs.
 * @dev Each NFT represents a single physical disc. Supports lost-and-found
 *      workflows and QR-code-based lookups via a unique disc code.
 *
 * Lifecycle:
 *   1. Admin mints an NFT for a player's disc (with metadata + disc code).
 *   2. Owner marks it lost via `reportLost`.
 *   3. Finder calls `reportFound` with their address.
 *   4. Original owner calls `confirmReturn` once disc is back in hand.
 *   5. Ownership can be transferred via `transferDisc`.
 */
contract DiscRegistry is ERC721, ERC721Enumerable, Ownable {
    // ---------------------------------------------------------------
    //  Types
    // ---------------------------------------------------------------

    /// @notice Metadata attached to every minted disc NFT.
    struct DiscInfo {
        string manufacturer; // e.g. "Innova", "Discraft", "MVP"
        string mold; // e.g. "Destroyer", "Buzzz", "Volt"
        string plastic; // e.g. "Star", "ESP", "Neutron"
        uint16 weightGrams; // disc weight in grams (typically 150-180)
        string color; // human-readable color
        string discCode; // unique code printed on / QR-linked to the disc
        uint256 registeredAt; // block timestamp of minting
    }

    /// @notice Possible states a disc can be in.
    enum DiscStatus {
        Active, // in the owner's possession
        Lost, // owner reported it lost
        Found // a finder reported it found
    }

    // ---------------------------------------------------------------
    //  State
    // ---------------------------------------------------------------

    /// @dev Auto-incrementing token ID counter.
    uint256 private _nextTokenId;

    /// @notice Token ID => disc metadata.
    mapping(uint256 => DiscInfo) private _discInfo;

    /// @notice Token ID => current status.
    mapping(uint256 => DiscStatus) public discStatus;

    /// @notice Token ID => address of the person who found it (if status == Found).
    mapping(uint256 => address) public discFinder;

    /// @notice Disc code string => token ID (for QR lookups). 0 means unregistered.
    mapping(string => uint256) private _codeToTokenId;

    /// @notice Tracks whether a disc code has been registered (because tokenId 0 is unused).
    mapping(string => bool) private _codeRegistered;

    // ---------------------------------------------------------------
    //  Events
    // ---------------------------------------------------------------

    /// @notice Emitted when a new disc is minted.
    event DiscRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        string discCode,
        string manufacturer,
        string mold
    );

    /// @notice Emitted when the owner marks a disc as lost.
    event DiscLost(uint256 indexed tokenId, address indexed owner);

    /// @notice Emitted when someone reports finding a lost disc.
    event DiscFound(
        uint256 indexed tokenId,
        address indexed finder,
        address indexed owner
    );

    /// @notice Emitted when the owner confirms the disc has been returned.
    event DiscReturned(uint256 indexed tokenId, address indexed owner);

    /// @notice Emitted when disc ownership is explicitly transferred.
    event DiscTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to
    );

    // ---------------------------------------------------------------
    //  Constructor
    // ---------------------------------------------------------------

    constructor()
        ERC721("RGDGC Disc Registry", "DISC")
        Ownable(msg.sender)
    {
        // Token IDs start at 1 (0 is reserved as "not found" sentinel).
        _nextTokenId = 1;
    }

    // ---------------------------------------------------------------
    //  Minting
    // ---------------------------------------------------------------

    /**
     * @notice Mint a new disc NFT. Only callable by contract owner (admin).
     * @param to           Address of the disc owner.
     * @param discCode     Unique code for QR-based lookups.
     * @param manufacturer Disc manufacturer name.
     * @param mold         Disc mold name.
     * @param plastic      Plastic type.
     * @param weightGrams  Weight in grams.
     * @param color        Human-readable color description.
     * @return tokenId     The newly minted token ID.
     */
    function mint(
        address to,
        string calldata discCode,
        string calldata manufacturer,
        string calldata mold,
        string calldata plastic,
        uint16 weightGrams,
        string calldata color
    ) external onlyOwner returns (uint256) {
        require(bytes(discCode).length > 0, "DiscRegistry: empty disc code");
        require(!_codeRegistered[discCode], "DiscRegistry: code already used");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _discInfo[tokenId] = DiscInfo({
            manufacturer: manufacturer,
            mold: mold,
            plastic: plastic,
            weightGrams: weightGrams,
            color: color,
            discCode: discCode,
            registeredAt: block.timestamp
        });

        discStatus[tokenId] = DiscStatus.Active;
        _codeToTokenId[discCode] = tokenId;
        _codeRegistered[discCode] = true;

        emit DiscRegistered(tokenId, to, discCode, manufacturer, mold);
        return tokenId;
    }

    // ---------------------------------------------------------------
    //  Lost & Found
    // ---------------------------------------------------------------

    /**
     * @notice Mark a disc as lost. Only callable by the disc's current owner.
     * @param tokenId The token ID of the lost disc.
     */
    function reportLost(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "DiscRegistry: not disc owner");
        require(
            discStatus[tokenId] == DiscStatus.Active,
            "DiscRegistry: disc not active"
        );

        discStatus[tokenId] = DiscStatus.Lost;
        emit DiscLost(tokenId, msg.sender);
    }

    /**
     * @notice Report that a lost disc has been found. Anyone can call this.
     * @param tokenId       The token ID of the found disc.
     * @param finderAddress Address of the person who found it.
     */
    function reportFound(uint256 tokenId, address finderAddress) external {
        require(finderAddress != address(0), "DiscRegistry: zero finder");
        require(
            discStatus[tokenId] == DiscStatus.Lost,
            "DiscRegistry: disc not lost"
        );

        discStatus[tokenId] = DiscStatus.Found;
        discFinder[tokenId] = finderAddress;
        emit DiscFound(tokenId, finderAddress, ownerOf(tokenId));
    }

    /**
     * @notice Confirm that a found disc has been returned. Only callable by disc owner.
     * @param tokenId The token ID of the returned disc.
     */
    function confirmReturn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "DiscRegistry: not disc owner");
        require(
            discStatus[tokenId] == DiscStatus.Found,
            "DiscRegistry: disc not found-status"
        );

        discStatus[tokenId] = DiscStatus.Active;
        delete discFinder[tokenId];
        emit DiscReturned(tokenId, msg.sender);
    }

    // ---------------------------------------------------------------
    //  Transfer
    // ---------------------------------------------------------------

    /**
     * @notice Transfer disc ownership explicitly. Only callable by disc owner.
     *         Resets disc status to Active.
     * @param tokenId The token ID to transfer.
     * @param to      New owner address.
     */
    function transferDisc(uint256 tokenId, address to) external {
        require(ownerOf(tokenId) == msg.sender, "DiscRegistry: not disc owner");
        require(to != address(0), "DiscRegistry: zero address");

        discStatus[tokenId] = DiscStatus.Active;
        delete discFinder[tokenId];

        _transfer(msg.sender, to, tokenId);
        emit DiscTransferred(tokenId, msg.sender, to);
    }

    // ---------------------------------------------------------------
    //  Views
    // ---------------------------------------------------------------

    /**
     * @notice Get full metadata for a disc by token ID.
     * @param tokenId The token to query.
     * @return info The disc's metadata struct.
     */
    function getDiscInfo(
        uint256 tokenId
    ) external view returns (DiscInfo memory) {
        _requireOwned(tokenId);
        return _discInfo[tokenId];
    }

    /**
     * @notice Look up a disc by its unique code (for QR scanning).
     * @param discCode The code string.
     * @return tokenId The matching token ID (reverts if not found).
     */
    function getDiscByCode(
        string calldata discCode
    ) external view returns (uint256) {
        require(_codeRegistered[discCode], "DiscRegistry: code not found");
        return _codeToTokenId[discCode];
    }

    // ---------------------------------------------------------------
    //  Required overrides (ERC721 + ERC721Enumerable)
    // ---------------------------------------------------------------

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
