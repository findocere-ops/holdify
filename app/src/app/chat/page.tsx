"use client";

import { useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const FACILITATOR_URL = process.env.NEXT_PUBLIC_FACILITATOR_URL || "http://localhost:8080";

const MODELS = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
  { id: "mistralai/mistral-large", name: "Mistral Large" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const { publicKey, connected } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !connected || !publicKey) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${FACILITATOR_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          model,
          messages: [...messages, userMsg],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error || "Request failed"}` },
        ]);
        return;
      }

      const assistantContent = data.choices?.[0]?.message?.content || "No response";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

      if (data.holdify?.cost_usdc) {
        setTotalCost((prev) => prev + data.holdify.cost_usdc);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Connection error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!connected) {
    return (
      <div className="container" style={{ paddingTop: "40px", paddingBottom: "80px", maxWidth: "800px" }}>
        <div style={{ marginBottom: "40px" }}>
          <h1 style={{ fontSize: "40px", marginBottom: "8px" }}>AI Chat</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "18px" }}>
            Access 400+ AI models, paid by your LST yield.
          </p>
        </div>
        <div className="glass-card" style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "24px" }}>&#x1F9E0;</div>
          <h2 style={{ fontSize: "24px", marginBottom: "16px" }}>Connect Your Wallet</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "32px", maxWidth: "400px", margin: "0 auto 32px" }}>
            Your SOL LST yield pays for AI usage automatically. No credit card needed.
          </p>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxWidth: "900px", margin: "0 auto", padding: "0 24px" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600 }}>AI Chat</h1>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-primary)", padding: "8px 12px", borderRadius: "8px",
              fontSize: "14px", cursor: "pointer", outline: "none",
            }}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id} style={{ background: "#111" }}>{m.name}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
          Session cost: <span style={{ color: "var(--accent)", fontWeight: 600 }}>${totalCost.toFixed(4)}</span>
          {" "}(from yield)
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-secondary)", paddingTop: "120px" }}>
            <div style={{ fontSize: "64px", marginBottom: "16px", opacity: 0.3 }}>&#x1F4AC;</div>
            <p style={{ fontSize: "18px", marginBottom: "8px" }}>Start a conversation</p>
            <p style={{ fontSize: "14px" }}>Your LST yield pays for every message. Zero principal spent.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "75%", padding: "14px 18px", borderRadius: "16px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, var(--accent), var(--purple))"
                  : "var(--glass-bg)",
                color: msg.role === "user" ? "#000" : "var(--text-primary)",
                border: msg.role === "assistant" ? "1px solid var(--glass-border)" : "none",
                fontSize: "15px", lineHeight: "1.6", whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "14px 18px", borderRadius: "16px", background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)", color: "var(--text-secondary)",
            }}>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 0", borderTop: "1px solid var(--glass-border)" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            style={{
              flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-primary)", padding: "14px 16px", borderRadius: "12px",
              fontSize: "15px", resize: "none", outline: "none", fontFamily: "inherit",
              minHeight: "48px", maxHeight: "120px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn btn-gradient"
            style={{
              height: "48px", width: "48px", padding: 0, borderRadius: "12px",
              opacity: loading || !input.trim() ? 0.4 : 1,
              fontSize: "18px",
            }}
          >
            &#x2191;
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px", textAlign: "center" }}>
          Powered by OpenRouter. {MODELS.find((m) => m.id === model)?.name || model} via Holdify.
        </div>
      </div>
    </div>
  );
}
