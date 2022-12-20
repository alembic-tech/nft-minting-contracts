// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";

contract ERC721Test is ERC721PresetMinterPauserAutoId {
    // solhint-disable-next-line no-empty-blocks
    constructor() ERC721PresetMinterPauserAutoId("Test", "Test", "https://whatever.com") {}
}
