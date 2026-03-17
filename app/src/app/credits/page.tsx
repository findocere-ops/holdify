"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import NextLink from 'next/link';

export default function CreditLedgerDashboard() {
  const { connected } = useWallet();

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '800px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '40px', marginBottom: '8px' }}>Credit Ledger</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
          Your unified balance for AI model usage.
        </p>
      </div>

      {!connected ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>💳</div>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Connect Your Wallet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
            Connect to view your available AI credits, recent API usage, and billing history.
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Main Balance Card */}
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle at center, rgba(153,69,255,0.05) 0%, transparent 50%)', zIndex: 0, pointerEvents: 'none' }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available Credits
              </h2>
              <div className="text-gradient" style={{ fontSize: '72px', fontWeight: 700, lineHeight: 1, marginBottom: '24px' }}>
                $12.45
              </div>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Daily Limit</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>$10.00</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Used Today</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>$1.24</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <NextLink href="/chat">
                  <button className="btn btn-gradient" style={{ padding: '12px 32px' }}>
                    Start Chatting
                  </button>
                </NextLink>
                <NextLink href="/api-keys">
                  <button className="btn btn-primary" style={{ padding: '12px 32px' }}>
                    Get API Key
                  </button>
                </NextLink>
                <button className="btn btn-glass" style={{ padding: '12px 32px' }}>
                  Withdraw USDC
                </button>
              </div>
            </div>
          </div>

          {/* Powered By */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--accent)' }}>Powered By</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>OpenRouter</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Access 400+ AI models — Claude, GPT-4o, Gemini, Llama, and more through one unified API.
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>RTK Optimization</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  60-90% token savings via RTK. Your yield covers more AI usage automatically.
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              Recent Activity
            </h3>
            
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              {[
                { type: 'debit', desc: 'Claude 3 Opus API Call', amount: '-$0.12', time: '10 mins ago', icon: '🤖' },
                { type: 'debit', desc: 'GPT-4o API Call', amount: '-$0.04', time: '2 hours ago', icon: '🤖' },
                { type: 'credit', desc: 'Yield Harvest (jitoSOL)', amount: '+$2.50', time: '5 hours ago', icon: '🌾' },
                { type: 'credit', desc: 'Yield Harvest (jitoSOL)', amount: '+$3.10', time: 'Yesterday', icon: '🌾' },
              ].map((item, i) => (
                <div key={i} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '20px 24px', borderBottom: i === 3 ? 'none' : '1px solid var(--glass-border)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>{item.desc}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.time}</div>
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: 600, fontSize: '16px',
                    color: item.type === 'credit' ? 'var(--accent)' : 'var(--text-primary)' 
                  }}>
                    {item.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
