import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));

  const token = await ethers.getContractAt("RGDGToken", deployment.contracts.RGDGToken.address);
  const treasury = await ethers.getContractAt("RGDGTreasury", deployment.contracts.RGDGTreasury.address);

  const amount = ethers.parseEther("500000");

  console.log("Approving treasury to receive 500K RGDG...");
  const tx1 = await token.approve(deployment.contracts.RGDGTreasury.address, amount);
  await tx1.wait();
  console.log("Approved. TX:", tx1.hash);

  console.log("Depositing 500K RGDG into treasury...");
  const tx2 = await treasury.deposit(amount);
  await tx2.wait();
  console.log("Deposited. TX:", tx2.hash);

  const bal = await treasury.treasuryBalance();
  console.log("Treasury balance:", ethers.formatEther(bal), "RGDG");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
