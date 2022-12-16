// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.4;

import "../erc1155/IERC1155Mintable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract ERC1155Test is IERC1155Mintable, ERC1155Supply, ERC1155Burnable, AccessControlEnumerable {
    string private _baseURI;
    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev Grants `DEFAULT_ADMIN_ROLE`, `MINTER_ROLE`, and `PAUSER_ROLE` to the account that
     * deploys the contract.
     */
    constructor(string memory _uri) ERC1155(_uri) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(MINTER_ROLE, _msgSender());
        _setupRole(PAUSER_ROLE, _msgSender());
        _baseURI = _uri;
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, id, amount, data);
    }

    function setURI(uint256 tokenId, string memory tokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(tokenId, tokenURI);
    }

    function setBaseURI(string memory baseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseURI(baseURI);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155Supply, ERC1155) {
        ERC1155Supply._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     *
     * This implementation returns `_baseURI` or the token-specific uri if the latter is set.
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        string memory tokenURI = _tokenURIs[tokenId];

        // if token URI is set, use it, otherwise default to `_baseURI`
        return bytes(tokenURI).length > 0 ? tokenURI : _baseURI;
    }

    /**
     * @dev Sets `tokenURI` as the tokenURI of `tokenId`.
     */
    function _setURI(uint256 tokenId, string memory tokenURI) internal virtual {
        _tokenURIs[tokenId] = tokenURI;
        emit URI(uri(tokenId), tokenId);
    }

    /**
     * @dev Sets `baseURI` as the `_baseURI` for all tokens
     */
    function _setBaseURI(string memory baseURI) internal virtual {
        _baseURI = baseURI;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControlEnumerable)
        returns (bool)
    {
        return ERC1155.supportsInterface(interfaceId) || AccessControlEnumerable.supportsInterface(interfaceId);
    }
}
