"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export default function SolTrackDashboard() {
  const { connected } = useWallet();

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '40px', marginBottom: '8px' }}>SOL Track</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>
            Deposit LSTs to passively generate AI credits.
          </p>
        </div>
        
        {connected && (
          <Link href="/sol/deposit" className="btn btn-gradient">
            + New Deposit
          </Link>
        )}
      </div>

      {!connected ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>🔌</div>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Connect Your Wallet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
            Connect your Solana wallet to view your active vaults, harvest yield, and manage your LST deposits.
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
          {/* Main Vault List */}
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
              Your Active Vaults
            </h3>
            
            {/* Mock Vault Card */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🟢
                  </div>
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 600 }}>jitoSOL</h4>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>APY: ~7.2%</span>
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>10.00</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>~$1,850.40</div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Harvested Credits</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>+$12.45</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Price Range (Floor/Ceiling)</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>$150 - $400</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <Link href="/sol/settings" className="btn btn-glass" style={{ flex: 1 }}>
                  Manage Policy
                </Link>
                <button className="btn" style={{ flex: 1, border: '1px solid rgba(255,100,100,0.3)', color: '#ff6b6b' }}>
                  Withdraw
                </button>
              </div>
            </div>
          </div>
          
          {/* Right Sidebar Stats */}
          <div>
            <div className="glass-card" style={{ padding: '24px', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Global View
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total LST Deposited</div>
                <div style={{ fontSize: '28px', fontWeight: 700 }}>10.00 SOL</div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total AI Credits Minted</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>$12.45</div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Premium Tier</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                  Basic (0.7% Fee)
                </div>
              </div>
              
              <Link href="/credits" className="btn btn-primary" style={{ width: '100%' }}>
                View Credit Ledger →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
