// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IERC1155Mintable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract ERC1155VoucherMinter is AccessControl, EIP712 {
    IERC1155Mintable public immutable nftContract;

    /// @dev mapping nonce => consumed
    mapping(uint256 => bool) nonces;

    /// @notice MINTER_ROLE is required to request welcome packs to be purchased.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    string private constant SIGNING_DOMAIN = "ERC1155VoucherMinter";
    string private constant SIGNATURE_VERSION = "1";

    struct MintRequest {
        address to;
        uint256 tokenId;
        uint256 quantity;
        uint256 nonce;
        bytes signature;
    }

    constructor(IERC1155Mintable _nftContract) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        nftContract = _nftContract;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(MintRequest calldata request) external {
        address signer = _verify(request);
        require(hasRole(MINTER_ROLE, signer), "Signature invalid or unauthorized");
        // ensure nonce not already consumed
        require(!nonces[request.nonce], "Nonce consumed");
        nonces[request.nonce] = true;
        // mint NFTs
        nftContract.mint(request.to, request.tokenId, request.quantity, "");
    }

    bytes32 private constant MINT_REQUEST_TYPE_HASH =
        keccak256("MintRequest(address to,uint256 tokenId,uint256 quantity,uint256 nonce)");

    function _hash(MintRequest calldata request) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(MINT_REQUEST_TYPE_HASH, request.to, request.tokenId, request.quantity, request.nonce)
                )
            );
    }

    function _verify(MintRequest calldata request) internal view returns (address) {
        bytes32 digest = _hash(request);
        return ECDSA.recover(digest, request.signature);
    }
}
