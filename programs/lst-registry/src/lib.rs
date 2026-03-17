use anchor_lang::prelude::*;

declare_id!("FRJhuyZW5z91VMZeyYcV7MBgjveMyVPmb7Cs7Pr3Ki5J");

#[program]
pub mod lst_registry {
    use super::*;

    /// Register a new LST token in the registry.
    /// Admin-only for V1 (upgradeable to multisig governance later).
    pub fn add_lst(
        ctx: Context<AddLst>,
        name: String,
        pool_type: PoolType,
        stake_pool_state: Pubkey,
    ) -> Result<()> {
        let meta = &mut ctx.accounts.lst_meta;
        meta.mint = ctx.accounts.lst_mint.key();
        meta.name = name;
        meta.pool_type = pool_type;
        meta.stake_pool_state = stake_pool_state;
        meta.is_active = true;
        meta.added_at = Clock::get()?.unix_timestamp;
        meta.authority = ctx.accounts.authority.key();
        meta.bump = ctx.bumps.lst_meta;
        Ok(())
    }

    /// Deactivate an LST. Existing vaults can still harvest, but no new deposits.
    pub fn deactivate_lst(ctx: Context<DeactivateLst>) -> Result<()> {
        let meta = &mut ctx.accounts.lst_meta;
        require!(meta.is_active, ErrorCode::AlreadyDeactivated);
        meta.is_active = false;
        Ok(())
    }
}

// ── Account Structures ──────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct LSTMeta {
    pub mint: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub pool_type: PoolType,
    pub stake_pool_state: Pubkey,
    pub is_active: bool,
    pub added_at: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum PoolType {
    SplStakePool,
    Marinade,
}

// ── Instruction Contexts ────────────────────────────────────────────

#[derive(Accounts)]
pub struct AddLst<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: This is the LST token mint we're registering.
    pub lst_mint: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + LSTMeta::INIT_SPACE,
        seeds = [b"lst", lst_mint.key().as_ref()],
        bump,
    )]
    pub lst_meta: Account<'info, LSTMeta>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateLst<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        seeds = [b"lst", lst_meta.mint.as_ref()],
        bump = lst_meta.bump,
    )]
    pub lst_meta: Account<'info, LSTMeta>,
}

// ── Utility: Exchange Rate Reading ──────────────────────────────────

/// Reads the LST/SOL exchange rate from the stake pool state account.
/// Returns lamports per 1 LST token (9 decimal places).
///
/// For V1 this is a placeholder — the actual deserialization logic
/// will be implemented in Build Stage 2 with real pool state parsing.
pub fn read_exchange_rate(
    _pool_state_data: &[u8],
    pool_type: &PoolType,
) -> Result<u64> {
    match pool_type {
        PoolType::SplStakePool => {
            // SPL Stake Pool: rate = total_stake_lamports / pool_mint_supply
            // Offsets: total_stake_lamports at byte 258 (u64), pool_mint_supply read from mint
            // Will implement real deserialization in Stage 2
            Ok(1_000_000_000) // 1:1 placeholder
        }
        PoolType::Marinade => {
            // Marinade: msol_price stored directly as u64, fixed-point 9 decimals
            // Will implement real deserialization in Stage 2
            Ok(1_000_000_000) // 1:1 placeholder
        }
    }
}

// ── Errors ──────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("LST is already deactivated")]
    AlreadyDeactivated,
    #[msg("LST is not active")]
    LstNotActive,
    #[msg("Invalid exchange rate data")]
    InvalidExchangeRate,
}
