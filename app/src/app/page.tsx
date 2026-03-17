import Link from 'next/link';

export default function Home() {
  return (
    <div className="container" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
      <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div 
          className="animate-fade-in"
          style={{ 
            display: 'inline-block', 
            padding: '4px 16px', 
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500
          }}>
          <span style={{ color: 'var(--accent)' }}>●</span> Live on Solana Devnet
        </div>
        
        <h1 className="animate-fade-in delay-100" style={{ fontSize: '64px', lineHeight: 1.1, marginBottom: '24px' }}>
          Your assets work <br/>
          <span className="text-gradient">while you hold.</span>
        </h1>
        
        <p className="animate-fade-in delay-200" style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: 1.6 }}>
          Convert passive crypto yield into AI model credits continuously.
          Keep your principal entirely safe. Never pay API bills out of pocket again.
        </p>
        
        <div className="animate-fade-in delay-300" style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/sol" className="btn btn-gradient" style={{ padding: '16px 32px', fontSize: '16px' }}>
            Start with SOL
          </Link>
          <a href="#" className="btn btn-glass" style={{ padding: '16px 32px', fontSize: '16px' }}>
            Read Docs
          </a>
        </div>
      </div>
      
      <div className="animate-fade-in delay-300" style={{ marginTop: '100px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--purple-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
          </div>
          <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Principal Protected</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Your original deposit is locked safely in an Anchor program. Only the yield is harvested to pay for AI services.
          </p>
        </div>
        
        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
          </div>
          <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Seamless AI APIs</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Use the Holdify Credit Ledger to pay for Claude, OpenAI, and Llama seamlessly. 
            Connect once, query endlessly.
          </p>
        </div>
        
        <div className="glass-card">
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '24px' }}>📈</span>
          </div>
          <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Smart Auto-Compound</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Configure price floors for SOL. If the price drops below your target, the protocol auto-compounds your yield instead of selling.
          </p>
        </div>
      </div>
    </div>
  );
}
