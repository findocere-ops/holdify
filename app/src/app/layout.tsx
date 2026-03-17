import type { Metadata } from 'next';
import './globals.css';
import { SolanaProvider } from '@/components/SolanaProvider';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Holdify | Your assets work while you hold',
  description: 'Convert passive crypto yield into AI model credits continuously, without ever touching the principal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SolanaProvider>
          <Header />
          <main>
            {children}
          </main>
        </SolanaProvider>
      </body>
    </html>
  );
}
