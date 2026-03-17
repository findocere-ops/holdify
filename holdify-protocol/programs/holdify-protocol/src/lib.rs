use anchor_lang::prelude::*;

declare_id!("FaTsinXaMTYunFKqXaan77NriLLsp2nwRvS8wbHJ26gD");

#[program]
pub mod holdify_protocol {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
