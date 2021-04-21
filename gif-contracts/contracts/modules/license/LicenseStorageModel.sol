pragma solidity 0.8.0;
// SPDX-License-Identifier: Apache-2.0

import "./ILicense.sol";

contract LicenseStorageModel is ILicense {
    mapping(uint256 => Product) public products;
    mapping(address => uint256) public productIdByAddress;
    uint256 public productIdIncrement;

    // todo: Add list of approved products
    // todo: Add list of products for approval

}
