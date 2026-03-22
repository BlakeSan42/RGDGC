import { expect } from "chai";
import { ethers } from "hardhat";
import { RGDGToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RGDGToken", function () {
  let token: RGDGToken;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;

  const INITIAL_SUPPLY = 1_000_000n;
  const INITIAL_SUPPLY_WEI = INITIAL_SUPPLY * 10n ** 18n;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();
    const RGDGToken = await ethers.getContractFactory("RGDGToken");
    token = await RGDGToken.deploy(INITIAL_SUPPLY);
  });

  describe("Deployment", function () {
    it("should have correct name", async function () {
      expect(await token.name()).to.equal("River Grove Disc Golf Token");
    });

    it("should have correct symbol", async function () {
      expect(await token.symbol()).to.equal("RGDG");
    });

    it("should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("should mint initial supply to deployer", async function () {
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY_WEI);
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY_WEI);
    });

    it("should set deployer as owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("should allow owner to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await token.mint(player1.address, mintAmount);
      expect(await token.balanceOf(player1.address)).to.equal(mintAmount);
    });

    it("should reject minting by non-owner", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        token.connect(player1).mint(player1.address, mintAmount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should increase total supply on mint", async function () {
      const mintAmount = ethers.parseEther("5000");
      await token.mint(player1.address, mintAmount);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY_WEI + mintAmount);
    });
  });

  describe("Transfer", function () {
    it("should transfer tokens between accounts", async function () {
      const amount = ethers.parseEther("100");
      await token.transfer(player1.address, amount);
      expect(await token.balanceOf(player1.address)).to.equal(amount);
    });

    it("should fail when sender has insufficient balance", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        token.connect(player1).transfer(player2.address, amount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("should support approve and transferFrom", async function () {
      const amount = ethers.parseEther("500");
      await token.approve(player1.address, amount);
      await token
        .connect(player1)
        .transferFrom(owner.address, player2.address, amount);
      expect(await token.balanceOf(player2.address)).to.equal(amount);
    });
  });

  describe("Burning", function () {
    it("should allow holders to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      await token.transfer(player1.address, burnAmount);
      await token.connect(player1).burn(burnAmount);
      expect(await token.balanceOf(player1.address)).to.equal(0);
    });

    it("should decrease total supply on burn", async function () {
      const burnAmount = ethers.parseEther("100");
      await token.burn(burnAmount);
      expect(await token.totalSupply()).to.equal(
        INITIAL_SUPPLY_WEI - burnAmount
      );
    });

    it("should fail when burning more than balance", async function () {
      const amount = ethers.parseEther("1");
      await expect(
        token.connect(player1).burn(amount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("Pausing", function () {
    it("should allow owner to pause", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;
    });

    it("should block transfers when paused", async function () {
      await token.pause();
      await expect(
        token.transfer(player1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("should allow owner to unpause", async function () {
      await token.pause();
      await token.unpause();
      expect(await token.paused()).to.be.false;

      // Transfers should work again
      const amount = ethers.parseEther("100");
      await token.transfer(player1.address, amount);
      expect(await token.balanceOf(player1.address)).to.equal(amount);
    });

    it("should reject pause by non-owner", async function () {
      await expect(
        token.connect(player1).pause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("should reject unpause by non-owner", async function () {
      await token.pause();
      await expect(
        token.connect(player1).unpause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
