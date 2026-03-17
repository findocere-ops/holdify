use anchor_lang::prelude::*;

declare_id!("7sTD6nPWkcNXn9WgdDwUKuUiX7itfEoBoivzgmVFxnfN");

#[program]
pub mod holdify_treasury {
    use super::*;

    /// Initialize the treasury and USDC pool. Admin only (one-time).
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        facilitator_authority: Pubkey,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.usdc_balance = 0;
        treasury.total_fees_collected = 0;
        treasury.authority = ctx.accounts.authority.key();
        treasury.bump = ctx.bumps.treasury;

        let pool = &mut ctx.accounts.usdc_pool;
        pool.total_user_balance = 0;
        pool.local_liquid_reserve = 0;
        pool.total_deposited = 0;
        pool.total_withdrawn = 0;
        pool.bump = ctx.bumps.usdc_pool;

        let fac_config = &mut ctx.accounts.facilitator_config;
        fac_config.authority = facilitator_authority;
        fac_config.markup_bps = 50; // 0.5% default
        fac_config.max_settlement_per_call = 100_000_000; // $100 USDC max per call
        fac_config.bump = ctx.bumps.facilitator_config;

        Ok(())
    }

    /// Deposit harvested yield to the USDC pool. CPI from vault programs.
    pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let pool = &mut ctx.accounts.usdc_pool;
        pool.total_user_balance = pool
            .total_user_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.local_liquid_reserve = pool
            .local_liquid_reserve
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.total_deposited = pool
            .total_deposited
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PoolDeposit {
            amount,
            new_total_balance: pool.total_user_balance,
        });
        Ok(())
    }

    /// Deposit protocol fees to treasury. CPI from vault harvest instructions.
    pub fn deposit_fee(ctx: Context<DepositFee>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let treasury = &mut ctx.accounts.treasury;
        treasury.usdc_balance = treasury
            .usdc_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        treasury.total_fees_collected = treasury
            .total_fees_collected
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(FeeCollected {
            amount,
            total_collected: treasury.total_fees_collected,
        });
        Ok(())
    }

    /// Withdraw USDC from pool for credit withdrawal. CPI from credit_ledger.
    pub fn withdraw_from_pool(
        ctx: Context<WithdrawFromPool>,
        gross_amount: u64,
        withdrawal_fee: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.usdc_pool;
        let net = gross_amount
            .checked_sub(withdrawal_fee)
            .ok_or(ErrorCode::Overflow)?;

        require!(
            pool.local_liquid_reserve >= gross_amount,
            ErrorCode::InsufficientPoolLiquidity
        );

        pool.total_user_balance = pool
            .total_user_balance
            .checked_sub(gross_amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.local_liquid_reserve = pool
            .local_liquid_reserve
            .checked_sub(gross_amount)
            .ok_or(ErrorCode::Overflow)?;
        pool.total_withdrawn = pool
            .total_withdrawn
            .checked_add(gross_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Fee goes to treasury
        let treasury = &mut ctx.accounts.treasury;
        treasury.usdc_balance = treasury
            .usdc_balance
            .checked_add(withdrawal_fee)
            .ok_or(ErrorCode::Overflow)?;
        treasury.total_fees_collected = treasury
            .total_fees_collected
            .checked_add(withdrawal_fee)
            .ok_or(ErrorCode::Overflow)?;

        emit!(PoolWithdrawal {
            gross_amount,
            net_amount: net,
            fee: withdrawal_fee,
        });

        // Actual USDC SPL transfer to owner is handled in the full CPI chain
        Ok(())
    }

    /// Settle an x402 AI payment. Facilitator authority only.
    pub fn facilitator_settle(
        ctx: Context<FacilitatorSettle>,
        ai_provider_amount: u64,
        markup_amount: u64,
        call_reference: String,
    ) -> Result<()> {
        let config = &ctx.accounts.facilitator_config;
        let total = ai_provider_amount
            .checked_add(markup_amount)
            .ok_or(ErrorCode::Overflow)?;

        require!(
            total <= config.max_settlement_per_call,
            ErrorCode::SettlementTooLarge
        );

        let pool = &mut ctx.accounts.usdc_pool;
        require!(
            pool.local_liquid_reserve >= total,
            ErrorCode::InsufficientPoolLiquidity
        );

        pool.total_user_balance = pool
            .total_user_balance
            .checked_sub(total)
            .ok_or(ErrorCode::Overflow)?;
        pool.local_liquid_reserve = pool
            .local_liquid_reserve
            .checked_sub(total)
            .ok_or(ErrorCode::Overflow)?;
        pool.total_withdrawn = pool
            .total_withdrawn
            .checked_add(total)
            .ok_or(ErrorCode::Overflow)?;

        // Markup goes to treasury
        let treasury = &mut ctx.accounts.treasury;
        treasury.usdc_balance = treasury
            .usdc_balance
            .checked_add(markup_amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(SettlementCompleted {
            ai_provider_amount,
            markup_amount,
            call_reference,
        });

        // Actual USDC transfer to AI provider and markup to treasury
        // handled via SPL token CPI in full integration
        Ok(())
    }

    /// Collect accumulated treasury fees. Governance/admin only.
    pub fn collect_treasury_fees(
        ctx: Context<CollectFees>,
        amount: u64,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        require!(
            treasury.usdc_balance >= amount,
            ErrorCode::InsufficientTreasuryBalance
        );
        treasury.usdc_balance = treasury
            .usdc_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(FeesCollected {
            amount,
            remaining_balance: treasury.usdc_balance,
        });
        Ok(())
    }

    /// Update facilitator config. Admin only.
    pub fn update_facilitator_config(
        ctx: Context<UpdateConfig>,
        new_markup_bps: u16,
        new_max_settlement: u64,
    ) -> Result<()> {
        require!(new_markup_bps <= 100, ErrorCode::MarkupTooHigh);
        let config = &mut ctx.accounts.facilitator_config;
        config.markup_bps = new_markup_bps;
        config.max_settlement_per_call = new_max_settlement;
        Ok(())
    }
}

// ── Account Structures ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub usdc_balance: u64,
    pub total_fees_collected: u64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct USDCPool {
    pub total_user_balance: u64,
    pub local_liquid_reserve: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FacilitatorConfig {
    pub authority: Pubkey,
    pub markup_bps: u16,
    pub max_settlement_per_call: u64,
    pub bump: u8,
}

// ── Instruction Contexts ────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init,
        payer = authority,
        space = 8 + USDCPool::INIT_SPACE,
        seeds = [b"usdc_pool"],
        bump,
    )]
    pub usdc_pool: Account<'info, USDCPool>,

    #[account(
        init,
        payer = authority,
        space = 8 + FacilitatorConfig::INIT_SPACE,
        seeds = [b"facilitator_config"],
        bump,
    )]
    pub facilitator_config: Account<'info, FacilitatorConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(
        mut,
        seeds = [b"usdc_pool"],
        bump = usdc_pool.bump,
    )]
    pub usdc_pool: Account<'info, USDCPool>,

    /// The vault program calling via CPI.
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositFee<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// The vault program calling via CPI.
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawFromPool<'info> {
    #[account(
        mut,
        seeds = [b"usdc_pool"],
        bump = usdc_pool.bump,
    )]
    pub usdc_pool: Account<'info, USDCPool>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct FacilitatorSettle<'info> {
    #[account(
        seeds = [b"facilitator_config"],
        bump = facilitator_config.bump,
        has_one = authority,
    )]
    pub facilitator_config: Account<'info, FacilitatorConfig>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"usdc_pool"],
        bump = usdc_pool.bump,
    )]
    pub usdc_pool: Account<'info, USDCPool>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        constraint = authority.key() == treasury.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = authority.key() == treasury.authority @ ErrorCode::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump,
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
        seeds = [b"facilitator_config"],
        bump = facilitator_config.bump,
    )]
    pub facilitator_config: Account<'info, FacilitatorConfig>,
}

// ── Events ──────────────────────────────────────────────────────────

#[event]
pub struct PoolDeposit {
    pub amount: u64,
    pub new_total_balance: u64,
}

#[event]
pub struct FeeCollected {
    pub amount: u64,
    pub total_collected: u64,
}

#[event]
pub struct PoolWithdrawal {
    pub gross_amount: u64,
    pub net_amount: u64,
    pub fee: u64,
}

#[event]
pub struct SettlementCompleted {
    pub ai_provider_amount: u64,
    pub markup_amount: u64,
    pub call_reference: String,
}

#[event]
pub struct FeesCollected {
    pub amount: u64,
    pub remaining_balance: u64,
}

// ── Errors ──────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Insufficient pool liquidity")]
    InsufficientPoolLiquidity,
    #[msg("Insufficient treasury balance")]
    InsufficientTreasuryBalance,
    #[msg("Settlement amount exceeds maximum per call")]
    SettlementTooLarge,
    #[msg("Markup basis points too high (max 100 = 1%)")]
    MarkupTooHigh,
    #[msg("Unauthorized")]
    Unauthorized,
}
