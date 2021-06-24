pragma solidity 0.8.0;
// SPDX-License-Identifier: Apache-2.0

import "./LicenseStorageModel.sol";
import "../../shared/ModuleController.sol";

contract LicenseController is LicenseStorageModel, ModuleController {
    bytes32 public constant NAME = "LicenseController";

    constructor(address _registry, uint256 _productIdIncrement) WithRegistry(_registry)
    {
        // productIdIncrement should be equal to the value from the last deployed licence storage or zero
        productIdIncrement = _productIdIncrement;
    }

    /**
     * @dev Register new product
     * _addr the address of the calling contract, i.e. the product contract to register.
     */
    function register(bytes32 _name, address _addr, bytes32 _policyFlow)
        external
        returns (uint256 _id)
    {
        // todo: add restriction, allow only ProductOwners
        require(productIdByAddress[_addr] == 0, "ERROR::PRODUCT_IS_ACTIVE");

        productIdIncrement += 1;
        _id = productIdIncrement;

        // todo: check required policyFlow existence

        Product storage product = products[_id];
        product.name = _name;
        product.addr = _addr;
        product.policyFlow = _policyFlow;
        product.release = getRelease();
        product.state = ProductState.Proposed;

        emit LogNewProduct(_id, _name, _addr, _policyFlow);
    }

    /*
     * @dev Approve product
     */
    function setProductState(uint256 _id, ProductState _state) external onlyInstanceOperator {
        require(products[_id].addr != address(0), "ERROR::PRODUCT_DOES_NOT_EXIST");
        products[_id].state = _state;
        if (_state == ProductState.Approved) {
            productIdByAddress[products[_id].addr] = _id;
        }

        emit LogProductSetState(_id, products[_id].name, products[_id].addr, _state);
    }

    /**
     * @dev Check if contract is approved product
     */
    function isApprovedProduct(address _addr)
        public
        view
        returns (bool _approved)
    {
        Product storage product = products[productIdByAddress[_addr]];
        _approved = product.state == ProductState.Approved || product.state == ProductState.Paused;
    }

    /**
     * @dev Check if contract is paused product
     */
    function isPausedProduct(address _addr) public view returns (bool _paused) {
        _paused = products[productIdByAddress[_addr]].state == ProductState.Paused;
    }

    function isValidCall(address _addr) public view returns (bool _valid) {
        _valid = products[productIdByAddress[_addr]].state != ProductState.Proposed;
    }

    function authorize(address _sender)
        public
        view
        returns (bool _authorized, address _policyFlow)
    {
        _authorized = isValidCall(_sender);
        _policyFlow = getContractInRelease(
            products[productIdByAddress[_sender]].release,
            products[productIdByAddress[_sender]].policyFlow
        );
    }

    function getProductId(address _addr)
        public
        view
        returns (uint256 _productId)
    {
        require(
            productIdByAddress[_addr] > 0,
            "ERROR::PRODUCT_NOT_APPROVED_OR_DOES_NOT_EXIST"
        );

        _productId = productIdByAddress[_addr];
    }
}
