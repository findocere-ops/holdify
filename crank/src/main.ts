import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

// Load the Holdify program IDLs or use Anchor's native IDL fetching
// For V1 Crank, we assume we have the keypair and RPC URL
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const CRANK_KEYPAIR_PATH = process.env.CRANK_KEYPAIR_PATH || path.join(require("os").homedir(), ".config/solana/id.json");

// Program IDs from our init
const PROGRAM_ID_VAULT = new PublicKey("Auv2qKnjM9g3x57LPRh4Fw7J8iS3h7FqWwWn4bMwVn1N");

async function main() {
    console.log("🚀 Starting Holdify Crank Bot...");
    console.log(`📡 RPC: ${RPC_URL}`);

    // Load Keypair
    let crankKeypair: Keypair;
    if (process.env.CRANK_PRIVATE_KEY) {
        crankKeypair = Keypair.fromSecretKey(bs58.decode(process.env.CRANK_PRIVATE_KEY));
    } else {
        const secretKeyString = fs.readFileSync(CRANK_KEYPAIR_PATH, 'utf8');
        crankKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyString)));
    }
    console.log(`🤖 Crank Wallet: ${crankKeypair.publicKey.toBase58()}`);

    // Setup connection and provider
    const connection = new Connection(RPC_URL, "confirmed");
    const wallet = new anchor.Wallet(crankKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // Fetch the Vault Program IDL
    let vaultProgram: anchor.Program;
    try {
        const idl = await anchor.Program.fetchIdl(PROGRAM_ID_VAULT, provider);
        if (!idl) throw new Error("IDL not found for vault program on-chain");
        vaultProgram = new anchor.Program(idl, provider);
    } catch (e) {
        console.warn("⚠️ Could not fetch IDL from chain. Ensure program is deployed and IDL is initialized.");
        // Fallback or exit
        process.exit(1);
    }

    console.log("✅ Ready to monitor vaults...");

    // Main Loop: Run every 5 minutes (or whatever config)
    const INTERVAL_MS = 5 * 60 * 1000;
    
    const runCrank = async () => {
        try {
            console.log(`\n[${new Date().toISOString()}] 🔍 Scanning for vaults to harvest...`);
            
            // Get all UserVault accounts
            // (Assumes the IDL defines a 'userVault' account type)
            const allVaults = await vaultProgram.account.userVault.all();
            console.log(`Found ${allVaults.length} total vaults.`);

            const currentEpoch = (await connection.getEpochInfo()).epoch;
            let harvestedCount = 0;

            for (const vault of allVaults) {
                const lastHarvested = vault.account.lastHarvestedEpoch as anchor.BN;
                
                if (lastHarvested.lt(new anchor.BN(currentEpoch))) {
                    console.log(`   🌾 Harvesting vault ${vault.publicKey.toBase58()} (Owner: ${vault.account.owner.toBase58()})`);
                    
                    try {
                        // In V1, this builds the instruction to call `harvest_epoch`.
                        // Note: For real Jupiter swaps, we would fetch the route from Jupiter API here
                        // and pass the swap data into the instruction. For now, we simulate the call.
                        
                        // Example pseudo-code for calling harvest_epoch:
                        /*
                        const tx = await vaultProgram.methods
                            .harvestEpoch(Buffer.from([])) // empty swap data for mock
                            .accounts({
                                userVault: vault.publicKey,
                                owner: vault.account.owner,
                                crank: crankKeypair.publicKey,
                                // ... other required accounts (treasury, registry, pyth, etc)
                            })
                            .rpc();
                        console.log(`   ✅ Harvest Tx: ${tx}`);
                        */

                        console.log(`   [Simulated] Would execute harvest_epoch instruction here.`);
                        harvestedCount++;

                    } catch (harvestErr) {
                        console.error(`   ❌ Failed to harvest vault ${vault.publicKey.toBase58()}:`, harvestErr);
                    }
                }
            }

            console.log(`✅ Epoch ${currentEpoch} Scan complete. Harvested ${harvestedCount} vaults.`);

        } catch (err) {
            console.error("❌ Error during crank iteration:", err);
        }
    };

    // Run once immediately, then interval
    await runCrank();
    setInterval(runCrank, INTERVAL_MS);
}

main().catch(console.error);
