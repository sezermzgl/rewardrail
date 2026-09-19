'use client';

/**
 * The demo: four panels and one shared log, on a single screen.
 *
 * One page on purpose. Switching pages breaks the flow and scatters the
 * judges' attention, so everything the demo claims stays visible at once.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { AdvertiserPanel } from '@/components/demo/advertiser-panel';
import { OperatorPanel } from '@/components/demo/operator-panel';
import { PlayerPanel } from '@/components/demo/player-panel';
import { PublisherPanel } from '@/components/demo/publisher-panel';
import { TransactionLog } from '@/components/demo/transaction-log';
import { config } from '@/lib/chain/config';
import { RefreshProvider } from '@/lib/demo/refresh';
import { fetchHealth } from '@/lib/demo/validator';

/**
 * Which campaign the console is looking at.
 *
 * Campaign ids are global and increment on every open, so a fixed id goes
 * stale the moment anyone opens one — including the advertiser panel's own
 * button. The env var is the starting guess, the validator's own answer
 * replaces it, and opening a campaign moves every panel to the id the contract
 * just returned.
 */
const CONFIGURED_CAMPAIGN_ID = Number(process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? 0);

export default function DemoPage() {
  const [campaignId, setCampaignId] = useState(CONFIGURED_CAMPAIGN_ID);
  const [followValidator, setFollowValidator] = useState(true);

  useEffect(() => {
    if (!followValidator) return;
    let alive = true;
    void fetchHealth()
      .then((health) => {
        // A campaign opened from the panel wins over the validator's default;
        // otherwise the console would snap back to it on the next poll.
        if (alive && followValidator && Number.isInteger(health.demoCampaignId)) {
          setCampaignId(health.demoCampaignId);
        }
      })
      // The validator being down is a normal state; the chain-backed panels
      // still read the configured campaign.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [followValidator]);

  const onCampaignOpened = useCallback((opened: number) => {
    setFollowValidator(false);
    setCampaignId(opened);
  }, []);

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
                campaign <b>{campaignId}</b>
              </span>
              <span>
                escrow <b>{config.escrowId.slice(0, 6)}…{config.escrowId.slice(-6)}</b>
              </span>
            </span>
          </header>

          <div className="demo-grid">
            <AdvertiserPanel campaignId={campaignId} onCampaignOpened={onCampaignOpened} />
            <PlayerPanel campaignId={campaignId} />
            <PublisherPanel campaignId={campaignId} />
            <OperatorPanel campaignId={campaignId} />
          </div>

          <TransactionLog />
        </div>
      </main>
    </RefreshProvider>
  );
}
