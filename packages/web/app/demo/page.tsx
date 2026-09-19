'use client';

/**
 * The demo: four panels side by side, one shared log beneath them.
 *
 * One page on purpose. Switching pages breaks the flow and scatters the
 * judges' attention, so everything the demo claims is visible at once.
 */
import { AdvertiserPanel } from '@/components/demo/advertiser-panel';
import { OperatorPanel } from '@/components/demo/operator-panel';
import { PlayerPanel } from '@/components/demo/player-panel';
import { PublisherPanel } from '@/components/demo/publisher-panel';
import { TransactionLog } from '@/components/demo/transaction-log';
import { config } from '@/lib/chain/config';
import { RefreshProvider } from '@/lib/demo/refresh';

/** One campaign demonstrates the whole mechanism; more is scope, not proof. */
const CAMPAIGN_ID = Number(process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? 0);

export default function DemoPage() {
  return (
    <RefreshProvider>
      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">
            RewardRail — live on Stellar testnet
          </h1>
          <p className="mono text-[12px]" style={{ color: 'var(--muted)' }}>
            campaign {CAMPAIGN_ID} · escrow {config.escrowId.slice(0, 6)}…
            {config.escrowId.slice(-6)}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdvertiserPanel campaignId={CAMPAIGN_ID} />
          <PlayerPanel />
          <PublisherPanel campaignId={CAMPAIGN_ID} />
          <OperatorPanel />
        </div>

        <TransactionLog />
      </main>
    </RefreshProvider>
  );
}
