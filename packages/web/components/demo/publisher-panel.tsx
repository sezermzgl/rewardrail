'use client';

/**
 * The publisher's share accrues on every action and is withdrawn on demand,
 * with no minimum. Waiting costs no trust because the balance is on chain,
 * which is what this panel shows.
 */
import { Share2 } from 'lucide-react';

import { claimOf, getCampaignView, toDisplay } from '@/lib/chain/read';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Note, Panel, Problem, Proof, Stat } from './panel';

interface Row {
  publisher: string;
  claim: string;
  /** What this publisher earns from one settled action. */
  perAction: string;
  sharePct: string;
}

export function PublisherPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<Row[]>(async () => {
    const view = await getCampaignView(campaignId);
    return Promise.all(
      view.splits.map(async (split) => ({
        publisher: split.publisher,
        claim: toDisplay(await claimOf(campaignId, split.publisher)),
        perAction: (
          (Number(view.perAction) * split.publisher_bps) /
          10_000
        ).toFixed(4),
        sharePct: `${split.publisher_bps / 100}%`,
      })),
    );
  });
  const proof = useLatestProof(['withdraw']);

  return (
    <Panel
      title="Publisher"
      role="traffic source"
      icon={<Share2 size={16} strokeWidth={2.2} />}
      proof={
        <Proof
          label="Last withdrawal"
          hash={proof?.short}
          url={proof?.url}
          fallback="nothing withdrawn yet"
        />
      }
    >
      {loading && !data ? <Note>Reading accrued shares…</Note> : null}
      {error ? <Problem>Could not read the claim: {error}</Problem> : null}

      {data?.map((row) => (
        <div key={row.publisher} className="dstats">
          <Stat label="Accrued, withdrawable" value={row.claim} unit="TUSDC" tone="positive" />
          <Stat label="Earned per action" value={row.perAction} unit="TUSDC" />
          <Stat label="Share of each action" value={row.sharePct} />
          <Stat label="Minimum withdrawal" value="None" tone="quiet" />
        </div>
      ))}

      {data?.length === 0 ? <Note>No publishers in this campaign.</Note> : null}

      <Note>
        The share is pulled, not pushed. It accrues on every settled action and
        the publisher withdraws whenever they choose — the balance is on chain,
        so waiting costs no trust.
      </Note>
    </Panel>
  );
}
