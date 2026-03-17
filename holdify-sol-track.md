# Holdify — SOL Track (Claude Code Instructions)

**Project:** Holdify — HOLD it Financing
**Tagline:** Your SOL works while you hold.
**This file covers:** SOL Track only — LST yield → AI credits pipeline.
**Companion file:** `holdify-pst-track.md` covers the Stable Track (PST/USDC).

You are building the SOL Track of Holdify, a Solana protocol that converts SOL Liquid Staking Token yield into AI model credits via the x402 payment protocol. Users deposit LST (jitoSOL, mSOL, bSOL, JupSOL, INF, BNSOL), configure a SOL price operating window, and the protocol harvests per-epoch yield, swaps it to USDC via Jupiter, and loads an x402 credit balance. Any AI endpoint protected by `@dexterai/x402` draws from that balance transparently.

The SOL never moves. The yield funds intelligence.

---

## Yield Economics — Read This Before Writing Any Code

### Epoch Timing
One Solana epoch = 432,000 slots × 400 ms = 172,800 seconds ≈ **2.0 days**.
Epochs per year ≈ 182.5.

### APY Reference by LST

| LST    | APY Range  | Notes                              |
|--------|------------|------------------------------------|
| jitoSOL| 6.5–7.0%   | MEV-boosted, top validator set     |
| mSOL   | 6.2–6.8%   | Marinade dynamic delegation        |
| bSOL   | 6.3–6.9%   | BlazeStake, SPL standard           |
| JupSOL | 6.5–7.0%   | Jupiter validator, Sanctum-based   |
| INF    | 6.8–7.2%   | Sanctum Infinity basket, highest   |
| BNSOL  | 6.0–6.5%   | Binance, centralized validator     |

Conservative protocol default for projections: **6.5% APY**.

### Per-Epoch Yield Rate
```
epoch_yield_rate = 6.5% / 182.5 = 0.03562% per epoch
```

Never hardcode this on-chain. Always compute from actual LST/SOL exchange rate delta.

### Minimum Deposit Threshold

Target: 5 AI messages/day from yield alone at worst-case SOL price ($100).

```
daily_cost      = 5 × $0.008 = $0.04
annual_cost     = $14.60
min_principal   = $14.60 / 6.5% = $224.62
at $100/SOL     = 2.25 SOL → round up to 2 SOL minimum (enforced on-chain)
```

### Price Range Feature

Users set two parameters stored in `UserVault`:

- `sol_price_floor` (u64, USDC atomic units, 6 dec): If Pyth reports SOL below this, yield stays as LST and compounds. User is saying: "SOL is cheap — I'd rather compound than spend yield."
- `sol_price_ceiling` (u64): If SOL is above this, 70% of yield → USDC credits, 30% auto-compounds back into the vault position.

```
price < floor:       yield stays in LST, no USDC this epoch
floor ≤ price ≤ ceil: 100% yield → USDC → credits
price > ceil:        70% yield → USDC → credits, 30% → auto-compound
```

Defaults: floor = $80 (80_000_000), ceiling = $500 (500_000_000).

---

## Revenue Model (SOL Track)

```
LST in vault
  │
  ├─ [Tap 1] Jupiter referral fee ~0.05% of swap
  ▼
Jupiter LST→USDC swap
  │
  ├─ [Tap 2] Harvest conversion fee: 0.7% protocol + 0.1% crank tip
  ▼
USDC deposited to USDCPool
  │
  ├─ [Tap 3] Kamino float yield ~4% APY on idle balance
  ▼
CreditLedger updated
  │
  ├─ [Tap 4] x402 settlement markup: 0.5% per AI call
  │
  ├─ [Tap 5] Credit withdrawal fee: 0.3%
  │
  ├─ [Tap 6] B2B partner integration fee
  │
  └─ [Tap 7] Premium subscription: 0.5 USDC/month
```

Fee split per harvest: **0.1% crank tip + 0.7% protocol + 99.2% user credit**.
Target net margin: **3–5% of gross annual yield processed**.
Kamino float is load-bearing — without it, margin drops to ~1.2%.

---

## Supported LST Registry

| Token  | Mint Address                                    | Pool Type         |
|--------|------------------------------------------------|-------------------|
| jitoSOL| `J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn`| SplStakePool      |
| mSOL   | `mSoLzYCxHdYgdziU6SFzLN5bF9JBPSozJXXkMNUHNHg` | Marinade          |
| bSOL   | `bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1` | SplStakePool      |
| JupSOL | `jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v` | SplStakePool      |
| INF    | `5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm`| SanctumInfinity   |
| BNSOL  | `BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85` | SplStakePool      |

> ⚠️ Before using INF and BNSOL addresses: run `solana account <MINT>` on mainnet-beta to confirm validity. These have lower verification confidence than jitoSOL/mSOL/bSOL.

### `PoolType` Enum

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum PoolType {
    SplStakePool,     // total_lamports / pool_token_supply
    Marinade,         // msol_price field, fixed-point 9 dec
    SanctumInfinity,  // infinity_sol_value / inf_token_supply
}
```

### Exchange Rate Reading Per LST

**SplStakePool (jitoSOL, bSOL, JupSOL, BNSOL):**
`rate = total_stake_lamports / pool_mint_supply` — both u64 in pool state at known offsets.

**Marinade (mSOL):**
`rate = msol_price` — stored directly as u64, fixed-point 9 decimals.

**SanctumInfinity (INF):**
`rate = infinity_pool_sol_value / inf_token_supply` — read from Sanctum Infinity program state. Fetch the pool state pubkey at init via `https://sanctum-s-api.fly.dev/v1/lst-state/INF`, store in `LSTMeta::stake_pool_state`.

All three normalize to: **lamports per 1 LST token (u64, 9 decimal places)**.

Shared utility function: `read_exchange_rate(account_info, pool_type) -> Result<u64>`.

---

## Core Flow

1. User deposits N LST → vault issues non-transferable reHOLD receipt token (SPL Token-2022).
2. User sets `sol_price_floor` and `sol_price_ceiling`.
3. Every ~2 days, permissionless crank calls `harvest_epoch()`.
4. Crank reads Pyth SOL/USD price and LST/SOL exchange rate delta.
5. Price range check applied. Yield fraction swapped to USDC via Jupiter (with referral account).
6. Fees split: 0.1% crank, 0.7% protocol treasury, 99.2% user credit.
7. Idle USDC in pool auto-deployed to Kamino for float yield.
8. User's `CreditLedger` incremented.
9. User calls x402-protected AI endpoint → HTTP 402 returned.
10. Holdify facilitator checks `CreditLedger`, applies 0.5% markup, calls `facilitator_settle`.
11. USDC transferred atomically to AI provider. Credit debited. AI responds.

---

## Blockchain Layer — 5 Anchor Programs

### Program 1: `holdify_sol_vault`

**`UserVault` account** (PDA: `[b"sol_vault", owner.key(), lst_mint.key()]`):

```rust
pub struct UserVault {
    pub owner: Pubkey,
    pub lst_mint: Pubkey,
    pub lst_deposited_amount: u64,
    pub lst_exchange_rate_at_deposit: u64,   // lamports per LST, 9 dec
    pub lst_exchange_rate_last_harvest: u64,
    pub last_harvested_epoch: u64,
    pub sol_price_floor: u64,                // USDC atomic, 6 dec
    pub sol_price_ceiling: u64,
    pub total_yield_harvested_usdc: u64,
    pub total_yield_skipped_lst: u64,
    pub swap_skipped_epochs: u16,
    pub is_premium: bool,
    pub premium_renewal_epoch: u64,
    pub deposited_at: i64,
    pub receipt_mint: Pubkey,
    pub bump: u8,
}
```

**Instructions:**

1. `deposit(lst_amount, sol_price_floor, sol_price_ceiling, enable_premium)`
   - Validate `lst_mint` active in `lst_registry`.
   - Read exchange rate → validate `lst_amount × rate / 1e9 >= 2_000_000_000` (2 SOL min).
   - Validate `floor >= 10_000_000`, `floor < ceiling`.
   - Transfer LST to vault PDA ATA.
   - Mint `lst_amount` non-transferable receipt tokens (Token-2022) to owner.
   - Set `last_harvested_epoch = current_epoch`.
   - If `enable_premium`: `is_premium = true`, `premium_renewal_epoch = current_epoch + 15`.

2. `withdraw(lst_amount)`
   - Burn receipt tokens.
   - Transfer LST from vault ATA to owner.
   - Full withdrawal → close `UserVault`, return rent to owner.
   - `CreditLedger` unaffected — user keeps earned credits.

3. `update_price_policy(new_floor, new_ceiling)`
   - Owner only. Validate `new_floor >= 10_000_000`, `new_floor < new_ceiling`.

4. `toggle_premium(enable)`
   - Owner only. Enable: set flag + renewal epoch. Disable: clear flag, no refund.

5. `harvest_epoch(jupiter_swap_data)`
   - **Permissionless.**
   - Epoch guard: `current_epoch > last_harvested_epoch` — else `ErrorCode::AlreadyHarvestedThisEpoch`.
   - Pyth read: validate `publish_time` freshness < 60s. Read `sol_price_usd`.
   - Premium billing: if `is_premium && current_epoch >= premium_renewal_epoch` → CPI `credit_ledger::debit(owner, 500_000, "premium_sub")`. If debit fails (insufficient balance): `is_premium = false`, emit `PremiumLapsed`.
   - Exchange rate read via `lst_registry::get_exchange_rate(lst_mint, pool_state_info)`.
   - **Yield delta (u128 intermediate — no overflow):**
     ```
     yield_lst = lst_deposited_amount × (rate_now - rate_last) / rate_last
     ```
     If `yield_lst == 0`: update trackers, return.
   - **Price range branch:**
     - `< floor`: update `lst_exchange_rate_last_harvest`, `last_harvested_epoch`. Add `yield_lst` to `total_yield_skipped_lst`. Emit `HarvestSkippedPriceBelow`. Return.
     - `> ceiling`: `yield_to_swap = yield_lst × 70 / 100`. `yield_to_compound = yield_lst × 30 / 100`. Add `yield_to_compound` to `lst_deposited_amount`.
     - `floor ≤ price ≤ ceiling`: `yield_to_swap = yield_lst`.
   - Cap: `yield_to_swap = min(yield_to_swap, 0.5_SOL_equivalent)`.
   - Jupiter swap CPI (include `referral_account` and `referral_token_account`). Validate `usdc_out >= jupiter_quoted_min`. If slippage exceeded: skip, increment `swap_skipped_epochs`, update trackers, return.
   - **Fee split (checked arithmetic, must sum to exactly `usdc_out`):**
     ```rust
     let crank_tip    = usdc_out.checked_mul(10).unwrap().checked_div(10_000).unwrap();
     let protocol_fee = usdc_out.checked_mul(70).unwrap().checked_div(10_000).unwrap();
     let user_credit  = usdc_out.checked_sub(crank_tip).unwrap()
                                .checked_sub(protocol_fee).unwrap();
     // crank_tip + protocol_fee + user_credit == usdc_out exactly
     ```
   - Transfer `crank_tip` USDC to caller ATA.
   - CPI `holdify_treasury::deposit_fee(protocol_fee)`.
   - CPI `holdify_treasury::deposit_to_pool(owner, user_credit)`.
   - CPI `credit_ledger::add_credit(owner, user_credit)`.
   - Update `lst_exchange_rate_last_harvest`, `last_harvested_epoch`, `total_yield_harvested_usdc`.
   - Emit `EpochHarvested`.

**Events:**
```rust
EpochHarvested { owner, epoch, lst_mint, yield_lst, yield_to_compound, usdc_out, crank_tip, protocol_fee, user_credit, sol_price_usd }
HarvestSkippedPriceBelow { owner, epoch, sol_price_usd, floor, yield_lst_accrued }
HarvestSkippedSlippage { owner, epoch, quoted_min, actual_out }
AutoCompounded { owner, epoch, yield_compounded_lst, new_deposited_total }
PremiumLapsed { owner, epoch }
```

---

### Program 2: `credit_ledger`

Shared between SOL Track and PST Stable Track. Both vaults credit the same `CreditLedger` for seamless unified balance.

**`CreditLedger` account** (PDA: `[b"credit", owner.key()]`):

```rust
pub struct CreditLedger {
    pub owner: Pubkey,
    pub usdc_balance: u64,
    pub total_credited: u64,
    pub total_spent: u64,
    pub total_withdrawn: u64,
    pub facilitator_authority: Pubkey,
    pub markup_bps: u16,          // current markup, readable by user
    pub daily_spend_limit: u64,   // 0 = unlimited
    pub daily_spent_today: u64,
    pub last_spend_reset_ts: i64,
    pub created_at: i64,
    pub bump: u8,
}
```

**Instructions:**

1. `initialize(facilitator_authority, daily_spend_limit)` — create for caller, `usdc_balance = 0`.

2. `add_credit(owner, amount)` — CPI only. Check signer is `holdify_sol_vault` OR `holdify_stable_vault` program ID. Increment balance and `total_credited`.

3. `debit(owner, amount, call_reference, markup_bps)` — `facilitator_authority` signer only.
   - `total_debit = amount + (amount × markup_bps / 10_000)`.
   - Validate `usdc_balance >= total_debit`.
   - Daily limit check: if `daily_spend_limit > 0`: validate `daily_spent_today + total_debit <= daily_spend_limit`. Auto-reset if `now - last_spend_reset_ts > 86400`.
   - Decrement `usdc_balance` by `total_debit`. Increment `total_spent` by `amount`.
   - Markup delta flows to treasury in `facilitator_settle`.

4. `withdraw_usdc(amount)` — owner only.
   - `fee = amount × 30 / 10_000` (0.3%).
   - CPI `holdify_treasury::withdraw_from_pool(owner, amount, fee)`.
   - Pool sends `amount - fee` to owner ATA, `fee` to treasury.
   - Decrement `usdc_balance` by `amount`.

5. `update_facilitator(new_authority)` / `update_daily_limit(new_limit)` — owner only.

---

### Program 3: `lst_registry`

**`LSTMeta` account** (PDA: `[b"lst", lst_mint.key()]`):

```rust
pub struct LSTMeta {
    pub mint: Pubkey,
    pub name: String,
    pub pool_type: PoolType,
    pub stake_pool_program: Pubkey,
    pub stake_pool_state: Pubkey,
    pub exchange_rate_field_offset: u32,
    pub exchange_rate_denominator_offset: u32,
    pub exchange_rate_decimals: u8,
    pub is_active: bool,
    pub is_centralized_validator: bool,   // true for BNSOL
    pub added_at: i64,
    pub authority: Pubkey,
    pub metadata_uri: String,
    pub bump: u8,
}
```

**Instructions:**
1. `add_lst(...)` — governance only (Squads multisig).
2. `deactivate_lst(mint)` — governance only. Existing vaults still harvestable.
3. `get_exchange_rate(lst_mint, pool_state_account_info)` — read-only. Branch on `pool_type`. Called via CPI from `holdify_sol_vault::harvest_epoch`.

---

### Program 4: `holdify_treasury`

Shared between SOL Track and PST Stable Track.

**Accounts:**

`Treasury` (PDA: `[b"treasury"]`):
```rust
pub struct Treasury {
    pub usdc_balance: u64,
    pub total_fees_collected: u64,
    pub total_kamino_yield_earned: u64,
    pub total_jupiter_referral_claimed: u64,
    pub authority: Pubkey,   // Squads multisig
    pub bump: u8,
}
```

`USDCPool` (PDA: `[b"usdc_pool"]`):
```rust
pub struct USDCPool {
    pub total_user_balance: u64,       // virtual sum of all CreditLedger balances
    pub local_liquid_reserve: u64,     // physically in pool ATA
    pub kamino_deposited: u64,
    pub kamino_earned_cumulative: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}
```

`FacilitatorConfig` (PDA: `[b"facilitator_config"]`):
```rust
pub struct FacilitatorConfig {
    pub authority: Pubkey,          // facilitator server hot wallet
    pub markup_bps: u16,            // default 50 (0.5%), max 100
    pub max_settlement_per_call: u64,
    pub bump: u8,
}
```

`JupiterReferralConfig` (PDA: `[b"jup_referral"]`):
```rust
pub struct JupiterReferralConfig {
    pub referral_account: Pubkey,
    pub referral_token_accounts: Vec<Pubkey>,  // one per supported token, max 10
    pub last_claimed_at: i64,
    pub total_claimed: u64,
    pub bump: u8,
}
```

**Instructions:**

1. `deposit_to_pool(owner, amount)` — CPI from `holdify_sol_vault::harvest_epoch` OR `holdify_stable_vault::harvest_yield`. Increment `total_user_balance` and `local_liquid_reserve`. If `local_liquid_reserve / total_pool > 30%` emit `KaminoRebalanceNeeded`.

2. `deposit_fee(amount)` — CPI from harvest instructions. Transfer `amount` to treasury USDC ATA. Increment `total_fees_collected`.

3. `withdraw_from_pool(owner, gross_amount, withdrawal_fee)` — CPI from `credit_ledger::withdraw_usdc`. Validate owner's CreditLedger balance. Transfer `gross_amount - withdrawal_fee` to owner ATA. Transfer `withdrawal_fee` to treasury.

4. `facilitator_settle(owner, ai_provider_amount, markup_amount, recipient_usdc_ata, call_reference)` — `FacilitatorConfig::authority` signer.
   - CPI `credit_ledger::debit(owner, ai_provider_amount + markup_amount, call_reference, markup_bps)`.
   - Transfer `ai_provider_amount` USDC to `recipient_usdc_ata`.
   - Transfer `markup_amount` USDC to treasury.
   - Update `USDCPool::total_withdrawn`.

5. `kamino_deposit(amount)` — permissionless. Only if `local_liquid_reserve / total_pool > 30%`. CPI to Kamino. Update balances.

6. `kamino_withdraw(amount)` — permissionless. Only if `local_liquid_reserve / total_pool < 10%`. CPI to Kamino. Harvest interest → `kamino_earned_cumulative`.

7. `claim_jupiter_referral(token_mint)` — governance only. Claim accumulated fees into treasury.

8. `update_facilitator_config(new_markup_bps, new_max_settlement)` — governance only. `new_markup_bps <= 100` hard cap.

9. `collect_treasury_fees(amount, destination)` — governance only.

---

### Program 5: `partner_registry`

**`PartnerAccount`** (PDA: `[b"partner", partner_wallet.key()]`):

```rust
pub struct PartnerAccount {
    pub authority: Pubkey,
    pub name: String,
    pub fee_wallet: Pubkey,
    pub total_settlements_routed: u64,
    pub is_active: bool,
    pub registered_at: i64,
    pub metadata_uri: String,
    pub bump: u8,
}
```

**Instructions:**
1. `register_partner(name, fee_wallet, metadata_uri)` — 1 USDC registration fee to treasury.
2. `deactivate_partner()` — self or governance.
3. `record_settlement(partner, amount)` — CPI from `holdify_treasury::facilitator_settle`. Increment `total_settlements_routed`. Emit `PartnerSettlement`.

---

## x402 Integration

### Facilitator Server (`facilitator/`)

```typescript
// facilitator/src/settler.ts
import { createX402Server } from '@dexterai/x402/server';

const MARKUP_BPS = 50; // Refreshed every 60s from FacilitatorConfig on-chain

export async function settleX402(
  ownerWallet: PublicKey,
  amountUsdc: bigint,
  recipientUsdc: PublicKey,
  callReference: string,
  partnerPubkey?: PublicKey
): Promise<SettleResult> {
  const balance = await getCreditLedgerBalance(ownerWallet);
  const markup = (amountUsdc * BigInt(MARKUP_BPS)) / 10_000n;
  const totalDebit = amountUsdc + markup;

  if (balance < totalDebit) {
    return {
      success: false,
      errorReason: 'insufficient_credit_balance',
      remaining: balance,
      rechargeUrl: 'https://app.holdify.finance/deposit'
    };
  }

  const txSig = await program.methods
    .facilitatorSettle(
      ownerWallet,
      new BN(amountUsdc.toString()),
      new BN(markup.toString()),
      callReference
    )
    .accounts({ creditLedger: getCreditLedgerPDA(ownerWallet), recipientUsdc, ... })
    .signers([facilitatorKeypair])
    .rpc();

  return { success: true, txSig };
}
```

### `@holdify/sdk` Client

```typescript
// packages/holdify-sdk/src/client.ts
import { createX402Client } from '@dexterai/x402/client';

export function createHoldifyClient(options: {
  ownerWallet: PublicKey;
  facilitatorEndpoint: string;
  partnerPubkey?: PublicKey;
  rpcUrl?: string;
}) {
  return createX402Client({
    wallets: { solana: new HoldifyFacilitatorAdapter(options) },
  });
}

// 5-line integration:
// const client = createHoldifyClient({ ownerWallet, facilitatorEndpoint: 'https://api.holdify.finance' });
// const response = await client.fetch('https://api.anthropic.com/v1/messages', { ... });
// 402 handled. Yield pays.
```

---

## Crank Bot (`crank/`)

```typescript
// crank/src/main.ts — runs every 3 minutes
async function runCrank() {
  const epoch = BigInt((await connection.getEpochInfo()).epoch);

  // Premium vaults first (is_premium = true memcmp filter)
  const premiumVaults = await program.account.userVault.all([
    { memcmp: { offset: IS_PREMIUM_OFFSET, bytes: 'Ag==' } }
  ]);
  const standardVaults = await program.account.userVault.all([
    { memcmp: { offset: LAST_EPOCH_OFFSET, bytes: encodeEpochLessThan(epoch) } },
    { memcmp: { offset: IS_PREMIUM_OFFSET, bytes: 'AA==' } }
  ]);

  for (const vault of [...premiumVaults, ...standardVaults]) {
    if (BigInt(vault.account.lastHarvestedEpoch) >= epoch) continue;
    try {
      const swapIx = await buildJupiterSwap(
        vault.account.lstMint, USDC_MINT,
        estimateYieldLst(vault.account), 50, // 0.5% slippage
        JUPITER_REFERRAL_ACCOUNT  // always include — Tap 1 revenue
      );
      await program.methods.harvestEpoch(swapIx)
        .accounts({ userVault: vault.publicKey, pythSolUsd: PYTH_SOL_USD, ... })
        .rpc();
    } catch (e) {
      if (e.message.includes('AlreadyHarvestedThisEpoch')) continue;
      console.error(vault.publicKey.toBase58(), e.message);
    }
  }
}
setInterval(runCrank, 3 * 60 * 1000);
```

---

## Frontend (Next.js App Router)

### Pages

**`/sol` — SOL Track Dashboard**
Hero: "Your [N] jitoSOL earns ~$X.XX/day → ~Y AI messages/day." Secondary: next harvest countdown. Per-vault cards if multiple LSTs deposited.

**`/sol/deposit` — SOL Track Deposit**
Step 1: Select LST. Show APY per token. Show "Centralized Validator" badge on BNSOL.
Step 2: Enter amount. Real-time `YieldProjectionWidget`.
Step 3: Price range slider — three zones (below floor = gray/paused, in window = green/active, above ceiling = gold/split-mode). Copy: "Below your floor, yield keeps compounding as LST — your principal is always safe."
Step 4: Premium toggle (priority harvest + advanced features, 0.5 USDC/month).
Step 5: Sign.

**`/sol/settings`** — adjust price policy, daily limit, premium.
**`/credits`** — unified credit balance (shared with PST Track). Spend history, withdrawal.
**`/analytics`** — protocol TVL, yield processed, Kamino APY, Jupiter referral earned.

### `YieldProjectionWidget`

```typescript
export function YieldProjectionWidget({ lstAmount, lstType, solPrice, priceFloor, priceCeiling }) {
  const APY = lstType === 'INF' ? 0.069 : 0.065;
  const epochRate = APY / 182.5;
  const inWindow = solPrice >= priceFloor && solPrice <= priceCeiling;
  const aboveCeiling = solPrice > priceCeiling;
  const creditPct = aboveCeiling ? 0.70 : 1.00;

  const epochYieldUsd = lstAmount * solPrice * epochRate;
  const userCredit = epochYieldUsd * creditPct * (1 - 0.008); // 0.8% total fees
  const dailyCredit = userCredit / 2.0;
  const msgPerDay = Math.floor(dailyCredit / 0.008);

  return (
    <div>
      <Stat label="Daily AI credit" value={`$${dailyCredit.toFixed(4)}`} />
      <Stat label="Est. messages/day" value={`~${msgPerDay}`} />
      {aboveCeiling && <InfoBadge>Above your ceiling: 30% auto-compounds your position</InfoBadge>}
      {!inWindow && !aboveCeiling && (
        <PausedBadge>SOL below floor — yield accumulates as LST safely until price recovers</PausedBadge>
      )}
      <FeeNote>Fees: 0.8% harvest + 0.5% per AI call · Principal never touched</FeeNote>
    </div>
  );
}
```

---

## Build Phases — SOL Track

### Phase 0: Foundations
Anchor workspace. 5-program stubs. Add `@dexterai/x402`, Pyth SDK, Jupiter SDK, Kamino SDK. Register Jupiter referral on devnet. Verify all 6 LST mints on-chain. Monorepo: `programs/`, `crank/`, `facilitator/`, `app/`, `packages/holdify-sdk/`. Set up `bankrun` test harness.
→ **Jon Skeet review only.**

### Phase 1: LST Registry + Vault Core
`lst_registry` with all 6 LSTs and `PoolType` branching. `holdify_sol_vault::deposit` and `withdraw` with real exchange rate reading (mock INF in tests). Receipt token minting (Token-2022 non-transferable). Minimum deposit enforcement.
→ **Both subagents.**

### Phase 2: Harvest + Fee Stack
`harvest_epoch` with Pyth oracle, price range logic, yield delta, Jupiter CPI with referral, fee split (0.1% + 0.7% + 99.2%), 70/30 above-ceiling split, auto-compound. Full `credit_ledger`. `holdify_treasury::deposit_to_pool` and `deposit_fee`. Test: every lamport accounted for.
→ **Both subagents.**

### Phase 3: Kamino Float
`kamino_deposit` / `kamino_withdraw`. 20% liquidity buffer floor, 30% rebalance trigger. `kamino_earned_cumulative` tracking. Test: pool never below 10% local liquidity.
→ **Jon Skeet only.**

### Phase 4: x402 Settlement + Markup
`facilitator_settle` with markup. `FacilitatorConfig`. Facilitator Node.js server. Express AI proxy example. Full 402 round-trip on devnet.
→ **Jon Skeet only.**

### Phase 5: Revenue Stack Completion
`credit_ledger::withdraw_usdc` with 0.3% fee. `partner_registry`. `claim_jupiter_referral`. Premium billing in harvest. Fee path integration test.
→ **Jon Skeet only.**

### Phase 6: `@holdify/sdk`
Full SDK, React hooks (`useHoldifyBalance`, `useHoldifyHarvest`, `useHoldifyDeposit`). 5-line integration example. Devnet npm publish.
→ **Both subagents.**

### Phase 7: Frontend (SOL Track screens)
All pages under `/sol/*`. `YieldProjectionWidget`. Price range slider. BNSOL warning badge. Harvest log. Fee disclosure. Protocol analytics.
→ **Both subagents — heavy Jony Ive focus on deposit flow and below-floor state UX.**

### Phase 8: Security Hardening
Squads multisig all governance instructions. Pyth circuit breaker (halt if SOL deviates >25% vs 3-epoch average). Kamino circuit breaker (halt if Kamino TVL drops >30%). Overflow audit: all u64 multiplications via u128. Reentrancy review. Rate limiter on facilitator (100 settlements/min/user). 80% test coverage.
→ **Both subagents final review.**

---

## Testing Strategy

### Arithmetic invariants (test these first, they're the hardest bugs to find)
- `crank_tip + protocol_fee + user_credit == usdc_out` exactly for all u64 inputs including primes
- Yield delta never double-counted across epoch boundary
- 70/30 split: `to_swap + to_compound <= yield_lst` always (round down, not up)
- All u64 multiplications use u128 intermediate — prove no overflow at 1000 SOL, $10,000 SOL price, 10 years

### `harvest_epoch` unit tests
- Price below floor → no swap, `total_yield_skipped_lst` incremented, rate tracker updated
- Price above ceiling → exactly 70% swapped, 30% added to `lst_deposited_amount`
- Jupiter slippage exceeded → skip, counter incremented, rates updated (no double-count next epoch)
- Double harvest same epoch → `AlreadyHarvestedThisEpoch` error
- Premium billing success and failure (graceful lapse)
- INF pool type: mock Sanctum Infinity state, verify rate deserialization

### Integration (bankrun full lifecycle)
1. Register 6 LSTs.
2. Deposit 5 jitoSOL, deposit 3 INF. Verify two independent vaults.
3. Advance epoch. Mock Pyth $150. Mock rate deltas.
4. Harvest both vaults. Verify: fee splits exact. Crank tip paid. Protocol fee paid.
5. Verify Kamino rebalance triggered.
6. Facilitator settle $0.01000 call → debit $0.01005 → provider gets $0.01000 → treasury gets $0.00005.
7. Withdraw $1.00 credits → user gets $0.997, treasury gets $0.003.
8. Mock Pyth $75 (below floor) → no USDC credited, `total_yield_skipped_lst` grows.
9. Mock Pyth $600 (above ceiling) → 70/30 split verified.
10. Full withdrawal jitoSOL → vault closed. INF vault unaffected.
11. Zero lamport discrepancy end-to-end.

---

## Environment Variables

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HOLDIFY_SOL_VAULT_PROGRAM_ID=HoLD...
CREDIT_LEDGER_PROGRAM_ID=crLd...
LST_REGISTRY_PROGRAM_ID=lstR...
HOLDIFY_TREASURY_PROGRAM_ID=trsy...
PARTNER_REGISTRY_PROGRAM_ID=ptnr...
PYTH_SOL_USD_PRICE_ACCOUNT=H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
JUPITER_PROGRAM_ID=JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
JUPITER_REFERRAL_ACCOUNT=<register at referral.jup.ag>
KAMINO_PROGRAM_ID=KLend2g3cP87fffoy8q1mQqGKjrL823GKinppkbd1dxv
KAMINO_USDC_MARKET=<Kamino USDC reserve pubkey>
FACILITATOR_PRIVATE_KEY_BASE58=<never commit — use env secret>
FACILITATOR_USDC_ATA=<treasury-owned USDC ATA>
SQUADS_MULTISIG_ADDRESS=<Squads v4 multisig>
NEXT_PUBLIC_FACILITATOR_ENDPOINT=https://api.holdify.finance
JITOSOL_MINT=J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn
MSOL_MINT=mSoLzYCxHdYgdziU6SFzLN5bF9JBPSozJXXkMNUHNHg
BSOL_MINT=bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1
JUPSOL_MINT=jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v
INF_MINT=5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm
BNSOL_MINT=BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85
```

---

## Multi-Agent Review Loop

After each phase: spawn both subagents in parallel. Do not proceed until both score 10/10.

### Subagent 1: "Anatoly Yakovenko" (Solana Systems)
Evaluate: ACCOUNT_SAFETY, ARITHMETIC (every u64 multiply via u128, fee split sums to input exactly), ORACLE_SAFETY (Pyth staleness 60s, deviation circuit breaker), KAMINO_SAFETY (20% liquidity buffer invariant), CPI_SAFETY, ECONOMIC_CORRECTNESS (0.1% + 0.7% + 99.2% = 100%), IDEMPOTENCY. Rate 1–10. Overall = minimum. List issues with program/instruction/fix. APPROVED YES/NO.

### Subagent 2: "Jony Ive" (DeFi UX)
Evaluate: SIMPLICITY, CLARITY (yield projection is instantly believable), DELIGHT (harvest notification feels like free money), TRUST (all fees disclosed, below-floor = feature not bug), ZERO_ANXIETY (principal safety must be visceral, not just text), FEE_TRANSPARENCY. Rate 1–10. Overall = minimum. List issues with page/fix. APPROVED YES/NO.
