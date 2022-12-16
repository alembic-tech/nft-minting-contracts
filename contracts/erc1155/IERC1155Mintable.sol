// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface IERC1155Mintable {
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;
}
