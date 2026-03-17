"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL || "http://localhost:8080";

interface ApiKey {
  key_preview: string;
  label: string;
  dailyLimit: number;
  totalSpent: number;
  createdAt: number;
}

export default function ApiKeysPage() {
  const { publicKey, connected } = useWallet();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState("5");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchKeys = async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`${FACILITATOR_URL}/v1/keys/${publicKey.toBase58()}`);
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // silent fail on fetch
    }
  };

  useEffect(() => {
    if (connected && publicKey) fetchKeys();
  }, [connected, publicKey]);

  const createKey = async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${FACILITATOR_URL}/v1/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          label: newKeyLabel || "my-agent",
          dailyLimit: parseFloat(newKeyLimit) || 5,
        }),
      });
      const data = await res.json();
      setCreatedKey(data.key);
      setNewKeyLabel("");
      fetchKeys();
    } catch (err: any) {
      alert("Failed to create key: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="container" style={{ paddingTop: "40px", paddingBottom: "80px", maxWidth: "800px" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "40px", marginBottom: "8px" }}>API Keys</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "18px" }}>
            Generate API keys for your agents and applications.
          </p>
        </div>
        <div className="glass-card" style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "24px" }}>&#x1F511;</div>
          <h2 style={{ fontSize: "24px", marginBottom: "16px" }}>Connect Your Wallet</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "32px", maxWidth: "400px", margin: "0 auto 32px" }}>
            Connect to create API keys that let your agents access AI models, billed to your LST yield.
          </p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: "40px", paddingBottom: "80px", maxWidth: "800px" }}>
      <div style={{ marginBottom: "40px" }}>
        <h1 style={{ fontSize: "40px", marginBottom: "8px" }}>API Keys</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "18px" }}>
          Generate keys for your agents. Billed to your LST yield credits.
        </p>
      </div>

      {/* How it works */}
      <div className="glass-card" style={{ marginBottom: "32px", padding: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--accent)" }}>How it works</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          {[
            { step: "1", title: "Generate Key", desc: "Create an API key tied to your wallet" },
            { step: "2", title: "Use in Agent", desc: "Point your agent to Holdify's endpoint" },
            { step: "3", title: "Yield Pays", desc: "Usage is deducted from your LST yield" },
          ].map((item) => (
            <div key={item.step} style={{ textAlign: "center" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%", margin: "0 auto 8px",
                background: "linear-gradient(135deg, var(--accent), var(--purple))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#000", fontWeight: 700, fontSize: "14px",
              }}>
                {item.step}
              </div>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>{item.title}</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Key */}
      <div className="glass-card" style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", marginBottom: "20px" }}>Create New Key</h3>
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <input
            type="text"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            placeholder="Label (e.g. my-agent)"
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
              color: "var(--text-primary)", padding: "12px 16px", borderRadius: "8px",
              fontSize: "14px", outline: "none", fontFamily: "inherit",
            }}
          />
          <input
            type="number"
            value={newKeyLimit}
            onChange={(e) => setNewKeyLimit(e.target.value)}
            placeholder="Daily limit ($)"
            style={{
              width: "120px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
              color: "var(--text-primary)", padding: "12px 16px", borderRadius: "8px",
              fontSize: "14px", outline: "none", fontFamily: "inherit",
            }}
          />
          <button
            onClick={createKey}
            disabled={loading}
            className="btn btn-gradient"
            style={{ whiteSpace: "nowrap" }}
          >
            {loading ? "Creating..." : "Generate Key"}
          </button>
        </div>

        {createdKey && (
          <div style={{
            background: "rgba(20, 241, 149, 0.08)", border: "1px solid rgba(20, 241, 149, 0.3)",
            borderRadius: "8px", padding: "16px", marginTop: "16px",
          }}>
            <div style={{ fontSize: "13px", color: "var(--accent)", marginBottom: "8px", fontWeight: 600 }}>
              Key created! Copy it now — it won't be shown again.
            </div>
            <code style={{
              display: "block", background: "rgba(0,0,0,0.3)", padding: "12px",
              borderRadius: "6px", fontSize: "13px", wordBreak: "break-all",
              color: "var(--text-primary)", userSelect: "all",
            }}>
              {createdKey}
            </code>
            <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <strong>Endpoint:</strong> <code>{FACILITATOR_URL}/v1/chat/completions</code>
            </div>
          </div>
        )}
      </div>

      {/* Usage snippet */}
      <div className="glass-card" style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "18px", marginBottom: "16px" }}>Quick Start</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "16px" }}>
          Use your Holdify API key like an OpenAI key. Works with any OpenAI-compatible SDK.
        </p>
        <pre style={{
          background: "rgba(0,0,0,0.4)", padding: "20px", borderRadius: "10px",
          fontSize: "13px", overflowX: "auto", lineHeight: "1.6",
          border: "1px solid var(--glass-border)",
        }}>
          <code style={{ color: "var(--text-primary)" }}>{`curl ${FACILITATOR_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer hld_your_key_here" \\
  -d '{
    "model": "anthropic/claude-sonnet-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
        </pre>
      </div>

      {/* Existing Keys */}
      <div>
        <h3 style={{ fontSize: "20px", marginBottom: "16px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "12px" }}>
          Your Keys
        </h3>
        {keys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            No API keys yet. Create one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {keys.map((k, i) => (
              <div key={i} className="glass-card" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px",
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "4px" }}>{k.label}</div>
                  <code style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{k.key_preview}</code>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>
                    ${k.totalSpent.toFixed(4)} spent
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    Limit: ${k.dailyLimit}/day
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
