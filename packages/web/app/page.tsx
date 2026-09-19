import Link from 'next/link';

/**
 * Placeholder. The landing page is specified in
 * docs/superpowers/specs/2026-09-19-rewardrail-landing-design.md and replaces
 * this file; the demo it links to lives at /demo.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">RewardRail</h1>
      <p style={{ color: 'var(--muted)' }}>
        A Stellar-based payout and settlement layer for rewarded advertising.
      </p>
      <Link
        href="/demo"
        className="w-fit rounded-md px-4 py-2 text-sm font-medium"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}
      >
        View live demo
      </Link>
    </main>
  );
}
