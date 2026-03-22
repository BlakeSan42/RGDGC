import { expect } from "chai";
import { ethers } from "hardhat";
import { DiscRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DiscRegistry", function () {
  let registry: DiscRegistry;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let finder: HardhatEthersSigner;

  // Sample disc data
  const disc1 = {
    discCode: "RGDG-001",
    manufacturer: "Innova",
    mold: "Destroyer",
    plastic: "Star",
    weightGrams: 175,
    color: "Blue",
  };

  const disc2 = {
    discCode: "RGDG-002",
    manufacturer: "Discraft",
    mold: "Buzzz",
    plastic: "ESP",
    weightGrams: 177,
    color: "Green",
  };

  beforeEach(async function () {
    [owner, player1, player2, finder] = await ethers.getSigners();
    const DiscRegistry = await ethers.getContractFactory("DiscRegistry");
    registry = await DiscRegistry.deploy();
  });

  async function mintDisc(
    to: string,
    disc: typeof disc1
  ): Promise<bigint> {
    const tx = await registry.mint(
      to,
      disc.discCode,
      disc.manufacturer,
      disc.mold,
      disc.plastic,
      disc.weightGrams,
      disc.color
    );
    const receipt = await tx.wait();
    // Token ID is 1-based sequential
    return 1n; // First mint is always ID 1
  }

  describe("Minting", function () {
    it("should mint a disc NFT with correct metadata", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );

      const info = await registry.getDiscInfo(1);
      expect(info.manufacturer).to.equal(disc1.manufacturer);
      expect(info.mold).to.equal(disc1.mold);
      expect(info.plastic).to.equal(disc1.plastic);
      expect(info.weightGrams).to.equal(disc1.weightGrams);
      expect(info.color).to.equal(disc1.color);
      expect(info.discCode).to.equal(disc1.discCode);
      expect(info.registeredAt).to.be.gt(0);
    });

    it("should assign ownership correctly", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      expect(await registry.ownerOf(1)).to.equal(player1.address);
    });

    it("should emit DiscRegistered event", async function () {
      await expect(
        registry.mint(
          player1.address,
          disc1.discCode,
          disc1.manufacturer,
          disc1.mold,
          disc1.plastic,
          disc1.weightGrams,
          disc1.color
        )
      )
        .to.emit(registry, "DiscRegistered")
        .withArgs(
          1,
          player1.address,
          disc1.discCode,
          disc1.manufacturer,
          disc1.mold
        );
    });

    it("should reject duplicate disc codes", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      await expect(
        registry.mint(
          player2.address,
          disc1.discCode,
          disc1.manufacturer,
          disc1.mold,
          disc1.plastic,
          disc1.weightGrams,
          disc1.color
        )
      ).to.be.revertedWith("DiscRegistry: code already used");
    });

    it("should reject empty disc code", async function () {
      await expect(
        registry.mint(
          player1.address,
          "",
          disc1.manufacturer,
          disc1.mold,
          disc1.plastic,
          disc1.weightGrams,
          disc1.color
        )
      ).to.be.revertedWith("DiscRegistry: empty disc code");
    });

    it("should reject minting by non-owner", async function () {
      await expect(
        registry
          .connect(player1)
          .mint(
            player1.address,
            disc1.discCode,
            disc1.manufacturer,
            disc1.mold,
            disc1.plastic,
            disc1.weightGrams,
            disc1.color
          )
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should increment token IDs", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      await registry.mint(
        player2.address,
        disc2.discCode,
        disc2.manufacturer,
        disc2.mold,
        disc2.plastic,
        disc2.weightGrams,
        disc2.color
      );
      expect(await registry.ownerOf(1)).to.equal(player1.address);
      expect(await registry.ownerOf(2)).to.equal(player2.address);
    });
  });

  describe("Lost and Found Flow", function () {
    beforeEach(async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
    });

    it("should allow owner to report disc lost", async function () {
      await expect(registry.connect(player1).reportLost(1))
        .to.emit(registry, "DiscLost")
        .withArgs(1, player1.address);
      expect(await registry.discStatus(1)).to.equal(1); // Lost
    });

    it("should reject report lost by non-owner", async function () {
      await expect(
        registry.connect(player2).reportLost(1)
      ).to.be.revertedWith("DiscRegistry: not disc owner");
    });

    it("should allow anyone to report a lost disc found", async function () {
      await registry.connect(player1).reportLost(1);
      await expect(
        registry.connect(finder).reportFound(1, finder.address)
      )
        .to.emit(registry, "DiscFound")
        .withArgs(1, finder.address, player1.address);
      expect(await registry.discStatus(1)).to.equal(2); // Found
      expect(await registry.discFinder(1)).to.equal(finder.address);
    });

    it("should reject report found when disc is not lost", async function () {
      await expect(
        registry.connect(finder).reportFound(1, finder.address)
      ).to.be.revertedWith("DiscRegistry: disc not lost");
    });

    it("should allow owner to confirm return", async function () {
      await registry.connect(player1).reportLost(1);
      await registry.connect(finder).reportFound(1, finder.address);
      await expect(registry.connect(player1).confirmReturn(1))
        .to.emit(registry, "DiscReturned")
        .withArgs(1, player1.address);
      expect(await registry.discStatus(1)).to.equal(0); // Active
    });

    it("should reject confirm return by non-owner", async function () {
      await registry.connect(player1).reportLost(1);
      await registry.connect(finder).reportFound(1, finder.address);
      await expect(
        registry.connect(player2).confirmReturn(1)
      ).to.be.revertedWith("DiscRegistry: not disc owner");
    });

    it("should complete full lost-found-returned cycle", async function () {
      // Active -> Lost -> Found -> Active
      expect(await registry.discStatus(1)).to.equal(0);
      await registry.connect(player1).reportLost(1);
      expect(await registry.discStatus(1)).to.equal(1);
      await registry.connect(finder).reportFound(1, finder.address);
      expect(await registry.discStatus(1)).to.equal(2);
      await registry.connect(player1).confirmReturn(1);
      expect(await registry.discStatus(1)).to.equal(0);
    });
  });

  describe("Transfer", function () {
    beforeEach(async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
    });

    it("should transfer disc ownership", async function () {
      await expect(registry.connect(player1).transferDisc(1, player2.address))
        .to.emit(registry, "DiscTransferred")
        .withArgs(1, player1.address, player2.address);
      expect(await registry.ownerOf(1)).to.equal(player2.address);
    });

    it("should reset status to Active on transfer", async function () {
      await registry.connect(player1).reportLost(1);
      // Owner can still transfer even if lost
      await registry.connect(player1).transferDisc(1, player2.address);
      expect(await registry.discStatus(1)).to.equal(0); // Active
    });

    it("should reject transfer by non-owner", async function () {
      await expect(
        registry.connect(player2).transferDisc(1, player2.address)
      ).to.be.revertedWith("DiscRegistry: not disc owner");
    });

    it("should reject transfer to zero address", async function () {
      await expect(
        registry.connect(player1).transferDisc(1, ethers.ZeroAddress)
      ).to.be.revertedWith("DiscRegistry: zero address");
    });
  });

  describe("Lookup by Disc Code", function () {
    it("should find disc by code", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      expect(await registry.getDiscByCode(disc1.discCode)).to.equal(1);
    });

    it("should revert for unregistered code", async function () {
      await expect(
        registry.getDiscByCode("DOES-NOT-EXIST")
      ).to.be.revertedWith("DiscRegistry: code not found");
    });

    it("should map multiple codes to correct token IDs", async function () {
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      await registry.mint(
        player2.address,
        disc2.discCode,
        disc2.manufacturer,
        disc2.mold,
        disc2.plastic,
        disc2.weightGrams,
        disc2.color
      );
      expect(await registry.getDiscByCode(disc1.discCode)).to.equal(1);
      expect(await registry.getDiscByCode(disc2.discCode)).to.equal(2);
    });
  });

  describe("Access Control", function () {
    it("should set deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should have correct NFT name and symbol", async function () {
      expect(await registry.name()).to.equal("RGDGC Disc Registry");
      expect(await registry.symbol()).to.equal("DISC");
    });

    it("should track total supply via ERC721Enumerable", async function () {
      expect(await registry.totalSupply()).to.equal(0);
      await registry.mint(
        player1.address,
        disc1.discCode,
        disc1.manufacturer,
        disc1.mold,
        disc1.plastic,
        disc1.weightGrams,
        disc1.color
      );
      expect(await registry.totalSupply()).to.equal(1);
    });
  });
});
