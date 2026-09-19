'use client';

/**
 * The demo: four panels and one shared log, on a single screen.
 *
 * One page on purpose. Switching pages breaks the flow and scatters the
 * judges' attention, so everything the demo claims stays visible at once.
 */
import Link from 'next/link';

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
      <main className="container demo-page">
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            ← RewardRail
          </Link>
        </p>

        <div className="demo-shell">
          <header className="demo-bar">
            <span className="demo-bar__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="demo-bar__title">Settlement console</span>
            <span className="demo-bar__meta mono">
              <span className="demo-live">
                <i />
                Stellar testnet
              </span>
              <span>
                campaign <b>{CAMPAIGN_ID}</b>
              </span>
              <span>
                escrow <b>{config.escrowId.slice(0, 6)}…{config.escrowId.slice(-6)}</b>
              </span>
            </span>
          </header>

          <div className="demo-grid">
            <AdvertiserPanel campaignId={CAMPAIGN_ID} />
            <PlayerPanel campaignId={CAMPAIGN_ID} />
            <PublisherPanel campaignId={CAMPAIGN_ID} />
            <OperatorPanel campaignId={CAMPAIGN_ID} />
          </div>

          <TransactionLog />
        </div>
      </main>
    </RefreshProvider>
  );
}
