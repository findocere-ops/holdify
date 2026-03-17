# Holdify — PST Stable Track (Claude Code Instructions)

**Project:** Holdify — HOLD it Financing
**Tagline:** Your USDC works while you hold.
**This file covers:** Stable Track only — PST/Huma yield → AI credits pipeline.
**Companion file:** `holdify-sol-track.md` covers the SOL Track (LST yield).

You are building the Stable Track of Holdify. Users deposit USDC, the protocol buys and holds Huma Finance $PST (PayFi Strategy Token), harvests USDC yield weekly (~8% APY from real-world payment financing), and loads an x402 credit balance. No SOL price exposure. No epoch timing dependency. Pure stablecoin yield funding AI credits.

The USDC never leaves the protocol's reach. The yield funds intelligence.

---

## PST Economics — Read This Before Writing Any Code

### What PST Actually Is

PST is **not** a liquid staking token in the Solana validator sense. It is a principal token for Huma Finance's PayFi liquidity pool.

- 1 PST is minted by depositing 1 USDC into Huma 2.0
- Yield comes from fees paid by businesses accessing payment liquidity (6–10 bps/day)
- Capital recycles every 1–5 days, compounding into ~8–12% APY in USDC
- Yield is denominated in **USDC** — no swap needed, no SOL price dependency
- PST mint address: `59obFNBzyTBGowrkif5uK7ojS58vsuWz3ZCvg6tfZAGw`

> ⚠️ Verify this mint address on Solscan mainnet before deployment: `solana account 59obFNBzyTBGowrkif5uK7ojS58vsuWz3ZCvg6tfZAGw`

### PST Modes — Use Classic Only

Huma offers two modes:
- **Classic** ($PST): Base APY (~8%) paid in USDC + lower $HUMA token rewards
- **Maxi** ($mPST): Forgo base APY for higher $HUMA rewards

**Always use Classic ($PST) mode.** Maxi yield comes in $HUMA which would require an additional swap to USDC — adding complexity and slippage that eliminates the PST track's primary advantage (direct USDC yield, no swap needed on the yield leg).

### APY Reference

| Mode    | USDC APY | $HUMA Rewards | Use for Holdify |
|---------|----------|---------------|-----------------|
| Classic | ~8–10%   | Lower         | ✓ YES           |
| Maxi    | 0%       | Higher        | ✗ NO            |

Conservative protocol default for projections: **8% APY in USDC**.

### Minimum Deposit Threshold

Target: 5 AI messages/day at $0.008/message.

```
daily_cost          = 5 × $0.008 = $0.04
required_annual     = $0.04 × 365 = $14.60
min_principal       = $14.60 / 8% = $182.50
round up + buffer   = $200 USDC minimum (enforced on-chain)
```

### Activation Period (Economic Minimum)

Harvest gas cost ≈ $0.002. Minimum harvest to make gas cost < 0.2% of output = $1.00 USDC.

```
days_to_accumulate_$1_at_min_deposit = $1.00 / ($200 × 8% / 365) = 22.8 days
```

**Minimum activation period: 23 days** before first harvest is permitted.

At $200 minimum, weekly harvest yields: `$200 × 8% / 52 = $0.31/week` — 155× the gas cost threshold. Economically sound from week 1 after activation.

### Yield Harvest Cadence

PST yield does not follow Solana epoch timing. Use **weekly harvest** (~7 days between harvests). Rationale:
- Huma distributes yield on an ongoing basis, not epoch-aligned
- Weekly cadence gives $0.31+ per harvest at minimum deposit
- Crank runs weekly per vault, not every 2 days like SOL Track
- Reduces transaction overhead vs daily harvesting

---

## Redemption — The Fast Exit Solution

PST has two exit paths. Both must be implemented.

### Standard Exit (Huma Redemption Queue)
Initiate redemption with Huma directly. Processed within 2–7 days per Huma's SLA. Zero slippage. Full USDC returned.

### Fast Exit (Jupiter Swap — Default)
PST trades on Jupiter via the PST-USDC Orca liquidity pool. Secondary market price ≈ $1.00 ± slippage.

- Typical slippage for $200–$2,000 withdrawal: 0.1–0.5%
- Swap executes in 1 Solana transaction (<1 second)
- User also pays 0.3% Holdify withdrawal fee regardless of exit route
- Total cost fast exit: ~0.4–0.8% of withdrawn amount
- Total cost standard exit: 0.3% Holdify fee + 0 slippage + 2–7 day wait

**Default behavior on `request_withdrawal()`: fast exit via Jupiter.** 
User can explicitly set `use_standard_redemption = true` to wait for Huma queue.

**Slippage guard for fast exit:** If quoted USDC output < 99.3% of PST amount (slippage > 0.7%), reject the fast exit and fall back to standard redemption automatically. Never let the user lose more than 0.7% to slippage — the Holdify withdrawal fee is 0.3%, total cost should never exceed 1.0%.

---

## Revenue Model (PST Stable Track)

PST Track has a slightly different revenue structure from SOL Track — simpler and higher-margin on the yield conversion leg (no Jupiter swap fee on the yield itself).

```
USDC deposited
  │
  ▼
Protocol buys PST via Jupiter (one-time on deposit)
  ├─ [Tap 1] Jupiter referral fee ~0.05% on deposit swap
  ▼
PST held in vault PDA, yield accrues in Huma
  │
  ▼ (weekly harvest)
Huma USDC yield claimed
  ├─ [Tap 2] Harvest yield fee: 0.7% protocol + 0.1% crank tip
  │          (no swap cost on yield leg — pure USDC to USDC)
  ▼
USDC deposited to shared USDCPool
  ├─ [Tap 3] Kamino float yield ~4% APY on idle balance (shared with SOL Track)
  ▼
CreditLedger updated
  ├─ [Tap 4] x402 settlement markup: 0.5% per AI call (shared facilitator)
  ├─ [Tap 5] Credit withdrawal fee: 0.3% (fast or standard exit)
  └─ [Tap 7] Premium subscription: 0.5 USDC/month
```

**Margin comparison vs SOL Track:**
- SOL Track yield leg: LST → Jupiter swap → USDC (pays ~0.1–0.3% Jupiter platform fee)
- PST Stable Track yield leg: Huma distributes USDC directly — **zero swap cost on yield**
- Result: PST Track has ~0.15% higher effective margin per unit of yield processed

Fee split per harvest: **0.1% crank tip + 0.7% protocol + 99.2% user credit**.

---

## Core Flow

1. User deposits USDC (minimum $200) via `holdify_stable_vault::deposit`.
2. Vault buys PST via Jupiter CPI (PST/USDC pool, includes referral account).
3. PST held in vault PDA-owned token account.
4. Protocol issues non-transferable HOLD-S receipt token to user.
5. `activation_ts = now`. Harvests blocked for 23 days.
6. After activation, weekly permissionless crank calls `harvest_yield()`.
7. Crank claims USDC yield from Huma (on-chain CPI or off-chain signed instruction — see ADR-PST-2).
8. Fee split: 0.1% crank tip, 0.7% protocol, 99.2% user credit.
9. CPI to `holdify_treasury::deposit_to_pool` and `credit_ledger::add_credit`.
10. User AI calls → x402 → same facilitator as SOL Track → `credit_ledger` debit → USDC to AI provider.
11. Withdrawal: user calls `request_withdrawal(use_standard_redemption)`. Fast exit (default): vault swaps PST → USDC via Jupiter, applies 0.3% fee, transfers net USDC to user. Standard exit: initiates Huma redemption queue, user gets USDC in 2–7 days.

---

## Architecture Decision Records

ADR-PST-1: PST Track shares `credit_ledger`, `holdify_treasury`, and `partner_registry` with SOL Track. `CreditLedger` accepts `add_credit` CPIs from both `holdify_sol_vault` and `holdify_stable_vault`. Users with both vaults have a single unified credit balance. This is the correct design — the AI doesn't care which yield source funded the credit.

ADR-PST-2: Huma yield claim mechanism. Huma 2.0 distributes yield as claimable USDC on-chain. Before implementing `harvest_yield()`, verify via the Huma docs/SDK whether yield is claimable via on-chain CPI to the Huma program or via an off-chain signed transaction. If CPI: implement fully on-chain. If off-chain: the crank calls the Huma API to get a signed claim instruction, then submits it to the Solana validator. Either path works — the crank is the executor. Document the actual mechanism in `TECH_NOTES.md` after verification.

ADR-PST-3: Fast exit via Jupiter uses the PST-USDC Orca pool. Set slippage tolerance at 0.7% maximum. If Jupiter quotes slippage > 0.7%, automatically fall back to standard Huma redemption (2–7 days). Never force the user into a >0.7% slippage swap. Emit `WithdrawalRouteChanged { reason: "slippage_exceeded", fallback: "huma_queue" }` event.

ADR-PST-4: Standard redemption creates a `WithdrawalRequest` sub-account on the vault. This tracks `pending_usdc`, `requested_at`, and `huma_redemption_id`. The crank polls for redemption completion and calls `complete_withdrawal()`. The crank's role is expanded vs SOL Track — it also monitors pending standard redemptions.

ADR-PST-5: PST bought on deposit, not held as user-provided tokens. The user deposits USDC; the protocol buys PST. This simplifies the user experience (no need for users to hold PST before using Holdify) and lets the protocol batch purchase logic if desired in future. On withdrawal, PST is sold back to USDC, never returned raw.

ADR-PST-6: No price range feature on PST Track. PST yield is in USDC — there is no SOL price dependency. The `sol_price_floor` / `sol_price_ceiling` mechanic is irrelevant here. PST vaults always harvest if `activated && weekly_cadence_elapsed && yield >= $1.00`. This makes PST Track UX significantly simpler than SOL Track.

ADR-PST-7: Activation period (23 days) is a strict on-chain guard. Harvest attempts before `now >= activation_ts + 23 * 86400` return `ErrorCode::VaultNotYetActivated`. This prevents dust harvests with uneconomic gas ratios. The activation countdown is shown prominently in the frontend.

ADR-PST-8: Weekly harvest cadence uses a `last_harvested_ts` timestamp, not epoch number. `harvest_yield()` requires `now - last_harvested_ts >= 7 * 86400` (7 days). This is independent of Solana epoch timing.

ADR-PST-9: PST Track premium tier costs the same 0.5 USDC/month as SOL Track, debited from `CreditLedger`. Same benefits: priority crank processing (harvested before standard vaults), webhook notifications, analytics API. Implemented identically to SOL Track premium.

---

## Blockchain Layer — 1 Additional Anchor Program

SOL Track programs `credit_ledger`, `holdify_treasury`, and `partner_registry` are **shared** — no new deployments needed for PST Track. Only one new program required:

### Program 6: `holdify_stable_vault`

**`StableVault` account** (PDA: `[b"stable_vault", owner.key()]`):

```rust
pub struct StableVault {
    pub owner: Pubkey,
    pub pst_balance: u64,                  // raw PST tokens held by vault
    pub usdc_deposited: u64,               // original USDC principal
    pub usdc_yield_claimed_total: u64,     // lifetime USDC yield harvested
    pub last_harvested_ts: i64,            // unix timestamp of last harvest
    pub activation_ts: i64,               // deposit timestamp; harvests blocked 23 days
    pub is_premium: bool,
    pub premium_renewal_ts: i64,          // next unix timestamp for premium debit
    pub withdrawal_request: Option<WithdrawalRequest>,
    pub receipt_mint: Pubkey,
    pub bump: u8,
}

pub struct WithdrawalRequest {
    pub pending_usdc: u64,
    pub requested_at: i64,
    pub use_standard_redemption: bool,
    pub huma_redemption_id: Option<[u8; 32]>,
}
```

**Instructions:**

1. `deposit(usdc_amount)`
   - Validate `usdc_amount >= 200_000_000` ($200 minimum, 6 decimals).
   - Transfer `usdc_amount` USDC from owner ATA to vault PDA USDC ATA.
   - Jupiter swap CPI: `usdc_amount` USDC → PST via PST/USDC pool. Include `referral_account` (Tap 1). Slippage tolerance: 0.5% (tight — this is a near-1:1 swap). Validate output PST ≈ usdc_amount (within 0.5%).
   - Store PST in vault PDA PST ATA. Set `pst_balance = pst_received`.
   - Set `usdc_deposited = usdc_amount`.
   - Set `activation_ts = Clock::get().unix_timestamp`.
   - Set `last_harvested_ts = activation_ts`.
   - If `enable_premium`: `is_premium = true`, `premium_renewal_ts = activation_ts + 30 * 86400`.
   - Mint `usdc_amount` non-transferable HOLD-S receipt tokens (Token-2022) to owner.
   - Emit `StableVaultDeposited { owner, usdc_amount, pst_received, activation_ts }`.

2. `harvest_yield()`
   - **Permissionless.**
   - Activation guard: `require!(now >= activation_ts + 23 * 86400, ErrorCode::VaultNotYetActivated)`.
   - Cadence guard: `require!(now - last_harvested_ts >= 7 * 86400, ErrorCode::HarvestTooEarly)`.
   - Minimum yield guard: require that claimed USDC yield >= 1_000_000 (1 USDC). If below minimum: update `last_harvested_ts`, return without crediting (avoid gas waste on dust).
   - Premium billing: if `is_premium && now >= premium_renewal_ts`: CPI `credit_ledger::debit(owner, 500_000, "premium_sub")`. If fails: `is_premium = false`, emit `PremiumLapsed`.
   - Claim USDC yield from Huma (see ADR-PST-2 for mechanism). Store `usdc_yield`.
   - **Fee split (checked arithmetic):**
     ```rust
     let crank_tip    = usdc_yield.checked_mul(10).unwrap().checked_div(10_000).unwrap();
     let protocol_fee = usdc_yield.checked_mul(70).unwrap().checked_div(10_000).unwrap();
     let user_credit  = usdc_yield.checked_sub(crank_tip).unwrap()
                                  .checked_sub(protocol_fee).unwrap();
     ```
   - Transfer `crank_tip` to crank caller USDC ATA.
   - CPI `holdify_treasury::deposit_fee(protocol_fee)`.
   - CPI `holdify_treasury::deposit_to_pool(owner, user_credit)`.
   - CPI `credit_ledger::add_credit(owner, user_credit)`.
   - Update `last_harvested_ts = now`, `usdc_yield_claimed_total += user_credit`.
   - Emit `StableYieldHarvested { owner, usdc_yield, crank_tip, protocol_fee, user_credit }`.

3. `request_withdrawal(use_standard_redemption)`
   - Owner only.
   - Require no existing `withdrawal_request` in progress.
   - Burn HOLD-S receipt tokens.
   - If `use_standard_redemption == false` (fast exit, default):
     - Jupiter swap CPI: `pst_balance` PST → USDC via PST/USDC pool. Slippage check: if `quoted_usdc < pst_balance × 99_300_000 / 100_000_000` (slippage > 0.7%), emit `WithdrawalRouteChanged`, set `use_standard_redemption = true`, fall through to standard path.
     - If slippage OK: apply 0.3% fee. Transfer net USDC to owner ATA. Transfer fee to treasury.
     - Set `pst_balance = 0`. If `withdrawal_request == None` (successful fast exit), close vault account, return rent. Emit `FastWithdrawalCompleted`.
   - If `use_standard_redemption == true` (or slippage fallback):
     - Initiate Huma redemption (CPI or crank-signed — per ADR-PST-2).
     - Set `withdrawal_request = WithdrawalRequest { pending_usdc: usdc_deposited, requested_at: now, use_standard_redemption: true, huma_redemption_id: <from Huma> }`.
     - Emit `StandardWithdrawalInitiated { owner, pending_usdc, estimated_days: 7 }`.

4. `complete_withdrawal()`
   - Permissionless (crank detects Huma redemption completion and calls this).
   - Require `withdrawal_request.is_some()` and Huma has released funds.
   - Transfer USDC from vault to owner: gross minus 0.3% Holdify fee.
   - Transfer 0.3% fee to treasury.
   - Close vault account, return rent to owner.
   - Emit `StandardWithdrawalCompleted { owner, usdc_received, fee }`.

5. `cancel_withdrawal_request()`
   - Owner only. Only callable if standard redemption not yet processed by Huma.
   - Cancel Huma redemption request (if Huma supports cancellation — check docs).
   - Re-mint HOLD-S receipt tokens.
   - Clear `withdrawal_request`.

**Events:**
```rust
StableVaultDeposited { owner, usdc_amount, pst_received, activation_ts }
StableYieldHarvested { owner, usdc_yield, crank_tip, protocol_fee, user_credit }
FastWithdrawalCompleted { owner, pst_sold, usdc_received, slippage_bps, fee }
StandardWithdrawalInitiated { owner, pending_usdc, estimated_days }
WithdrawalRouteChanged { owner, reason, fallback }
StandardWithdrawalCompleted { owner, usdc_received, fee }
PremiumLapsed { owner }
VaultNotYetActivated { owner, activation_ts, harvest_available_at }
```

---

## Crank Extension for PST Track (`crank/src/stable-crank.ts`)

The PST crank runs on a different schedule from the SOL crank. It:
- Runs every 6 hours (checking weekly cadence, not every 3 minutes like SOL)
- Harvests vaults where `now - last_harvested_ts >= 7 * 86400`
- Monitors pending `WithdrawalRequest` accounts and calls `complete_withdrawal()` when Huma redemptions resolve
- Premium vaults processed first (same pattern as SOL crank)

```typescript
// crank/src/stable-crank.ts
async function runStableCrank() {
  const now = Math.floor(Date.now() / 1000);

  // 1. Harvest ripe vaults
  const ripePremiumVaults = await program.account.stableVault.all([
    { memcmp: { offset: IS_PREMIUM_OFFSET, bytes: 'Ag==' } },
    // last_harvested_ts + 604800 <= now
  ]);
  const ripeStandardVaults = await program.account.stableVault.all([
    // activated + 23 days <= now, last_harvested + 7 days <= now, not premium
  ]);

  for (const vault of [...ripePremiumVaults, ...ripeStandardVaults]) {
    if (now - vault.account.lastHarvestedTs.toNumber() < 7 * 86400) continue;
    if (now - vault.account.activationTs.toNumber() < 23 * 86400) continue;
    try {
      await program.methods.harvestYield()
        .accounts({ stableVault: vault.publicKey, ... })
        .rpc();
    } catch (e) {
      console.error(`Stable harvest failed: ${vault.publicKey.toBase58()} — ${e.message}`);
    }
  }

  // 2. Complete pending standard redemptions
  const pendingWithdrawals = await program.account.stableVault.all([
    // withdrawal_request.is_some() && use_standard_redemption == true
  ]);
  for (const vault of pendingWithdrawals) {
    const redemptionComplete = await checkHumaRedemption(
      vault.account.withdrawalRequest.humaRedemptionId
    );
    if (redemptionComplete) {
      await program.methods.completeWithdrawal()
        .accounts({ stableVault: vault.publicKey, ... })
        .rpc();
    }
  }
}

setInterval(runStableCrank, 6 * 60 * 60 * 1000); // every 6 hours
```

---

## Frontend (Next.js — PST Track Screens)

### Pages

**`/stable` — Stable Track Dashboard**
Hero: "Your $X USDC earns ~$Y.YY/week → ~Z AI messages/week."
Activation countdown if within first 23 days: "Activation in X days — yield is already accruing, first harvest available [date]."
Withdrawal status card if pending standard redemption.

**`/stable/deposit` — PST Deposit Flow**
Step 1: Enter USDC amount. Minimum $200. Real-time projection widget.
Step 2: Choose exit preference (shown as a simple toggle, not a technical menu):
  - "Instant exit" — swap via DEX, ~0.2% slippage, immediate
  - "Patient exit" — Huma queue, 2–7 days, zero slippage
  Copy: "You can change this anytime before requesting withdrawal."
Step 3: Activation timeline shown: "First harvest available on [date in 23 days]."
Step 4: Sign.

**`/stable/settings`** — premium toggle, weekly harvest log.
**`/credits`** — unified with SOL Track. Single balance from both yield sources.

### `StableYieldProjectionWidget`

```typescript
export function StableYieldProjectionWidget({ usdcAmount, enablePremium }) {
  const APY = 0.08; // 8% conservative
  const weeklyYieldGross = (usdcAmount * APY) / 52;
  const weeklyYieldNet = weeklyYieldGross * (1 - 0.008); // 0.8% fees
  const premiumCost = enablePremium ? 0.5 / 4.33 : 0; // weekly equivalent
  const weeklyAiCredit = weeklyYieldNet - premiumCost;
  const msgsPerWeek = Math.floor(weeklyAiCredit / 0.008);
  const activationDate = new Date(Date.now() + 23 * 86400 * 1000);

  return (
    <div>
      <Stat label="Weekly AI credit" value={`$${weeklyAiCredit.toFixed(3)}`} />
      <Stat label="Est. messages/week" value={`~${msgsPerWeek}`} />
      <Stat label="Annual yield rate" value="~8% APY in USDC" />
      <ActivationNote>First harvest: {activationDate.toLocaleDateString()}</ActivationNote>
      <FeeNote>
        Fees: 0.8% of yield harvested + 0.5% per AI call · Your $X USDC principal is always recoverable
      </FeeNote>
    </div>
  );
}
```

---

## Build Phases — PST Stable Track

Build PST Track **after** SOL Track Phase 4 is complete. PST Track depends on `credit_ledger`, `holdify_treasury`, and `partner_registry` already being deployed and tested.

### Phase PST-1: Stable Vault Core
`holdify_stable_vault::deposit` with Jupiter PST purchase, activation timer, receipt minting. `request_withdrawal` with fast exit (Jupiter swap, slippage guard, 0.3% fee). `complete_withdrawal` for standard redemption. Full unit tests: deposit math, minimum enforcement, receipt mint/burn, fast exit slippage guard, standard exit state machine.
→ **Both subagents.**

### Phase PST-2: Yield Harvest
`harvest_yield` with Huma yield claim (implement after verifying Huma's claim mechanism — CPI vs off-chain per ADR-PST-2). Activation guard. Weekly cadence guard. Minimum yield guard ($1.00 USDC). Full fee split. Premium billing. Extend SOL Track integration tests to include PST Track yield flow.
→ **Both subagents.**

### Phase PST-3: PST Crank Extension
`crank/src/stable-crank.ts` — weekly harvest scanner + pending redemption monitor. Run both cranks (SOL + PST) from same process. Test race condition: two cranks attempting same vault's harvest simultaneously.
→ **Jon Skeet only.**

### Phase PST-4: Frontend Stable Track
`/stable/*` pages. `StableYieldProjectionWidget`. Activation countdown. Withdrawal route toggle (instant vs patient). Unified credit balance with SOL Track.
→ **Both subagents — Jony Ive focus on activation period UX (users must not feel their money is locked) and withdrawal route clarity (instant vs patient should feel like a preference, not a risk choice).**

### Phase PST-5: Full System Integration
End-to-end test with both SOL Track and PST Track running simultaneously. User has jitoSOL vault AND PST vault. Both harvest independently. Both credit the same `CreditLedger`. Single AI call draws from unified balance regardless of source. Full lamport accounting.
→ **Both subagents final review.**

---

## Testing Strategy (PST-specific)

### Unit Tests

**`deposit`:**
- Minimum $200 enforced (199.99 fails, 200.00 passes)
- Jupiter PST purchase within 0.5% slippage tolerance
- Activation timestamp set correctly
- Receipt tokens minted equal to USDC deposited

**`harvest_yield`:**
- Blocks before 23-day activation: `VaultNotYetActivated` error
- Blocks within 7-day cadence: `HarvestTooEarly` error
- Below $1.00 minimum yield: no credit, `last_harvested_ts` updated
- Fee split: `crank_tip + protocol_fee + user_credit == usdc_yield` exactly (test with prime numbers)
- Premium billing success and lapse

**`request_withdrawal` fast exit:**
- Normal slippage (0.3%): completes, 0.3% fee deducted, USDC transferred
- Slippage > 0.7%: route changed to standard redemption, `WithdrawalRouteChanged` emitted
- Standard redemption: `WithdrawalRequest` created, receipt burned, vault NOT closed
- `complete_withdrawal`: vault closed after standard redemption, rent returned

### Integration Test (bankrun)

1. User deposits $500 USDC. Verify PST purchased, receipt minted.
2. Attempt harvest at day 10 → `VaultNotYetActivated`.
3. Advance 23 days. Harvest attempt at day 23 + 1 hour → succeeds.
4. Attempt second harvest same day → `HarvestTooEarly`.
5. Mock $2.00 USDC yield. Verify: crank = $0.002, protocol = $0.014, user = $1.984. Sum = $2.000.
6. User CreditLedger shows $1.984. SOL Track user CreditLedger also present (different owner) — verify no cross-contamination.
7. Fast exit: mock Jupiter quote at 0.2% slippage → succeeds, vault closed.
8. New deposit. Mock Jupiter quote at 0.8% slippage → routes to standard redemption automatically.
9. Crank detects Huma redemption complete → `complete_withdrawal` called, USDC transferred, vault closed.
10. Zero lamport discrepancy.

---

## Environment Variables (PST-specific additions)

```env
HOLDIFY_STABLE_VAULT_PROGRAM_ID=HoStb...
PST_MINT=59obFNBzyTBGowrkif5uK7ojS58vsuWz3ZCvg6tfZAGw
HUMA_PROGRAM_ID=<Huma Finance Solana program ID — fetch from Huma docs>
HUMA_POOL_STATE=<Huma 2.0 pool state account — fetch from Huma docs>
PST_USDC_ORCA_POOL=<PST-USDC Orca pool address — fetch from Orca/Jupiter>
PST_WITHDRAWAL_SLIPPAGE_MAX_BPS=70   # 0.70% slippage ceiling for fast exit
PST_MIN_HARVEST_USDC=1000000         # $1.00 in atomic units
PST_ACTIVATION_DAYS=23
PST_HARVEST_INTERVAL_DAYS=7
```

> ⚠️ Huma program ID and pool state account must be fetched from official Huma Finance documentation before deployment. Do not guess or derive these addresses.

---

## Notes for Claude Code Agent

Before writing any `harvest_yield()` implementation:
1. Fetch `https://docs.huma.finance` and search for "yield claim" and "CPI" and "program ID"
2. If Huma yield is claimable via on-chain CPI: implement fully in the instruction with correct account structure
3. If Huma yield requires off-chain claim (signed by Huma oracle/facilitator): implement as a two-step flow where the crank fetches the signed claim instruction from Huma's API and submits it as part of the `harvest_yield` transaction
4. Document the actual mechanism in `programs/holdify-stable-vault/HUMA_INTEGRATION.md`

This is the one unknown in the PST Track architecture. Everything else is deterministic.
