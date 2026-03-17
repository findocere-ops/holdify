"use client";

import { useWallet } from '@solana/wallet-adapter-react';

export default function AnalyticsDashboard() {
  const { connected } = useWallet();

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '40px', marginBottom: '8px' }}>Protocol Analytics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
          Real-time metrics for the Holdify network.
        </p>
      </div>

      {/* Top Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Value Locked</div>
          <div className="text-gradient" style={{ fontSize: '32px', fontWeight: 700 }}>$1.42M</div>
          <div style={{ fontSize: '13px', color: '#14F195', marginTop: '8px' }}>↑ 12.4% this week</div>
        </div>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All-Time Yield Minted</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>$84,290</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Across 1,204 active vaults</div>
        </div>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protocol Revenue</div>
          <div style={{ fontSize: '32px', fontWeight: 700 }}>$4,150</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Treasury holdings</div>
        </div>
        
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI API Calls Facilitated</div>
          <div className="text-gradient-purple" style={{ fontSize: '32px', fontWeight: 700 }}>1.2M+</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>Zero skipped invoices</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        
        {/* Left Column (Charts Placeholder) */}
        <div>
          <div className="glass-card" style={{ height: '400px', display: 'flex', flexDirection: 'column', padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>Yield Generation Over Time</h3>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              [ Chart Component: Monthly USDC generated from LST yields ]
            </div>
          </div>
        </div>
        
        {/* Right Column (LST Breakdown) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '24px' }}>Supported Assets (V1)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🟢</span> <span style={{ fontWeight: 600 }}>jitoSOL</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>65%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '65%', height: '100%', background: 'var(--accent)' }} />
                </div>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🌊</span> <span style={{ fontWeight: 600 }}>mSOL</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>35%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '35%', height: '100%', background: 'var(--purple)' }} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(20,241,149,0.05) 0%, rgba(153,69,255,0.05) 100%)' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Fee Structure</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Yield Harvest Fee</span>
                <span style={{ color: 'white', fontWeight: 500 }}>0.7% (Protocol) + 0.1% (Crank)</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>LST Withdrawal Fee</span>
                <span style={{ color: '#14F195', fontWeight: 500 }}>0.0% (Free)</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Unused Credit Withdrawal</span>
                <span style={{ color: 'white', fontWeight: 500 }}>0.3%</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Facilitator Markup</span>
                <span style={{ color: 'white', fontWeight: 500 }}>0.5% max</span>
              </li>
            </ul>
          </div>
        </div>
        
      </div>
    </div>
  );
}
