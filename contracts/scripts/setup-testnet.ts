import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentInfo {
  network: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
  contracts: {
    RGDGToken: { address: string; initialSupply: string };
    RGDGTreasury: { address: string; eventFee: string; initialFunding: string };
    DiscRegistry: { address: string };
  };
}

// Test wallet addresses for Sepolia testnet. Replace with your own or add more.
const TEST_ADDRESSES = [
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat #1
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Hardhat #2
];

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      "deployments.json not found. Run the deploy script first:\n" +
        "  npx hardhat run scripts/deploy.ts --network sepolia"
    );
  }

  const deployment: DeploymentInfo = JSON.parse(
    fs.readFileSync(deploymentsPath, "utf-8")
  );

  const [deployer] = await ethers.getSigners();
  console.log("Running testnet setup with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // Connect to deployed contracts
  const token = await ethers.getContractAt(
    "RGDGToken",
    deployment.contracts.RGDGToken.address
  );
  const treasury = await ethers.getContractAt(
    "RGDGTreasury",
    deployment.contracts.RGDGTreasury.address
  );
  const registry = await ethers.getContractAt(
    "DiscRegistry",
    deployment.contracts.DiscRegistry.address
  );

  // -------------------------------------------------------------------
  //  1. Set default event fee on treasury (10 RGDG)
  // -------------------------------------------------------------------
  console.log("--- Setting event fee ---");
  const eventFee = ethers.parseEther("10");
  const currentFee = await treasury.eventFee();

  if (currentFee === eventFee) {
    console.log("  Event fee already set to 10 RGDG, skipping.");
  } else {
    const tx1 = await treasury.setEventFee(eventFee);
    await tx1.wait();
    console.log("  Event fee set to 10 RGDG");
  }

  // -------------------------------------------------------------------
  //  2. Mint test tokens to test addresses
  // -------------------------------------------------------------------
  console.log("\n--- Minting test tokens ---");
  const mintAmount = ethers.parseEther("1000"); // 1,000 RGDG each

  for (const addr of TEST_ADDRESSES) {
    try {
      const tx = await token.mint(addr, mintAmount);
      await tx.wait();
      console.log(`  Minted 1,000 RGDG to ${addr}`);
    } catch (error: any) {
      console.error(`  Failed to mint to ${addr}: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------
  //  3. Register a test disc in DiscRegistry
  // -------------------------------------------------------------------
  console.log("\n--- Registering test disc ---");
  try {
    const tx = await registry.mint(
      deployer.address,    // owner
      "RGDG-TEST-001",     // discCode
      "Innova",            // manufacturer
      "Destroyer",         // mold
      "Star",              // plastic
      175,                 // weightGrams
      "Red"                // color
    );
    const receipt = await tx.wait();
    console.log("  Test disc registered (RGDG-TEST-001 / Star Destroyer)");
    console.log(`  Transaction: ${receipt?.hash}`);
  } catch (error: any) {
    if (error.message.includes("code already used")) {
      console.log("  Test disc already registered, skipping.");
    } else {
      console.error(`  Failed to register disc: ${error.message}`);
    }
  }

  // -------------------------------------------------------------------
  //  Summary
  // -------------------------------------------------------------------
  const treasuryBalance = await treasury.treasuryBalance();
  const deployerBalance = await token.balanceOf(deployer.address);
  const totalSupply = await token.totalSupply();
  const currentEventFee = await treasury.eventFee();

  console.log("\n========================================");
  console.log("  Testnet Setup Complete");
  console.log("========================================");
  console.log(`  Network:           ${deployment.network} (${deployment.chainId})`);
  console.log(`  Token supply:      ${ethers.formatEther(totalSupply)} RGDG`);
  console.log(`  Treasury balance:  ${ethers.formatEther(treasuryBalance)} RGDG`);
  console.log(`  Deployer balance:  ${ethers.formatEther(deployerBalance)} RGDG`);
  console.log(`  Event fee:         ${ethers.formatEther(currentEventFee)} RGDG`);
  console.log(`  Test tokens minted to ${TEST_ADDRESSES.length} addresses`);
  console.log(`  Test disc registered: RGDG-TEST-001`);
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
