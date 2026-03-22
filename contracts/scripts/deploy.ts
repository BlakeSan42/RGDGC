import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // -------------------------------------------------------------------
  //  1. Deploy RGDGToken with 1,000,000 initial supply
  // -------------------------------------------------------------------
  console.log("\n--- Deploying RGDGToken ---");
  const RGDGToken = await ethers.getContractFactory("RGDGToken");
  const initialSupply = 1_000_000; // 1M tokens (constructor applies decimals)
  const token = await RGDGToken.deploy(initialSupply);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("RGDGToken deployed to:", tokenAddress);
  console.log(
    "Total supply:",
    ethers.formatEther(await token.totalSupply()),
    "RGDG"
  );

  // -------------------------------------------------------------------
  //  2. Deploy RGDGTreasury with token address
  // -------------------------------------------------------------------
  console.log("\n--- Deploying RGDGTreasury ---");
  const RGDGTreasury = await ethers.getContractFactory("RGDGTreasury");
  const defaultEventFee = ethers.parseEther("10"); // 10 RGDG default fee
  const treasury = await RGDGTreasury.deploy(tokenAddress, defaultEventFee);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("RGDGTreasury deployed to:", treasuryAddress);

  // -------------------------------------------------------------------
  //  3. Deploy DiscRegistry
  // -------------------------------------------------------------------
  console.log("\n--- Deploying DiscRegistry ---");
  const DiscRegistry = await ethers.getContractFactory("DiscRegistry");
  const registry = await DiscRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("DiscRegistry deployed to:", registryAddress);

  // -------------------------------------------------------------------
  //  4. Transfer 500,000 RGDG to the treasury
  // -------------------------------------------------------------------
  console.log("\n--- Funding Treasury ---");
  const treasuryAllocation = ethers.parseEther("500000"); // 500K RGDG

  // Approve treasury to receive tokens, then deposit
  await token.approve(treasuryAddress, treasuryAllocation);
  await treasury.deposit(treasuryAllocation);

  console.log(
    "Treasury balance:",
    ethers.formatEther(await treasury.treasuryBalance()),
    "RGDG"
  );
  console.log(
    "Deployer remaining balance:",
    ethers.formatEther(await token.balanceOf(deployer.address)),
    "RGDG"
  );

  // -------------------------------------------------------------------
  //  5. Save deployment info
  // -------------------------------------------------------------------
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      RGDGToken: {
        address: tokenAddress,
        initialSupply: `${initialSupply} RGDG`,
      },
      RGDGTreasury: {
        address: treasuryAddress,
        eventFee: "10 RGDG",
        initialFunding: "500,000 RGDG",
      },
      DiscRegistry: {
        address: registryAddress,
      },
    },
  };

  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment info saved to deployments.json");

  // -------------------------------------------------------------------
  //  Summary
  // -------------------------------------------------------------------
  console.log("\n========================================");
  console.log("  RGDGC Contract Deployment Complete");
  console.log("========================================");
  console.log(`  RGDGToken:    ${tokenAddress}`);
  console.log(`  RGDGTreasury: ${treasuryAddress}`);
  console.log(`  DiscRegistry: ${registryAddress}`);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
