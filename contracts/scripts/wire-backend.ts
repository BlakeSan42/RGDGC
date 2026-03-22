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

  const sepoliaRpcUrl =
    process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY";

  const envVars = [
    `# RGDGC Contract Addresses (${deployment.network}, chain ${deployment.chainId})`,
    `# Deployed: ${deployment.deployedAt}`,
    `# Deployer: ${deployment.deployer}`,
    ``,
    `RGDG_TOKEN_ADDRESS=${deployment.contracts.RGDGToken.address}`,
    `TREASURY_ADDRESS=${deployment.contracts.RGDGTreasury.address}`,
    `DISC_REGISTRY_ADDRESS=${deployment.contracts.DiscRegistry.address}`,
    `WEB3_PROVIDER_URL=${sepoliaRpcUrl}`,
    `WEB3_CHAIN_ID=${deployment.chainId}`,
  ].join("\n");

  console.log("\n========================================");
  console.log("  Backend Environment Variables");
  console.log("========================================\n");
  console.log(envVars);
  console.log("\n========================================\n");

  // Write to a file for easy copy-paste
  const outputPath = path.join(__dirname, "..", "backend-env.txt");
  fs.writeFileSync(outputPath, envVars + "\n");
  console.log(`Saved to: ${outputPath}`);
  console.log("Copy these values into your backend .env file.\n");

  // Also check if the backend .env exists and offer guidance
  const backendEnvPath = path.join(__dirname, "..", "..", "backend", ".env");
  if (fs.existsSync(backendEnvPath)) {
    console.log(
      `Tip: Your backend .env exists at:\n  ${backendEnvPath}\n` +
        "  Append the above variables to that file."
    );
  } else {
    console.log(
      "Tip: Create a .env file in the backend/ directory with these variables."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
