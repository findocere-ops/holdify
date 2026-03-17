use anchor_lang::prelude::*;

declare_id!("D2FECB111FqPEmmWD2nUAKdvU2ruh5xTpeg3wxsypcub");

#[program]
pub mod holdify_sol_vault {
    use super::*;

    /// Deposit LST tokens into a Holdify vault. Minimum 2 SOL equivalent.
    pub fn deposit(
        ctx: Context<Deposit>,
        lst_amount: u64,
        sol_price_floor: u64,
        sol_price_ceiling: u64,
    ) -> Result<()> {
        // Validate price range
        require!(
            sol_price_floor >= 10_000_000, // $10 min floor
            ErrorCode::FloorTooLow
        );
        require!(
            sol_price_floor < sol_price_ceiling,
            ErrorCode::InvalidPriceRange
        );

        // In full implementation: read exchange rate from lst-registry
        // to validate lst_amount >= 2 SOL equivalent
        // For now this is validated in the test harness
        require!(lst_amount > 0, ErrorCode::ZeroAmount);

        let vault = &mut ctx.accounts.user_vault;
        vault.owner = ctx.accounts.owner.key();
        vault.lst_mint = ctx.accounts.lst_mint.key();
        vault.lst_deposited_amount = lst_amount;
        vault.lst_exchange_rate_at_deposit = 1_000_000_000; // placeholder, will read from registry
        vault.lst_exchange_rate_last_harvest = 1_000_000_000;
        vault.last_harvested_epoch = Clock::get()?.epoch;
        vault.sol_price_floor = sol_price_floor;
        vault.sol_price_ceiling = sol_price_ceiling;
        vault.total_yield_harvested_usdc = 0;
        vault.total_yield_skipped_lst = 0;
        vault.swap_skipped_epochs = 0;
        vault.is_premium = false;
        vault.premium_renewal_epoch = 0;
        vault.deposited_at = Clock::get()?.unix_timestamp;
        vault.receipt_mint = Pubkey::default(); // set after receipt mint in full impl
        vault.bump = ctx.bumps.user_vault;

        emit!(VaultDeposited {
            owner: vault.owner,
            lst_mint: vault.lst_mint,
            lst_amount,
            sol_price_floor,
            sol_price_ceiling,
            epoch: vault.last_harvested_epoch,
        });

        // In full implementation:
        // 1. Transfer LST from owner ATA to vault PDA ATA
        // 2. Mint non-transferable receipt tokens to owner
        Ok(())
    }

    /// Withdraw LST from vault. Burns receipt tokens.
    pub fn withdraw(ctx: Context<Withdraw>, lst_amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.user_vault;
        require!(lst_amount > 0, ErrorCode::ZeroAmount);
        require!(
            lst_amount <= vault.lst_deposited_amount,
            ErrorCode::InsufficientDeposit
        );

        vault.lst_deposited_amount = vault
            .lst_deposited_amount
            .checked_sub(lst_amount)
            .ok_or(ErrorCode::Overflow)?;

        let full_withdrawal = vault.lst_deposited_amount == 0;

        emit!(VaultWithdrawn {
            owner: vault.owner,
            lst_mint: vault.lst_mint,
            lst_amount,
            full_withdrawal,
        });

        // In full implementation:
        // 1. Burn receipt tokens
        // 2. Transfer LST from vault PDA ATA to owner ATA
        // 3. If full_withdrawal: close vault account, return rent
        Ok(())
    }

    /// Update the SOL price floor and ceiling for harvest behavior.
    pub fn update_price_policy(
        ctx: Context<UpdateVault>,
        new_floor: u64,
        new_ceiling: u64,
    ) -> Result<()> {
        require!(new_floor >= 10_000_000, ErrorCode::FloorTooLow);
        require!(new_floor < new_ceiling, ErrorCode::InvalidPriceRange);

        let vault = &mut ctx.accounts.user_vault;
        vault.sol_price_floor = new_floor;
        vault.sol_price_ceiling = new_ceiling;

        emit!(PricePolicyUpdated {
            owner: vault.owner,
            new_floor,
            new_ceiling,
        });
        Ok(())
    }

    /// Harvest yield for the current epoch. Permissionless (anyone can crank).
    ///
    /// Flow:
    /// 1. Check epoch guard (no double-harvest)
    /// 2. Read Pyth SOL/USD price
    /// 3. Read LST exchange rate delta
    /// 4. Apply price range logic
    /// 5. Swap yield via Jupiter
    /// 6. Split fees: 0.1% crank + 0.7% protocol + 99.2% user credit
    /// 7. CPI to treasury and credit_ledger
    pub fn harvest_epoch(ctx: Context<HarvestEpoch>) -> Result<()> {
        let vault = &mut ctx.accounts.user_vault;
        let current_epoch = Clock::get()?.epoch;

        // Epoch guard — prevent double harvest
        require!(
            current_epoch > vault.last_harvested_epoch,
            ErrorCode::AlreadyHarvestedThisEpoch
        );

        // In full implementation:
        // - Read Pyth SOL/USD price, validate staleness < 60s
        // - Read LST exchange rate from pool state account
        // - Calculate yield_lst = lst_deposited * (rate_now - rate_last) / rate_last
        // - Apply price range branching:
        //   * < floor: skip, compound as LST
        //   * in window: 100% swap to USDC
        //   * > ceiling: 70% swap, 30% compound
        // - Jupiter swap CPI with referral account
        // - Fee split with checked arithmetic

        // Placeholder: simulate a successful harvest
        let simulated_usdc_out: u64 = 100_000; // $0.10 USDC (6 decimals)

        // Fee split — exact arithmetic, no rounding loss
        let crank_tip = simulated_usdc_out
            .checked_mul(10)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?;
        let protocol_fee = simulated_usdc_out
            .checked_mul(70)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?;
        let user_credit = simulated_usdc_out
            .checked_sub(crank_tip)
            .ok_or(ErrorCode::Overflow)?
            .checked_sub(protocol_fee)
            .ok_or(ErrorCode::Overflow)?;

        // Invariant: fees must sum to total
        require!(
            crank_tip
                .checked_add(protocol_fee)
                .ok_or(ErrorCode::Overflow)?
                .checked_add(user_credit)
                .ok_or(ErrorCode::Overflow)?
                == simulated_usdc_out,
            ErrorCode::FeeSplitMismatch
        );

        // Update vault state
        vault.last_harvested_epoch = current_epoch;
        vault.total_yield_harvested_usdc = vault
            .total_yield_harvested_usdc
            .checked_add(user_credit)
            .ok_or(ErrorCode::Overflow)?;

        emit!(EpochHarvested {
            owner: vault.owner,
            epoch: current_epoch,
            lst_mint: vault.lst_mint,
            usdc_out: simulated_usdc_out,
            crank_tip,
            protocol_fee,
            user_credit,
        });

        // In full implementation:
        // 1. Transfer crank_tip USDC to crank caller ATA
        // 2. CPI holdify_treasury::deposit_fee(protocol_fee)
        // 3. CPI holdify_treasury::deposit_to_pool(owner, user_credit)
        // 4. CPI credit_ledger::add_credit(owner, user_credit)
        Ok(())
    }
}

// ── Account Structures ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub owner: Pubkey,
    pub lst_mint: Pubkey,
    pub lst_deposited_amount: u64,
    pub lst_exchange_rate_at_deposit: u64,
    pub lst_exchange_rate_last_harvest: u64,
    pub last_harvested_epoch: u64,
    pub sol_price_floor: u64,
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

// ── Instruction Contexts ────────────────────────────────────────────

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: The LST token mint — validated against lst_registry in full impl.
    pub lst_mint: AccountInfo<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [b"sol_vault", owner.key().as_ref(), lst_mint.key().as_ref()],
        bump,
    )]
    pub user_vault: Account<'info, UserVault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"sol_vault", owner.key().as_ref(), user_vault.lst_mint.as_ref()],
        bump = user_vault.bump,
    )]
    pub user_vault: Account<'info, UserVault>,
}

#[derive(Accounts)]
pub struct UpdateVault<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"sol_vault", owner.key().as_ref(), user_vault.lst_mint.as_ref()],
        bump = user_vault.bump,
    )]
    pub user_vault: Account<'info, UserVault>,
}

#[derive(Accounts)]
pub struct HarvestEpoch<'info> {
    /// Crank caller — anyone can call this (permissionless).
    pub crank: Signer<'info>,

    #[account(
        mut,
        seeds = [b"sol_vault", user_vault.owner.as_ref(), user_vault.lst_mint.as_ref()],
        bump = user_vault.bump,
    )]
    pub user_vault: Account<'info, UserVault>,
}

// ── Events ──────────────────────────────────────────────────────────

#[event]
pub struct VaultDeposited {
    pub owner: Pubkey,
    pub lst_mint: Pubkey,
    pub lst_amount: u64,
    pub sol_price_floor: u64,
    pub sol_price_ceiling: u64,
    pub epoch: u64,
}

#[event]
pub struct VaultWithdrawn {
    pub owner: Pubkey,
    pub lst_mint: Pubkey,
    pub lst_amount: u64,
    pub full_withdrawal: bool,
}

#[event]
pub struct PricePolicyUpdated {
    pub owner: Pubkey,
    pub new_floor: u64,
    pub new_ceiling: u64,
}

#[event]
pub struct EpochHarvested {
    pub owner: Pubkey,
    pub epoch: u64,
    pub lst_mint: Pubkey,
    pub usdc_out: u64,
    pub crank_tip: u64,
    pub protocol_fee: u64,
    pub user_credit: u64,
}

#[event]
pub struct HarvestSkippedPriceBelow {
    pub owner: Pubkey,
    pub epoch: u64,
    pub sol_price_usd: u64,
    pub floor: u64,
    pub yield_lst_accrued: u64,
}

#[event]
pub struct AutoCompounded {
    pub owner: Pubkey,
    pub epoch: u64,
    pub yield_compounded_lst: u64,
    pub new_deposited_total: u64,
}

// ── Errors ──────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Price floor must be at least $10")]
    FloorTooLow,
    #[msg("Price floor must be less than ceiling")]
    InvalidPriceRange,
    #[msg("Insufficient deposit balance")]
    InsufficientDeposit,
    #[msg("Already harvested this epoch")]
    AlreadyHarvestedThisEpoch,
    #[msg("Fee split does not sum to total output")]
    FeeSplitMismatch,
    #[msg("Arithmetic overflow")]
    Overflow,
}
