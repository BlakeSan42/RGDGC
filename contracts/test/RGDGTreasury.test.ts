import { expect } from "chai";
import { ethers } from "hardhat";
import { RGDGToken, RGDGTreasury } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RGDGTreasury", function () {
  let token: RGDGToken;
  let treasury: RGDGTreasury;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let player3: HardhatEthersSigner;

  const INITIAL_SUPPLY = 1_000_000n;
  const EVENT_FEE = ethers.parseEther("10"); // 10 RGDG

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // Deploy token
    const RGDGToken = await ethers.getContractFactory("RGDGToken");
    token = await RGDGToken.deploy(INITIAL_SUPPLY);

    // Deploy treasury
    const RGDGTreasury = await ethers.getContractFactory("RGDGTreasury");
    treasury = await RGDGTreasury.deploy(await token.getAddress(), EVENT_FEE);

    // Give players some tokens
    const playerTokens = ethers.parseEther("1000");
    await token.transfer(player1.address, playerTokens);
    await token.transfer(player2.address, playerTokens);
    await token.transfer(player3.address, playerTokens);

    // Fund treasury
    const treasuryFunding = ethers.parseEther("100000");
    await token.approve(await treasury.getAddress(), treasuryFunding);
    await treasury.deposit(treasuryFunding);
  });

  describe("Fee Payment", function () {
    it("should accept event fee from player", async function () {
      await token
        .connect(player1)
        .approve(await treasury.getAddress(), EVENT_FEE);
      await expect(treasury.connect(player1).payEventFee())
        .to.emit(treasury, "FeePaid")
        .withArgs(player1.address, EVENT_FEE, (v: any) => true);
    });

    it("should transfer tokens from player to treasury", async function () {
      const balBefore = await token.balanceOf(player1.address);
      await token
        .connect(player1)
        .approve(await treasury.getAddress(), EVENT_FEE);
      await treasury.connect(player1).payEventFee();
      const balAfter = await token.balanceOf(player1.address);
      expect(balBefore - balAfter).to.equal(EVENT_FEE);
    });

    it("should fail without approval", async function () {
      await expect(
        treasury.connect(player1).payEventFee()
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("should fail when fee is zero", async function () {
      await treasury.setEventFee(0);
      await expect(
        treasury.connect(player1).payEventFee()
      ).to.be.revertedWith("Treasury: event fee not set");
    });
  });

  describe("Withdrawal", function () {
    it("should allow owner to withdraw", async function () {
      const amount = ethers.parseEther("5000");
      await expect(treasury.withdraw(player1.address, amount))
        .to.emit(treasury, "Withdrawal")
        .withArgs(player1.address, amount);
      expect(await token.balanceOf(player1.address)).to.equal(
        ethers.parseEther("1000") + amount
      );
    });

    it("should reject withdrawal by non-owner", async function () {
      await expect(
        treasury
          .connect(player1)
          .withdraw(player1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });

    it("should reject withdrawal to zero address", async function () {
      await expect(
        treasury.withdraw(ethers.ZeroAddress, ethers.parseEther("100"))
      ).to.be.revertedWith("Treasury: zero address");
    });

    it("should reject zero-amount withdrawal", async function () {
      await expect(
        treasury.withdraw(player1.address, 0)
      ).to.be.revertedWith("Treasury: zero amount");
    });
  });

  describe("Batch Payment (Prize Distribution)", function () {
    it("should distribute prizes to multiple winners", async function () {
      const recipients = [player1.address, player2.address, player3.address];
      const amounts = [
        ethers.parseEther("300"), // 1st place
        ethers.parseEther("200"), // 2nd place
        ethers.parseEther("100"), // 3rd place
      ];

      await expect(treasury.distributePrizes(recipients, amounts))
        .to.emit(treasury, "PrizeDistributed");

      // Each player had 1000 RGDG, plus prize
      expect(await token.balanceOf(player1.address)).to.equal(
        ethers.parseEther("1300")
      );
      expect(await token.balanceOf(player2.address)).to.equal(
        ethers.parseEther("1200")
      );
      expect(await token.balanceOf(player3.address)).to.equal(
        ethers.parseEther("1100")
      );
    });

    it("should reject mismatched arrays", async function () {
      await expect(
        treasury.distributePrizes(
          [player1.address, player2.address],
          [ethers.parseEther("100")]
        )
      ).to.be.revertedWith("Treasury: length mismatch");
    });

    it("should reject empty arrays", async function () {
      await expect(
        treasury.distributePrizes([], [])
      ).to.be.revertedWith("Treasury: empty arrays");
    });

    it("should reject batch payment by non-owner", async function () {
      await expect(
        treasury
          .connect(player1)
          .distributePrizes(
            [player2.address],
            [ethers.parseEther("100")]
          )
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });
  });

  describe("Event Fee Management", function () {
    it("should allow owner to update fee", async function () {
      const newFee = ethers.parseEther("20");
      await expect(treasury.setEventFee(newFee))
        .to.emit(treasury, "FeeUpdated")
        .withArgs(EVENT_FEE, newFee);
      expect(await treasury.eventFee()).to.equal(newFee);
    });

    it("should reject fee update by non-owner", async function () {
      await expect(
        treasury.connect(player1).setEventFee(ethers.parseEther("20"))
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });
  });

  describe("Treasury Balance", function () {
    it("should report correct balance", async function () {
      expect(await treasury.treasuryBalance()).to.equal(
        ethers.parseEther("100000")
      );
    });
  });
});
