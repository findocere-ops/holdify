"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { useState } from 'react';

export default function DepositFlow() {
  const { connected } = useWallet();
  const [amount, setAmount] = useState('10');
  const [floor, setFloor] = useState('150');
  const [ceiling, setCeiling] = useState('400');
  const [lst, setLst] = useState('jitosol');

  if (!connected) {
    return (
      <div className="container" style={{ paddingTop: '80px', textAlign: 'center' }}>
        <h2>Please connect your wallet first</h2>
        <Link href="/sol" className="btn btn-primary" style={{ marginTop: '24px' }}>
          Go Back
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px', maxWidth: '600px' }}>
      <Link href="/sol" className="nav-link" style={{ display: 'inline-block', marginBottom: '24px' }}>
        ← Back to Vaults
      </Link>
      
      <h1 style={{ fontSize: '32px', marginBottom: '32px' }}>New LST Deposit</h1>
      
      <div className="glass-card">
        {/* Token Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Select LST
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div 
              onClick={() => setLst('jitosol')}
              style={{ 
                padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                border: lst === 'jitosol' ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                background: lst === 'jitosol' ? 'var(--glass-hover)' : 'transparent'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🟢</span>
                <span style={{ fontWeight: 600 }}>jitoSOL</span>
              </div>
            </div>
            <div 
              onClick={() => setLst('msol')}
              style={{ 
                padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                border: lst === 'msol' ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                background: lst === 'msol' ? 'var(--glass-hover)' : 'transparent'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🌊</span>
                <span style={{ fontWeight: 600 }}>mSOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Amount */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Deposit Amount
          </label>
          <div style={{ position: 'relative' }}>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ 
                width: '100%', padding: '16px', paddingRight: '100px', fontSize: '24px', fontWeight: 500,
                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '12px',
                color: 'white', fontFamily: 'inherit', outline: 'none'
              }} 
            />
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {lst === 'jitosol' ? 'jitoSOL' : 'mSOL'}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'right' }}>
            Balance: 42.50 — <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>Max</button>
          </div>
        </div>

        {/* Price Policy */}
        <div style={{ marginBottom: '40px', background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Price Policy (Yield Handling)</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
            Holdify only swaps yield when the SOL price is favorable. If the price drops below your floor, yield is auto-compounded as LST instead.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Price Floor ($)
              </label>
              <input 
                type="number" 
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                style={{ 
                  width: '100%', padding: '12px', fontSize: '16px',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px',
                  color: 'white', outline: 'none'
                }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Price Ceiling ($)
              </label>
              <input 
                type="number" 
                value={ceiling}
                onChange={(e) => setCeiling(e.target.value)}
                style={{ 
                  width: '100%', padding: '12px', fontSize: '16px',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px',
                  color: 'white', outline: 'none'
                }} 
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button className="btn btn-gradient" style={{ width: '100%', padding: '16px', fontSize: '18px' }}>
          Deposit & Create Vault
        </button>
      </div>
      
      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
        By depositing, you agree to the Holdify 0.7% protocol fee on harvested yield.
        Principal is 100% protected and fee-free on withdrawal.
      </p>
    </div>
  );
}
