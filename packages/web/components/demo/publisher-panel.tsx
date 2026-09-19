'use client';

/**
 * The publisher's share accrues on every action and is withdrawn on demand,
 * with no minimum. Waiting costs no trust because the balance is on chain,
 * which is what this panel shows — and the withdraw button (#16) is what turns
 * "on demand" from a sentence into something a stranger can try.
 */
import { useCallback, useState } from 'react';
import { ArrowDownToLine, Share2 } from 'lucide-react';

import { config } from '@/lib/chain/config';
import { claimOf, getCampaignView, toDisplay } from '@/lib/chain/read';
import { withdrawClaim } from '@/lib/demo/console-actions';
import { useAction } from '@/lib/demo/use-action';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Action, Note, Panel, Problem, Proof, Stat } from './panel';

interface Row {
  publisher: string;
  /**
   * The claim in stroops, kept alongside the display string.
   *
   * "No minimum" has to be true at every size, and the display string rounds
   * to four decimals — so a claim smaller than 0.0001 reads as "0.0000" and
   * would disable the very button that proves the claim. The button asks this
   * number instead.
   */
  claimStroops: bigint;
  claim: string;
  /** What this publisher earns from one settled action. */
  perAction: string;
  sharePct: string;
}

function PublisherRow({ row, campaignId }: { row: Row; campaignId: number }) {
  const [paid, setPaid] = useState<string | null>(null);

  const withdraw = useAction(
    useCallback(async () => {
      setPaid(null);
      const result = await withdrawClaim(campaignId, row.publisher);
      setPaid(result.amount);
    }, [campaignId, row.publisher]),
  );

  const nothingAccrued = row.claimStroops <= 0n;
  // Rounding a real balance to "0.0000" would say the opposite of what the
  // panel means, so dust gets its own label rather than a misleading zero.
  const accrued = !nothingAccrued && Number(row.claim) === 0 ? '< 0.0001' : row.claim;

  return (
    <div className="dcard">
      <div className="dcard__top">
        <span className="dcard__name mono">
          {row.publisher.slice(0, 4)}…{row.publisher.slice(-4)}
        </span>
        <span className="dpill" data-tone={nothingAccrued ? 'waiting' : 'ready'}>
          {nothingAccrued ? 'Nothing accrued' : 'Withdrawable now'}
        </span>
      </div>

      <div className="dstats">
        <Stat
          label="Accrued, withdrawable"
          value={accrued}
          unit={config.payoutAssetCode}
          tone={nothingAccrued ? 'quiet' : 'positive'}
        />
        <Stat label="Earned per action" value={row.perAction} unit={config.payoutAssetCode} />
        <Stat label="Share of each action" value={row.sharePct} />
        <Stat label="Minimum withdrawal" value="None" tone="quiet" />
      </div>

      <div className="dactions">
        <Action
          label="Withdraw"
          onClick={withdraw.run}
          pending={withdraw.pending}
          disabled={nothingAccrued}
          title={
            nothingAccrued
              ? 'Nothing has accrued yet. Settle an action first.'
              : 'Pull the accrued share out of escrow. No minimum, no schedule.'
          }
          icon={<ArrowDownToLine size={14} strokeWidth={2.4} />}
        />
      </div>

      {withdraw.error ? <Problem>{withdraw.error}</Problem> : null}
      {paid && !withdraw.error ? (
        <Note>
          Withdrew {paid} {config.payoutAssetCode}. The hash is in the log below.
        </Note>
      ) : null}
    </div>
  );
}

export function PublisherPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<Row[]>(async () => {
    const view = await getCampaignView(campaignId);
    return Promise.all(
      view.splits.map(async (split) => {
        const claimStroops = await claimOf(campaignId, split.publisher);
        return {
          publisher: split.publisher,
          claimStroops,
          claim: toDisplay(claimStroops),
          perAction: (
            (Number(view.perAction) * split.publisher_bps) /
            10_000
          ).toFixed(4),
          sharePct: `${split.publisher_bps / 100}%`,
        };
      }),
    );
  }, { key: campaignId });
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
        <PublisherRow key={row.publisher} row={row} campaignId={campaignId} />
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
