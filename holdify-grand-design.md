# Holdify — Grand Design
## HOLD it Financing

> **"Your assets work while you hold. The yield funds your intelligence."**

---

## What Is Holdify

Holdify is a Solana protocol that converts the passive yield of idle crypto holdings into AI model credits — automatically, continuously, and without ever touching the principal.

A SOL holder deposits their LST. A USDC holder deposits their stablecoins. The protocol harvests yield every epoch or every week, converts it to USDC, and loads an x402 credit balance. Any AI endpoint — Claude, GPT, local models, AI agents — that uses the Dexter x402 payment standard draws from that balance transparently on each inference call.

The user never manually tops up. The user never sells their SOL. The yield pays for intelligence perpetually.

---

## The Problem Holdify Solves

There are two populations that should overlap but currently don't:

**SOL/stablecoin holders** sit on appreciating assets and earn passive yield (6–10% APY). That yield accrues invisibly — most holders never deploy it productively. It compounds back into more tokens they don't use.

**AI users** pay recurring subscription fees or per-token charges to access language models. Every month is a manual payment decision. For AI agents running autonomously, this creates a payment dependency that breaks workflows.

Holdify collapses these two populations into one. The yield from holding becomes the budget for intelligence. No manual action. No selling. No subscription management.

---

## Two Products, One Protocol

Holdify ships as two distinct product tracks sharing core infrastructure (credit ledger, treasury, settlement layer).

---

### Track 1 — SOL Track

**For:** SOL believers. People already holding jitoSOL, mSOL, JupSOL, bSOL, INF, or BNSOL who want their staking yield to work harder than compounding alone.

**Yield source:** Solana validator consensus. The same rewards that have existed since mainnet genesis — 6–7% APY depending on validator performance, MEV tips, and commission rates. This yield is as close to risk-free as Solana gets.

**How it works:**
Every Solana epoch (~2 days), the exchange rate between an LST token and SOL increases by a tiny fraction (~0.035%). That delta — and only that delta — is extracted by the protocol, swapped to USDC via Jupiter, and credited to the user's AI balance. The principal LST position never decreases.

**Price range feature:** Users set a SOL/USD price floor and ceiling. Below the floor, yield stays in LST and compounds (the user is expressing SOL conviction — they'd rather stack more LST at cheap prices than spend yield). Above the ceiling, 70% goes to credits and 30% auto-compounds (the user is banking on high SOL while still running AI). In the operating window, 100% converts to AI credits.

**Supported LSTs:**

| Token  | Issuer    | APY    | Pool Type        |
|--------|-----------|--------|------------------|
| jitoSOL| Jito      | 6.5–7.0%| SPL Stake Pool  |
| mSOL   | Marinade  | 6.2–6.8%| Marinade custom |
| bSOL   | BlazeStake| 6.3–6.9%| SPL Stake Pool  |
| JupSOL | Jupiter   | 6.5–7.0%| Sanctum SPL     |
| INF    | Sanctum   | 6.8–7.2%| Sanctum Infinity|
| BNSOL  | Binance   | 6.0–6.5%| SPL Stake Pool  |

**Minimum deposit:** 2 SOL equivalent. At $100/SOL (worst case), this generates ~4–5 AI messages/day from yield alone.

**Harvest cadence:** Every Solana epoch (~2 days), via permissionless crank.

---

### Track 2 — Stable Track (PST)

**For:** Stablecoin holders. People who want zero SOL price exposure but still want their idle USDC to fund AI usage.

**Yield source:** Huma Finance PayFi network. Businesses pay 6–10 basis points per day to access cross-border payment liquidity. That capital recycles every 1–5 days, compounding into ~8–10% APY in USDC. No crypto market dependency — yield comes from real economic activity (invoices, trade finance, payment settlement).

**How it works:**
User deposits USDC. Protocol immediately buys $PST (Huma's principal token, 1 PST = 1 USDC locked in Huma 2.0). PST accrues USDC yield from Huma's PayFi operations. Weekly, a crank claims the yield, takes protocol fees, and credits the user's AI balance — all in USDC, no swap needed on the yield leg.

**Key difference from SOL Track:** No price range feature. No SOL oracle. No epoch timing. Pure weekly USDC → USDC yield → AI credits. Simpler UX, slightly higher protocol margin (no Jupiter swap cost on yield conversion).

**Withdrawal:** Two exits available:
- **Fast exit (default):** Swap PST → USDC via Jupiter/Orca DEX pool. Near-instant. ~0.1–0.5% slippage. If slippage > 0.7%, automatically routes to standard exit.
- **Standard exit:** Huma redemption queue. 2–7 days. Zero slippage.

**Minimum deposit:** $200 USDC. Activation period: 23 days before first harvest (ensures $1+ yield accumulation to justify gas).

**Harvest cadence:** Weekly, via permissionless crank.

---

## Shared Infrastructure

Both tracks use the same underlying programs for credit management and settlement:

```
┌─────────────────────────────────────────────────────────────────┐
│                        HOLDIFY PROTOCOL                         │
│                                                                 │
│   SOL Track                    PST Stable Track                 │
│   ─────────────────            ────────────────                 │
│   holdify_sol_vault            holdify_stable_vault             │
│   6 LSTs supported             $PST / Huma Finance              │
│   ~2 day harvest               ~7 day harvest                   │
│   Price floor/ceiling          No price dependency              │
│                  │                          │                   │
│                  └──────────┬───────────────┘                   │
│                             │                                   │
│              ┌──────────────▼──────────────┐                    │
│              │      credit_ledger           │                    │
│              │  Unified USDC AI credit      │                    │
│              │  balance per user            │                    │
│              └──────────────┬──────────────┘                    │
│                             │                                   │
│              ┌──────────────▼──────────────┐                    │
│              │      holdify_treasury        │                    │
│              │  USDCPool + Kamino float     │                    │
│              │  Facilitator config          │                    │
│              │  Jupiter referral config     │                    │
│              └──────────────┬──────────────┘                    │
│                             │                                   │
│              ┌──────────────▼──────────────┐                    │
│              │   x402 Facilitator Server    │                    │
│              │   @dexterai/x402/server      │                    │
│              │   HTTP 402 → on-chain settle │                    │
│              └──────────────┬──────────────┘                    │
│                             │                                   │
│                    AI Provider receives USDC                     │
└─────────────────────────────────────────────────────────────────┘
```

**lst_registry** — the 6 LST token metadata and exchange rate deserialization logic. Extensible via governance.

**partner_registry** — B2B integrations. AI apps that embed Holdify earn tracked settlement volume.

---

## The x402 Payment Flow

Holdify uses the Dexter x402 SDK as its AI payment rails. x402 is an HTTP-native micropayment protocol: the AI server returns a `402 Payment Required` response with a `PAYMENT-REQUIRED` header; the client signs a USDC payment and retries with a `PAYMENT-SIGNATURE` header; the server verifies settlement and returns content.

Holdify's role in this flow:
- The **Holdify facilitator server** acts as the x402 payment agent for all users
- It holds no user funds — it is authorized to call `facilitator_settle` on-chain only up to each user's `CreditLedger` balance
- Settlement is atomic: CreditLedger debit and USDC transfer to AI provider happen in the same Solana transaction
- Users integrate via `@holdify/sdk` — a 5-line wrapper around `@dexterai/x402/client`

```typescript
// Any AI app integrates Holdify in 5 lines:
import { createHoldifyClient } from '@holdify/sdk';
const client = createHoldifyClient({
  ownerWallet,
  facilitatorEndpoint: 'https://api.holdify.finance'
});
const response = await client.fetch('https://api.anthropic.com/v1/messages', { ... });
// HTTP 402 handled automatically. Yield pays.
```

---

## Revenue Model — 7 Taps

Holdify targets **3–5% net margin on gross annual yield processed**, achieved through 7 non-duplicative revenue capture points stacked across the value flow.

| # | Tap | Rate | Where | Type |
|---|-----|------|-------|------|
| 1 | Jupiter Referral Fee | ~0.05% of each swap | Every LST→USDC and PST buy/sell | Passive |
| 2 | Harvest Conversion Fee | 0.70% of yield converted | Per epoch/week harvest | Primary P&L |
| 3 | Kamino Float Yield | ~4% APY on idle USDC | USDCPool idle balance | Engine |
| 4 | x402 Settlement Markup | 0.50% per AI call | Every AI model inference | Usage-based |
| 5 | Credit Withdrawal Fee | 0.30% on USDC cashout | User withdrawing unused credits | Occasional |
| 6 | B2B Partner Fee | Platform % on partner volume | AI apps embedding Holdify | Ecosystem |
| 7 | Premium Subscription | 0.5 USDC/month | Priority harvest + features | Recurring |

**Fee split per harvest:** 0.1% crank tip + 0.7% protocol + 99.2% user credit.

**Why Tap 3 (Kamino float) is load-bearing:**
Taps 1+2+4+5+6+7 combined yield ~1.2% net margin. Kamino float (4% APY on ~20% of TVL) adds ~0.8% of TVL annually — at $10M TVL that's $80,000/year. This is what pushes margin into the 3–5% target. Kamino integration is not optional; it is Phase 3 mandatory.

**Margin proof at $10M TVL:**

| Source | Annual Revenue |
|--------|----------------|
| Harvest fees (0.7% × $650K yield) | $4,550 |
| Kamino float (4% × 20% × $10M) | $80,000 |
| AI markup (0.5% × 80% utilization × $650K) | $2,600 |
| Jupiter referral + other fees | ~$500 |
| **Gross** | **~$87,650** |
| Infra + ops | −$18,000 |
| **Net** | **~$69,650 = 4.49% margin** ✓ |

---

## On-Chain Architecture — 6 Anchor Programs

| Program | Track | Purpose |
|---------|-------|---------|
| `holdify_sol_vault` | SOL | LST deposit, price range, epoch harvest, auto-compound |
| `holdify_stable_vault` | PST | USDC deposit, PST purchase, weekly harvest, dual-exit withdrawal |
| `credit_ledger` | Shared | USDC AI credit balance, debit authorization, daily limits |
| `holdify_treasury` | Shared | USDCPool, Kamino float, Jupiter referral, facilitator config |
| `lst_registry` | SOL | LST metadata, pool type branching, exchange rate deserialization |
| `partner_registry` | Shared | B2B integrations, settlement volume tracking |

All governance via **Squads v4 multisig** with 48-hour timelock on program upgrades.
All PDAs use canonical bumps, checked arithmetic everywhere (u128 intermediates for all u64 multiplications).

---

## Crank Network

Holdify uses a permissionless keeper architecture. Any operator running the crank earns:
- **SOL Track crank:** 0.1% of each vault's USDC harvest output
- **PST Stable Track crank:** 0.1% of each vault's USDC yield claim

No protocol-owned bots required. The 0.1% tip creates a competitive market of independent keepers. A single $1M TVL protocol generates approximately $650K/year in processed yield → $650/year in crank tips → economically rational for any operator with a VPS and an RPC subscription.

**SOL Track crank:** Runs every 3 minutes. Checks all vaults for `last_harvested_epoch < current_epoch`. Premium vaults processed first.

**PST Stable Track crank:** Runs every 6 hours. Checks for weekly cadence elapsed + activation complete. Also monitors pending Huma standard redemptions and calls `complete_withdrawal()` when resolved.

---

## User Journey

### SOL Track User
```
Day 0:   Deposit 5 jitoSOL. Set floor $100, ceiling $400. Choose casual.
         Receipt: 5 HOLD-SOL tokens (non-transferable).

Day 2:   First epoch passes. SOL at $155 (in window).
         Crank harvests: ~0.018% of 5 jitoSOL → $0.13 USDC credited.
         Push notification: "Your yield just funded 16 Claude messages."

Day 4:   Second epoch. SOL at $92 (below floor).
         No USDC conversion. Yield compounds as more jitoSOL.
         Notification: "SOL below your floor — yield is stacking as jitoSOL."

Day 6:   Third epoch. SOL at $148 (back in window).
         Crank harvests accumulated 1.5 epochs of yield → $0.20 USDC.
         AI agent automatically funded — no user action.

Day 365: ~$47.45 in AI credits generated from 5 jitoSOL.
         Principal: 5.00+ jitoSOL (auto-compounded during floor periods).
         SOL sold: 0.
```

### PST Stable Track User
```
Day 0:   Deposit $500 USDC. Fast exit selected.
         Protocol buys ~500 PST. Receipt: 500 HOLD-S tokens.
         Activation countdown: 23 days.

Day 23:  Activation unlocks. First harvest available.
         Crank harvests: ~$0.77 USDC yield (8% × $500 / 52 weeks).
         $0.76 credited to AI balance (after 0.8% fees).

Day 30:  Weekly harvest: another $0.76.
         User has spent $1.20 on AI calls this week — fully covered.

Day 180: ~$39.90 in AI credits generated.
         Principal: ~$500 USDC recoverable via fast exit.
         Manual payments made: 0.
```

---

## Frontend Structure (Next.js App Router)

```
holdify.finance/
├── /                    Landing + unified dashboard
├── /sol                 SOL Track dashboard (vault cards, harvest log)
├── /sol/deposit         LST deposit flow (5 steps)
├── /sol/settings        Price policy, premium, daily limit
├── /stable              PST Stable Track dashboard
├── /stable/deposit      USDC deposit flow (4 steps)
├── /stable/settings     Premium, withdrawal preference
├── /credits             Unified credit balance (both tracks)
│                        Spend history, x402 call log, withdrawal
└── /analytics           Protocol TVL, yield processed, Kamino APY,
                         Jupiter referral earned, partner volume
```

Key UX principles enforced across all screens:
- **Principal safety is visceral, not just text.** The word "principal" never appears without "never touched" nearby.
- **Below-floor state is a feature, not a bug.** Copy reads "yield is stacking as LST" not "harvest paused."
- **All fees disclosed before signing.** No surprises at confirmation.
- **Activation countdown on PST.** Users must feel their money is working during the 23-day window, not locked.
- **Unified credit balance.** Both tracks credit the same `CreditLedger`. Users see one number, not two.

---

## SDK for AI Developers (`@holdify/sdk`)

AI application developers integrate Holdify with 5 lines. The SDK wraps `@dexterai/x402/client` and routes all 402 payment handling through the Holdify facilitator on behalf of the user's credit balance.

```typescript
import { createHoldifyClient } from '@holdify/sdk';

const client = createHoldifyClient({
  ownerWallet: userPublicKey,
  facilitatorEndpoint: 'https://api.holdify.finance',
  partnerPubkey: myAppPublicKey,  // optional: earns partner tracking
});

// Drop-in replacement for fetch() — 402 handled automatically
const response = await client.fetch('https://my-ai-api.com/v1/chat', {
  method: 'POST',
  body: JSON.stringify({ messages: [...] })
});
```

Partners who integrate `@holdify/sdk` and register via `partner_registry` get:
- Settlement volume tracked on-chain per app
- Quarterly analytics report via on-chain events
- Partner badge on the Holdify analytics page
- Future revenue share as B2B program matures

---

## Security Design

| Concern | Solution |
|---|---|
| Program upgrades | Squads v4 multisig, 48-hour timelock |
| Oracle manipulation | Pyth staleness < 60s; >25% SOL deviation halts all harvests |
| Kamino liquidity crisis | Circuit breaker: halt Kamino deposits if TVL drops >30% in 24h |
| Facilitator key compromise | Per-user `CreditLedger` caps settlement; key rotation via `update_facilitator()` |
| Harvest double-spend | `last_harvested_epoch` guard — program rejects same-epoch second call |
| Arithmetic overflow | All u64 multiplications via u128 intermediate; checked_add/sub/mul everywhere |
| PST slippage | Fast exit auto-routes to standard queue if >0.7% slippage |
| Crank racing | Idempotent design — second crank calling same vault same epoch gets clean error, no funds affected |
| Principal safety | Only exchange rate *delta* (yield) is ever extracted; LST principal account is write-protected except by owner |

---

## Mainnet Deployment Cost

| Item | SOL |
|------|-----|
| 6 program binaries rent (permanent) | 11.12 SOL |
| 6 IDL accounts rent (permanent) | 1.07 SOL |
| PDA initialization | 0.05 SOL |
| Transaction fees (~3,000 txs) | 0.01 SOL |
| Operational reserve | 2.00 SOL |
| Safety buffer (10%) | 1.43 SOL |
| **Total permanent** | **15.68 SOL** |
| Buffer accounts (temporary, refunded) | +12.20 SOL |
| **Peak wallet needed on deploy day** | **~28 SOL** |

**USD at $150/SOL:** ~$2,353 permanent | ~$4,182 peak on deploy day.

### Phased deployment (recommended)

| Phase | Programs | SOL permanent | SOL peak |
|-------|----------|---------------|----------|
| Phase 1 — SOL Track | 5 programs | ~12.9 SOL | ~23 SOL |
| Phase 2 — Add PST Track | +1 program | +2.8 SOL | +5 SOL |

Deploy SOL Track first. Validate on mainnet. Add PST Track when SOL Track hits $500K TVL or after 60 days, whichever comes first.

**Recommendation: fund deployer wallet with 25 SOL before Phase 1 deployment.**

---

## Build Sequence (Full Protocol)

```
Phase 0   Foundations, stubs, tooling setup             Jon Skeet
Phase 1   LST Registry + SOL Vault core                 Both agents
Phase 2   Epoch harvest + full fee stack                Both agents
Phase 3   Kamino float integration                      Jon Skeet
Phase 4   x402 facilitator + settlement                 Jon Skeet
Phase 5   Revenue stack completion                      Jon Skeet
Phase 6   @holdify/sdk package                          Both agents
Phase 7   Frontend — SOL Track screens                  Both agents (heavy Jony Ive)
Phase 8   Security hardening + 80% test coverage        Both agents

── mainnet deploy SOL Track ──

Phase PST-1   Stable Vault core + dual-exit withdrawal  Both agents
Phase PST-2   Weekly yield harvest from Huma            Both agents
Phase PST-3   PST crank extension                       Jon Skeet
Phase PST-4   Frontend — PST Track screens              Both agents (heavy Jony Ive)
Phase PST-5   Full system integration                   Both agents

── mainnet deploy PST Track ──
```

Total: 13 build phases across two product launches.
Review loop: every phase must pass both "Anatoly Yakovenko" (systems correctness) and "Jony Ive" (DeFi UX) subagent reviews at 10/10 before proceeding.

---

## File Map

```
holdify/
├── GRAND_DESIGN.md                   ← this file
├── holdify-sol-track.md              ← SOL Track Claude Code instructions
├── holdify-pst-track.md              ← PST Stable Track Claude Code instructions
│
├── programs/
│   ├── holdify-sol-vault/            SOL Track LST vault
│   ├── holdify-stable-vault/         PST Stable Track vault
│   ├── credit-ledger/                Shared credit balance
│   ├── holdify-treasury/             Shared treasury + pool
│   ├── lst-registry/                 SOL Track LST metadata
│   └── partner-registry/             Shared B2B registry
│
├── crank/
│   ├── src/main.ts                   SOL Track crank (every 3 min)
│   └── src/stable-crank.ts           PST Track crank (every 6 hr)
│
├── facilitator/
│   ├── src/index.ts                  x402 facilitator server
│   ├── src/settler.ts                On-chain settlement logic
│   └── src/middleware.ts             Express AI proxy middleware
│
├── packages/
│   └── holdify-sdk/                  @holdify/sdk client library
│
├── app/
│   ├── app/page.tsx                  Landing + dashboard
│   ├── app/sol/                      SOL Track screens
│   ├── app/stable/                   PST Track screens
│   ├── app/credits/                  Unified credit management
│   └── app/analytics/                Protocol analytics
│
└── tests/
    └── integration/
        ├── sol_track_lifecycle.ts    Full SOL Track end-to-end
        ├── pst_track_lifecycle.ts    Full PST Track end-to-end
        └── unified_credits.ts        Cross-track credit unification
```

---

## The Pitch in Three Sentences

**For SOL holders:** Stop watching your staking yield silently compound. Point it at AI and let your conviction fund your intelligence.

**For USDC holders:** Your stablecoins sit idle earning 8% APY you never see. Holdify makes every dollar of that yield pay for something you actually use.

**For AI developers:** Stop asking your users to top up wallets. Embed `@holdify/sdk` and let their existing holdings pay the API bills forever.

---

*Holdify — HOLD it Financing.*
*Your assets work while you hold.*
