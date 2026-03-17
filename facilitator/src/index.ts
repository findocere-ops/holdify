import express from "express";
import cors from "cors";
import morgan from "morgan";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Holdify Programs
const PROGRAM_ID_CREDIT = new PublicKey("Auv2qKnjM9g3x57LPRh4Fw7J8iS3h7FqWwWn4bMwVn1N"); // Replace with actual CreditLedger ID
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";

// Load Facilitator Wallet
let facilitatorKeypair: Keypair;
if (process.env.FACILITATOR_PRIVATE_KEY) {
    facilitatorKeypair = Keypair.fromSecretKey(bs58.decode(process.env.FACILITATOR_PRIVATE_KEY));
} else {
    console.warn("⚠️ FACILITATOR_PRIVATE_KEY not set. Generating a random key for testing.");
    facilitatorKeypair = Keypair.generate();
}

console.log(`🤖 Facilitator Wallet: ${facilitatorKeypair.publicKey.toBase58()}`);

const connection = new Connection(RPC_URL, "confirmed");
const wallet = new anchor.Wallet(facilitatorKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

// Healthcheck
app.get("/health", (req, res) => {
    res.json({ status: "ok", facilitator: facilitatorKeypair.publicKey.toBase58() });
});

// Mock Price Oracles for AI API Calls (e.g., GPT-4o, Claude 3 Opus)
const MOCK_API_COSTS = {
    "gpt-4o": 0.04, // $0.04 per call mock
    "claude-3-opus": 0.12,
};

/**
 * Main x402 Proxy Endpoint
 * User sends:
 * - wallet: PublicKey string
 * - model: string (e.g. 'gpt-4o')
 * - prompt: string
 */
app.post("/v1/chat/completions", async (req, res) => {
    try {
        const { wallet: userWallet, model, prompt } = req.body;

        if (!userWallet || !model || !prompt) {
            return res.status(400).json({ error: "Missing required fields (wallet, model, prompt)" });
        }

        const costUsdc = MOCK_API_COSTS[model as keyof typeof MOCK_API_COSTS];
        if (!costUsdc) {
            return res.status(400).json({ error: "Unsupported or unknown model." });
        }

        console.log(`\n💳 Incoming request from ${userWallet} for ${model}. Cost: $${costUsdc}`);

        // 1. Fetch User's Credit Ledger On-Chain
        const userPubkey = new PublicKey(userWallet);
        /*
        // In reality, fetch IDL and verify balance:
        const program = new anchor.Program(IDL, PROGRAM_ID_CREDIT, provider);
        const [ledgerPda] = PublicKey.findProgramAddressSync([Buffer.from("ledger"), userPubkey.toBuffer()], program.programId);
        
        try {
            const ledgerAccount = await program.account.creditLedger.fetch(ledgerPda);
            const balanceDecimals = ledgerAccount.usdcBalance.toNumber() / 1e6;
            
            if (balanceDecimals < costUsdc) {
                return res.status(402).json({ error: "Payment Required - Insufficient Holdify AI Credits", balance: balanceDecimals });
            }
        } catch (e) {
            return res.status(404).json({ error: "No Credit Ledger found for wallet." });
        }
        */
        console.log("   ✅ Balance OK (Simulated check).");

        // 2. Make the ACTUAL call to OpenAI/Anthropic
        console.log(`   🧠 Routing request to ${model}...`);
        const mockResponse = `This is a simulated AI response from ${model} for prompt: "${prompt.substring(0, 20)}..."`;

        // 3. Settle Payment On-Chain via Credit Ledger Program
        const refId = crypto.randomBytes(16); // 16 byte correlation ID
        const costBaseUnits = new anchor.BN(costUsdc * 1_000_000);

        console.log(`   💸 Settling payment on-chain via holdify-treasury (Amount: ${costBaseUnits.toString()})`);
        
        /* 
        // Real on-chain debit & settlement CPI building here
        const tx = await program.methods.debit(costBaseUnits, Array.from(refId))
            .accounts({
                creditLedger: ledgerPda,
                treasury: treasuryPda,
                facilitatorAuthority: facilitatorKeypair.publicKey,
                // ...
            })
            .rpc();
        console.log(`   🔗 Tx Signed: ${tx}`);
        */

        // 4. Return API Result to User
        return res.json({
            id: `chatcmpl-${crypto.randomBytes(4).toString("hex")}`,
            model: model,
            choices: [{
                message: { role: "assistant", content: mockResponse }
            }],
            usage: {
                total_cost_usdc: costUsdc,
                settlement_tx: "mock_tx_signature_abc123"
            }
        });

    } catch (err: any) {
        console.error("❌ Facilitator Proxy Error:", err);
        return res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

app.listen(port, () => {
    console.log(`✅ Holdify Facilitator Server running on port ${port}`);
});
