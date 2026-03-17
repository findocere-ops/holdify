"use client";

import Link from 'react-scroll/modules/components/Link'; // we will use next/link instead, correcting below
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function Header() {
  const pathname = usePathname();

  return (
    <header>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <NextLink href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 'bold', fontSize: '18px'
          }}>
            H
          </div>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.02em' }}>
            Holdify
          </span>
        </NextLink>

        <nav className="nav-links">
          <NextLink href="/sol" className="nav-link" data-active={pathname.startsWith('/sol')}>
            SOL Track
          </NextLink>
          <NextLink href="/chat" className="nav-link" data-active={pathname === '/chat'}>
            AI Chat
          </NextLink>
          <NextLink href="/credits" className="nav-link" data-active={pathname === '/credits'}>
            Credits
          </NextLink>
          <NextLink href="/api-keys" className="nav-link" data-active={pathname === '/api-keys'}>
            API Keys
          </NextLink>
          <NextLink href="/analytics" className="nav-link" data-active={pathname === '/analytics'}>
            Analytics
          </NextLink>
        </nav>

        <div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
