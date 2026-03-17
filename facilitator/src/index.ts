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

// ─── Config ───────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const PROGRAM_ID_CREDIT = new PublicKey(
  process.env.CREDIT_PROGRAM_ID || "Axx7rVWtoNPxMwNn482eAMaYFdsyYukcXr8HoDirqaNW"
);

// ─── Facilitator Wallet ───────────────────────────────────────────────────────
let facilitatorKeypair: Keypair;
if (process.env.FACILITATOR_PRIVATE_KEY) {
  facilitatorKeypair = Keypair.fromSecretKey(bs58.decode(process.env.FACILITATOR_PRIVATE_KEY));
} else {
  console.warn("FACILITATOR_PRIVATE_KEY not set. Generating random key for testing.");
  facilitatorKeypair = Keypair.generate();
}

console.log(`Facilitator Wallet: ${facilitatorKeypair.publicKey.toBase58()}`);

const connection = new Connection(RPC_URL, "confirmed");
const wallet = new anchor.Wallet(facilitatorKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

// ─── In-Memory API Key Store (MVP) ───────────────────────────────────────────
// Maps API key -> { wallet, label, dailyLimit, createdAt }
interface ApiKeyRecord {
  wallet: string;
  label: string;
  dailyLimit: number;
  createdAt: number;
  totalSpent: number;
}

const apiKeys = new Map<string, ApiKeyRecord>();

// ─── Supported Models (subset — OpenRouter has 400+) ─────────────────────────
const POPULAR_MODELS = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", costPer1k: 0.003 },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", costPer1k: 0.0008 },
  { id: "openai/gpt-4o", name: "GPT-4o", costPer1k: 0.005 },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", costPer1k: 0.00015 },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", costPer1k: 0.00125 },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", costPer1k: 0.0005 },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", costPer1k: 0.0008 },
  { id: "mistralai/mistral-large", name: "Mistral Large", costPer1k: 0.002 },
];

// ─── Helper: Resolve wallet from request ──────────────────────────────────────
function resolveWallet(req: express.Request): string | null {
  // Option 1: Bearer token is a holdify API key
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer hld_")) {
    const key = authHeader.slice(7);
    const record = apiKeys.get(key);
    if (record) return record.wallet;
  }
  // Option 2: wallet in body (for frontend direct calls)
  if (req.body.wallet) return req.body.wallet;
  return null;
}

// ─── Helper: Estimate cost from OpenRouter response ───────────────────────────
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Simple flat estimate per 1k tokens — OpenRouter returns actual cost too
  const entry = POPULAR_MODELS.find((m) => m.id === model);
  const rate = entry ? entry.costPer1k : 0.005; // default fallback
  return ((promptTokens + completionTokens) / 1000) * rate;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Health
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    facilitator: facilitatorKeypair.publicKey.toBase58(),
    openrouter: OPENROUTER_API_KEY ? "configured" : "missing",
  });
});

// List available models
app.get("/v1/models", (_req, res) => {
  res.json({ models: POPULAR_MODELS });
});

// ─── Chat Completions (OpenRouter Proxy) ──────────────────────────────────────
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const userWallet = resolveWallet(req);
    if (!userWallet) {
      return res.status(401).json({ error: "Missing wallet or invalid API key." });
    }

    const { model, messages, stream, max_completion_tokens, temperature } = req.body;
    if (!model || !messages) {
      return res.status(400).json({ error: "Missing required fields: model, messages" });
    }

    console.log(`\nRequest from ${userWallet} -> ${model}`);

    // ── 1. Check credit balance on-chain (simulated for MVP) ──────────────
    // In production: fetch CreditLedger PDA and verify usdcBalance
    /*
    const userPubkey = new PublicKey(userWallet);
    const [ledgerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ledger"), userPubkey.toBuffer()],
      PROGRAM_ID_CREDIT
    );
    const ledger = await program.account.creditLedger.fetch(ledgerPda);
    const balance = ledger.usdcBalance.toNumber() / 1e6;
    if (balance < 0.001) {
      return res.status(402).json({ error: "Insufficient Holdify credits. Deposit LST to earn yield." });
    }
    */
    console.log("  Balance OK (simulated)");

    // ── 2. Forward to OpenRouter ──────────────────────────────────────────
    if (!OPENROUTER_API_KEY) {
      // Demo mode: return mock response when no API key configured
      const mockContent = `[Holdify Demo] Model: ${model}. Connect an OpenRouter API key for live responses. Your LST yield pays for this automatically.`;
      return res.json({
        id: `chatcmpl-${crypto.randomBytes(4).toString("hex")}`,
        object: "chat.completion",
        model,
        choices: [{ index: 0, message: { role: "assistant", content: mockContent }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        holdify: { cost_usdc: 0, settlement: "demo_mode", wallet: userWallet },
      });
    }

    const openrouterBody: Record<string, unknown> = {
      model,
      messages,
      stream: stream || false,
    };
    if (max_completion_tokens) openrouterBody.max_completion_tokens = max_completion_tokens;
    if (temperature !== undefined) openrouterBody.temperature = temperature;

    const orResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://holdify.app",
        "X-Title": "Holdify",
      },
      body: JSON.stringify(openrouterBody),
    });

    // ── 3. Handle streaming ───────────────────────────────────────────────
    if (stream && orResponse.body) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = orResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }

      // Debit happens async after stream completes
      // In production: parse SSE chunks, sum tokens, debit on-chain
      console.log("  Stream completed, debit pending");
      return;
    }

    // ── 4. Non-streaming response ─────────────────────────────────────────
    if (!orResponse.ok) {
      const errorBody = await orResponse.text();
      console.error(`  OpenRouter error ${orResponse.status}: ${errorBody}`);
      return res.status(orResponse.status).json({
        error: "Upstream model error",
        details: errorBody,
      });
    }

    const data = await orResponse.json();

    // ── 5. Calculate cost & settle on-chain ───────────────────────────────
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const costUsdc = estimateCost(model, promptTokens, completionTokens);

    console.log(`  Tokens: ${promptTokens + completionTokens}, Cost: $${costUsdc.toFixed(6)}`);

    // On-chain debit (production):
    /*
    const refId = crypto.randomBytes(16);
    const costBaseUnits = new anchor.BN(Math.ceil(costUsdc * 1_000_000));
    const tx = await program.methods.debit(costBaseUnits, Array.from(refId))
      .accounts({ creditLedger: ledgerPda, facilitatorAuthority: facilitatorKeypair.publicKey })
      .rpc();
    */

    // Track spend for API key users
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer hld_")) {
      const key = authHeader.slice(7);
      const record = apiKeys.get(key);
      if (record) record.totalSpent += costUsdc;
    }

    // ── 6. Return enriched response ───────────────────────────────────────
    return res.json({
      ...data,
      holdify: {
        cost_usdc: costUsdc,
        settlement: "simulated",
        wallet: userWallet,
        credits_remaining: "check /v1/balance",
      },
    });
  } catch (err: any) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ─── Balance Check ────────────────────────────────────────────────────────────
app.get("/v1/balance/:wallet", async (req, res) => {
  try {
    const { wallet: walletAddr } = req.params;
    // In production: fetch from CreditLedger PDA
    // const userPubkey = new PublicKey(walletAddr);
    // const [ledgerPda] = PublicKey.findProgramAddressSync([Buffer.from("ledger"), userPubkey.toBuffer()], PROGRAM_ID_CREDIT);
    // const ledger = await program.account.creditLedger.fetch(ledgerPda);
    // return res.json({ balance: ledger.usdcBalance.toNumber() / 1e6, ... });

    return res.json({
      wallet: walletAddr,
      balance_usdc: 12.45,
      daily_limit: 10.0,
      used_today: 1.24,
      source: "mock",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Generate a new API key for a wallet
app.post("/v1/keys", (req, res) => {
  const { wallet: walletAddr, label, dailyLimit } = req.body;
  if (!walletAddr) {
    return res.status(400).json({ error: "wallet is required" });
  }

  const key = `hld_${crypto.randomBytes(24).toString("hex")}`;
  const record: ApiKeyRecord = {
    wallet: walletAddr,
    label: label || "default",
    dailyLimit: dailyLimit || 5.0,
    createdAt: Date.now(),
    totalSpent: 0,
  };
  apiKeys.set(key, record);

  console.log(`New API key created for ${walletAddr}: ${key.slice(0, 12)}...`);
  return res.json({ key, ...record });
});

// List keys for a wallet
app.get("/v1/keys/:wallet", (req, res) => {
  const { wallet: walletAddr } = req.params;
  const keys: Array<{ key_preview: string; label: string; dailyLimit: number; totalSpent: number; createdAt: number }> = [];

  for (const [key, record] of apiKeys) {
    if (record.wallet === walletAddr) {
      keys.push({
        key_preview: `${key.slice(0, 12)}...${key.slice(-4)}`,
        label: record.label,
        dailyLimit: record.dailyLimit,
        totalSpent: record.totalSpent,
        createdAt: record.createdAt,
      });
    }
  }

  return res.json({ wallet: walletAddr, keys });
});

// Revoke an API key
app.delete("/v1/keys/:key", (req, res) => {
  const { key } = req.params;
  if (apiKeys.has(key)) {
    apiKeys.delete(key);
    return res.json({ revoked: true });
  }
  return res.status(404).json({ error: "Key not found" });
});

// ═══════════════════════════════════════════════════════════════════════════════

app.listen(port, () => {
  console.log(`Holdify Facilitator running on port ${port}`);
  console.log(`OpenRouter: ${OPENROUTER_API_KEY ? "configured" : "demo mode (set OPENROUTER_API_KEY)"}`);
});
