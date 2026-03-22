# RGDGC Smart Contracts - Sepolia Testnet Deployment Guide

Step-by-step guide to deploy the RGDGC contracts (RGDGToken, RGDGTreasury, DiscRegistry) to the Sepolia testnet.

## Prerequisites

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **A wallet with Sepolia ETH** (see faucets below)
- **Alchemy or Infura API key** for Sepolia RPC access
- **Etherscan API key** for contract verification

### Get Sepolia ETH (Faucets)

| Faucet | URL | Notes |
|--------|-----|-------|
| Alchemy Sepolia | https://sepoliafaucet.com | Requires Alchemy account |
| Infura Sepolia | https://www.infura.io/faucet/sepolia | Requires Infura account |
| Google Cloud | https://cloud.google.com/application/web3/faucet/ethereum/sepolia | Free, no account needed |
| Chainlink | https://faucets.chain.link/sepolia | Requires wallet connection |

You need approximately **0.05 Sepolia ETH** for deployment and verification.

### Get API Keys

| Service | URL | Purpose |
|---------|-----|---------|
| Alchemy | https://www.alchemy.com | Sepolia RPC endpoint |
| Infura | https://www.infura.io | Alternative Sepolia RPC endpoint |
| Etherscan | https://etherscan.io/apis | Contract verification |

## Step 1: Set Up Environment

```bash
cd contracts
cp .env.example .env
```

Edit `.env` with your values:

```env
# Alchemy example
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Infura example (alternative)
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Your deployer wallet private key (NEVER share or commit this)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Optional: enable gas reporting
REPORT_GAS=false
```

> **Security:** The `.env` file is gitignored. Never commit your private key.

### Export Your Private Key

- **MetaMask:** Account details > Show private key
- **Use a dedicated deployer wallet** -- do not use your main wallet

## Step 2: Install Dependencies and Compile

```bash
npm install
npm run compile
```

## Step 3: Run Tests

Always run tests before deploying:

```bash
npm run test
```

For gas usage report:

```bash
REPORT_GAS=true npm run test
```

## Step 4: Deploy to Sepolia

```bash
npm run deploy:sepolia
```

This will:
1. Deploy **RGDGToken** with 1,000,000 initial supply
2. Deploy **RGDGTreasury** with the token address and 10 RGDG default event fee
3. Deploy **DiscRegistry** (ERC-721 for disc tracking)
4. Transfer 500,000 RGDG to the treasury
5. Save all addresses to `deployments.json`

Expected output:

```
Deploying contracts with account: 0x...
Account balance: 0.05 ETH

--- Deploying RGDGToken ---
RGDGToken deployed to: 0x...

--- Deploying RGDGTreasury ---
RGDGTreasury deployed to: 0x...

--- Deploying DiscRegistry ---
DiscRegistry deployed to: 0x...

--- Funding Treasury ---
Treasury balance: 500000.0 RGDG

========================================
  RGDGC Contract Deployment Complete
========================================
```

## Step 5: Verify on Etherscan

Wait 30-60 seconds after deployment for Etherscan to index the contracts, then:

```bash
npx hardhat run scripts/verify.ts --network sepolia
```

This verifies all 3 contracts with their constructor arguments. Once verified, you can read/write to contracts directly on Etherscan.

## Step 6: Run Post-Deployment Setup

```bash
npx hardhat run scripts/setup-testnet.ts --network sepolia
```

This will:
- Confirm the event fee is set to 10 RGDG
- Mint 1,000 RGDG to test wallet addresses
- Register a test disc NFT (Star Destroyer)
- Print a summary of the testnet state

## Step 7: Wire Up the Backend

Generate the environment variables needed by the FastAPI backend:

```bash
npx hardhat run scripts/wire-backend.ts --network sepolia
```

This outputs the env vars and saves them to `backend-env.txt`. Add them to your backend `.env`:

```env
RGDG_TOKEN_ADDRESS=0x...
TREASURY_ADDRESS=0x...
DISC_REGISTRY_ADDRESS=0x...
WEB3_PROVIDER_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
WEB3_CHAIN_ID=11155111
```

## Contract Addresses

After deployment, addresses are saved in `contracts/deployments.json`:

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "deployer": "0x...",
  "deployedAt": "2026-03-22T...",
  "contracts": {
    "RGDGToken": { "address": "0x..." },
    "RGDGTreasury": { "address": "0x..." },
    "DiscRegistry": { "address": "0x..." }
  }
}
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run compile` | Compile contracts |
| `npm run test` | Run test suite |
| `npm run deploy:local` | Deploy to local Hardhat network |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npx hardhat run scripts/verify.ts --network sepolia` | Verify on Etherscan |
| `npx hardhat run scripts/setup-testnet.ts --network sepolia` | Post-deploy setup |
| `npx hardhat run scripts/wire-backend.ts --network sepolia` | Generate backend env vars |

## Troubleshooting

### "Insufficient funds"
Your deployer wallet needs Sepolia ETH. Use a faucet from the list above.

### "Nonce too high" / "Nonce already used"
Reset your MetaMask nonce: Settings > Advanced > Clear activity tab data.

### Verification fails
- Wait at least 60 seconds after deployment
- Check that `ETHERSCAN_API_KEY` is set correctly
- Etherscan may take a few minutes to index new contracts

### "Already Verified"
The contract is already verified -- this is fine, the script handles this gracefully.

### Deploy script hangs
Check your `SEPOLIA_RPC_URL` is correct and the Alchemy/Infura service is up.
