# Holdify: SOL Track Demo

Holdify is a Solana protocol that allows users to deposit Liquid Staking Tokens (LSTs like jitoSOL and mSOL) and automatically converts the generated yield into AI credits for API usage. Your principal is 100% protected and you only spend the yield.

## Overview

This repository contains the V1 implementation of the Holdify **SOL Track**, built to handle the end-to-end flow of LST deposits, automated yield harvesting, and off-chain AI API settlements. 

The project is structured into three main layers:
1. **On-Chain Programs (Anchor)**
2. **Crank Bot (Automated Yield Harvesting)**
3. **Facilitator Server (Web2 API proxy and billing settlement)**
4. **Frontend Dashboard (Next.js)**

---

## 🏗️ 1. Solana Programs (Smart Contracts)

Located in `programs/` and `holdify-protocol/programs/`. Built with the Anchor framework.

- **`lst-registry`:** Manages the whitelist of allowed Liquid Staking Tokens and acts as an oracle for exchange rates.
- **`credit-ledger`:** Maintains the user's AI credit balance, derived from yield. Enforces daily spend limits.
- **`holdify-treasury`:** Holds the protocol's harvested USDC. Facilitates payouts to AI providers (facilitators). 
- **`holdify-sol-vault` (Core):** The primary vault where users deposit LSTs. Allows users to set customizable price floors and ceilings.

### Testing Contracts
To run the automated test suite locally:
```bash
anchor test
```

---

## ⚙️ 2. Off-Chain Infrastructure

### Crank Bot (Stage 6)
Located in `crank/`. A Node.js worker that monitors active vaults and periodically triggers the `harvest_epoch` instruction on-chain to convert accrued LST yield into USDC credits for users.

### Facilitator Server (Stage 7)
Located in `facilitator/`. An Express server that acts as a proxy for Web2 AI APIs (like OpenAI, Claude). It automatically verifies the user's on-chain credit balance, processes the API request, and then settles the cost on-chain from the user's ledger to the Treasury.

---

## 💻 3. Frontend Application

The Next.js frontend is located in the `app/` directory.

### Quick Start (Frontend)
1. Install dependencies:
```bash
cd app
npm install
```
2. Run the development server:
```bash
npm run dev
```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Development & Deployment

This project uses the Solana Devnet for initial testing. 

*Ensure you have at least 25 SOL in your devnet wallet for deployment and initialization. You can distribute this from `solana airdrop`.*
