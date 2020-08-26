const { expect } = require('chai');
require('chai').should();
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const upgrades = require('@openzeppelin/truffle-upgrades');

const ERC20 = artifacts.require("ERC20");
const CofiXController = artifacts.require("CofiXController");
const CofiXControllerV2 = artifacts.require('CofiXControllerV2Test');

const NEST3PriceOracleMock = artifacts.require("NEST3PriceOracleMock");

contract('CofiXController (proxy)', (accounts) => {
  const admin = accounts[0];
  const nonAdmin = accounts[1];

  before(async function () {
    // Deploy a new Box contract for each test
    USDT = await ERC20.new("10000000000000000", "USDT Test Token", "USDT", 6);
    this.oracle = await NEST3PriceOracleMock.new();
    this.controller = await upgrades.deployProxy(CofiXController, [this.oracle.address]); // no deployer when deployProxy in test
  });

  it('should read through proxy correctly', async function () {
    let alpha = await this.controller.ALPHA({from: nonAdmin});
    let k_base = await this.controller.K_BASE({from: nonAdmin});
    console.log(`alpha:${alpha.toString()}, k_base:${k_base.toString()}`);
    expect(k_base).to.bignumber.equal(new BN('100000'));
  });

  it('should add price to price oracle mock correctly', async function () {
    // add enough prices in NEST3PriceOracleMock
    let ethAmount = new BN("10000000000000000000");
    let tokenAmount = new BN("3255000000");

    for (let i = 0; i < 50; i++) {
      await this.oracle.addPriceToList(USDT.address, ethAmount, tokenAmount, "0", { from: admin });
      tokenAmount = tokenAmount.mul(new BN("1001")).div(new BN("1000")); // very stable price
    }
    let priceLen = await this.oracle.getPriceLength(USDT.address);
    console.log("priceLen:", priceLen.toString(), ", tokenAmount:", tokenAmount.toString());
    expect(priceLen).to.bignumber.equal(new BN("50"));
  });

  it('should call queryOracle() through proxy correctly', async function () {
    let _msgValue = web3.utils.toWei('0.01', 'ether');
    let result = await this.controller.queryOracle(USDT.address, admin, { from: admin, value: _msgValue });
    console.log("receipt.gasUsed:", result.receipt.gasUsed);
    let evtArgs0 = result.receipt.logs[0].args;
    console.log("evtArgs0> K:", evtArgs0.K.toString(), ", sigma:", evtArgs0.sigma.toString(), ", T:", evtArgs0.T.toString(), ", ethAmount:", evtArgs0.ethAmount.toString(), ", erc20Amount:", evtArgs0.erc20Amount.toString());
  });

  it('should upgrade correctly', async function () {
    // must deployProxy here, could not use the one create in before setup
    await upgrades.upgradeProxy(this.controller.address, CofiXControllerV2, [this.oracle.address]);
    let alpha = await this.controller.ALPHA();
    let k_base = await this.controller.K_BASE();
    console.log(`alpha:${alpha.toString()}, k_base:${k_base.toString()}`);
    expect(k_base).to.bignumber.equal(new BN('1000000'));
  });
});