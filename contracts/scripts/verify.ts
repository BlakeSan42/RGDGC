import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

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

  const network = await ethers.provider.getNetwork();
  console.log(`Verifying contracts on chain ${network.chainId}...\n`);

  // -------------------------------------------------------------------
  //  1. Verify RGDGToken
  // -------------------------------------------------------------------
  const initialSupplyRaw = deployment.contracts.RGDGToken.initialSupply;
  const initialSupply = parseInt(initialSupplyRaw.replace(/[^0-9]/g, ""), 10);

  console.log("--- Verifying RGDGToken ---");
  console.log(`  Address: ${deployment.contracts.RGDGToken.address}`);
  console.log(`  Constructor arg: initialSupply = ${initialSupply}`);
  try {
    await run("verify:verify", {
      address: deployment.contracts.RGDGToken.address,
      constructorArguments: [initialSupply],
    });
    console.log("  RGDGToken verified successfully!\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("  RGDGToken is already verified.\n");
    } else {
      console.error("  Failed to verify RGDGToken:", error.message, "\n");
    }
  }

  // -------------------------------------------------------------------
  //  2. Verify RGDGTreasury
  // -------------------------------------------------------------------
  const tokenAddress = deployment.contracts.RGDGToken.address;
  const eventFee = ethers.parseEther("10"); // matches deploy script default

  console.log("--- Verifying RGDGTreasury ---");
  console.log(`  Address: ${deployment.contracts.RGDGTreasury.address}`);
  console.log(`  Constructor args: token=${tokenAddress}, eventFee=${eventFee}`);
  try {
    await run("verify:verify", {
      address: deployment.contracts.RGDGTreasury.address,
      constructorArguments: [tokenAddress, eventFee],
    });
    console.log("  RGDGTreasury verified successfully!\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("  RGDGTreasury is already verified.\n");
    } else {
      console.error("  Failed to verify RGDGTreasury:", error.message, "\n");
    }
  }

  // -------------------------------------------------------------------
  //  3. Verify DiscRegistry
  // -------------------------------------------------------------------
  console.log("--- Verifying DiscRegistry ---");
  console.log(`  Address: ${deployment.contracts.DiscRegistry.address}`);
  try {
    await run("verify:verify", {
      address: deployment.contracts.DiscRegistry.address,
      constructorArguments: [],
    });
    console.log("  DiscRegistry verified successfully!\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("  DiscRegistry is already verified.\n");
    } else {
      console.error("  Failed to verify DiscRegistry:", error.message, "\n");
    }
  }

  // -------------------------------------------------------------------
  //  Summary
  // -------------------------------------------------------------------
  console.log("========================================");
  console.log("  Etherscan Verification Complete");
  console.log("========================================");
  console.log(
    `  View on Etherscan:\n` +
      `    Token:    https://sepolia.etherscan.io/address/${deployment.contracts.RGDGToken.address}\n` +
      `    Treasury: https://sepolia.etherscan.io/address/${deployment.contracts.RGDGTreasury.address}\n` +
      `    Registry: https://sepolia.etherscan.io/address/${deployment.contracts.DiscRegistry.address}`
  );
  console.log("========================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
