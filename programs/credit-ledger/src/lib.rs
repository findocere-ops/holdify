use anchor_lang::prelude::*;

declare_id!("Axx7rVWtoNPxMwNn482eAMaYFdsyYukcXr8HoDirqaNW");

#[program]
pub mod credit_ledger {
    use super::*;

    /// Initialize a new CreditLedger for the calling wallet.
    pub fn initialize(
        ctx: Context<Initialize>,
        facilitator_authority: Pubkey,
        daily_spend_limit: u64,
    ) -> Result<()> {
        let ledger = &mut ctx.accounts.credit_ledger;
        ledger.owner = ctx.accounts.owner.key();
        ledger.usdc_balance = 0;
        ledger.total_credited = 0;
        ledger.total_spent = 0;
        ledger.total_withdrawn = 0;
        ledger.facilitator_authority = facilitator_authority;
        ledger.daily_spend_limit = daily_spend_limit;
        ledger.daily_spent_today = 0;
        ledger.last_spend_reset_ts = Clock::get()?.unix_timestamp;
        ledger.created_at = Clock::get()?.unix_timestamp;
        ledger.bump = ctx.bumps.credit_ledger;
        Ok(())
    }

    /// Add AI credits to a user's ledger. CPI-only — caller must be
    /// the holdify_sol_vault (or holdify_stable_vault in V1.1).
    pub fn add_credit(ctx: Context<AddCredit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);
        let ledger = &mut ctx.accounts.credit_ledger;
        ledger.usdc_balance = ledger
            .usdc_balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        ledger.total_credited = ledger
            .total_credited
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        emit!(CreditAdded {
            owner: ledger.owner,
            amount,
            new_balance: ledger.usdc_balance,
        });
        Ok(())
    }

    /// Debit credits for an AI call. Only the facilitator_authority can call.
    pub fn debit(
        ctx: Context<Debit>,
        amount: u64,
        call_reference: String,
    ) -> Result<()> {
        let ledger = &mut ctx.accounts.credit_ledger;
        let now = Clock::get()?.unix_timestamp;

        // Daily limit reset check (86400 = 24 hours)
        if ledger.daily_spend_limit > 0 {
            if now.checked_sub(ledger.last_spend_reset_ts).unwrap_or(0) >= 86400 {
                ledger.daily_spent_today = 0;
                ledger.last_spend_reset_ts = now;
            }
            require!(
                ledger
                    .daily_spent_today
                    .checked_add(amount)
                    .ok_or(ErrorCode::Overflow)?
                    <= ledger.daily_spend_limit,
                ErrorCode::DailyLimitExceeded
            );
        }

        require!(
            ledger.usdc_balance >= amount,
            ErrorCode::InsufficientBalance
        );

        ledger.usdc_balance = ledger
            .usdc_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        ledger.total_spent = ledger
            .total_spent
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        ledger.daily_spent_today = ledger
            .daily_spent_today
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(CreditDebited {
            owner: ledger.owner,
            amount,
            call_reference,
            new_balance: ledger.usdc_balance,
        });
        Ok(())
    }

    /// Withdraw unused credits as USDC. Owner only. 0.3% fee.
    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, amount: u64) -> Result<()> {
        let ledger = &mut ctx.accounts.credit_ledger;
        require!(
            ledger.usdc_balance >= amount,
            ErrorCode::InsufficientBalance
        );

        // 0.3% withdrawal fee
        let fee = amount
            .checked_mul(30)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?;
        let net = amount
            .checked_sub(fee)
            .ok_or(ErrorCode::Overflow)?;

        ledger.usdc_balance = ledger
            .usdc_balance
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        ledger.total_withdrawn = ledger
            .total_withdrawn
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(CreditWithdrawn {
            owner: ledger.owner,
            gross_amount: amount,
            fee,
            net_amount: net,
            new_balance: ledger.usdc_balance,
        });

        // Actual USDC transfer handled via CPI to holdify_treasury
        // in the full integration (Build Stage 5)
        Ok(())
    }

    /// Update the facilitator authority. Owner only.
    pub fn update_facilitator(
        ctx: Context<UpdateLedger>,
        new_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.credit_ledger.facilitator_authority = new_authority;
        Ok(())
    }

    /// Update daily spend limit. Owner only. 0 = unlimited.
    pub fn update_daily_limit(
        ctx: Context<UpdateLedger>,
        new_limit: u64,
    ) -> Result<()> {
        ctx.accounts.credit_ledger.daily_spend_limit = new_limit;
        Ok(())
    }
}

// ── Account Structures ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct CreditLedger {
    pub owner: Pubkey,
    pub usdc_balance: u64,
    pub total_credited: u64,
    pub total_spent: u64,
    pub total_withdrawn: u64,
    pub facilitator_authority: Pubkey,
    pub daily_spend_limit: u64,
    pub daily_spent_today: u64,
    pub last_spend_reset_ts: i64,
    pub created_at: i64,
    pub bump: u8,
}

// ── Instruction Contexts ────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + CreditLedger::INIT_SPACE,
        seeds = [b"credit", owner.key().as_ref()],
        bump,
    )]
    pub credit_ledger: Account<'info, CreditLedger>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddCredit<'info> {
    #[account(
        mut,
        seeds = [b"credit", credit_ledger.owner.as_ref()],
        bump = credit_ledger.bump,
    )]
    pub credit_ledger: Account<'info, CreditLedger>,

    /// The vault program calling via CPI — will be validated in integration.
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct Debit<'info> {
    #[account(
        mut,
        seeds = [b"credit", credit_ledger.owner.as_ref()],
        bump = credit_ledger.bump,
        has_one = facilitator_authority,
    )]
    pub credit_ledger: Account<'info, CreditLedger>,

    pub facilitator_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"credit", owner.key().as_ref()],
        bump = credit_ledger.bump,
    )]
    pub credit_ledger: Account<'info, CreditLedger>,
}

#[derive(Accounts)]
pub struct UpdateLedger<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"credit", owner.key().as_ref()],
        bump = credit_ledger.bump,
    )]
    pub credit_ledger: Account<'info, CreditLedger>,
}

// ── Events ──────────────────────────────────────────────────────────

#[event]
pub struct CreditAdded {
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct CreditDebited {
    pub owner: Pubkey,
    pub amount: u64,
    pub call_reference: String,
    pub new_balance: u64,
}

#[event]
pub struct CreditWithdrawn {
    pub owner: Pubkey,
    pub gross_amount: u64,
    pub fee: u64,
    pub net_amount: u64,
    pub new_balance: u64,
}

// ── Errors ──────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient credit balance")]
    InsufficientBalance,
    #[msg("Daily spend limit exceeded")]
    DailyLimitExceeded,
    #[msg("Arithmetic overflow")]
    Overflow,
}
