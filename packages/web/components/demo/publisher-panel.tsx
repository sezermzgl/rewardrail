'use client';

/**
 * The publisher's share accrues on every action and is withdrawn on demand,
 * with no minimum. Waiting costs no trust because the balance is on chain,
 * which is what this panel shows.
 */
import { claimOf, getCampaignView, toDisplay } from '@/lib/chain/read';
import { useLive } from '@/lib/demo/use-live';

import { Figure, Panel, Placeholder, Problem } from './panel';

interface Row {
  publisher: string;
  claim: string;
}

export function PublisherPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<Row[]>(async () => {
    const view = await getCampaignView(campaignId);
    return Promise.all(
      view.splits.map(async (split) => ({
        publisher: split.publisher,
        claim: toDisplay(await claimOf(campaignId, split.publisher)),
      })),
    );
  });

  return (
    <Panel title="Publisher" role="traffic source">
      {loading && !data ? <Placeholder>Reading accrued shares…</Placeholder> : null}
      {error ? <Problem>Could not read the claim: {error}</Problem> : null}

      {data?.map((row) => (
        <div key={row.publisher} className="flex flex-col gap-1">
          <p className="mono text-[12px]" style={{ color: 'var(--muted)' }}>
            {row.publisher.slice(0, 6)}…{row.publisher.slice(-6)}
          </p>
          <Figure label="Accrued, withdrawable" value={row.claim} unit="TUSDC" />
        </div>
      ))}

      {data?.length === 0 ? <Placeholder>No publishers in this campaign.</Placeholder> : null}

      <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        No minimum withdrawal. The share is pulled, not pushed, so reconciliation
        happens when the publisher chooses.
      </p>
    </Panel>
  );
}
