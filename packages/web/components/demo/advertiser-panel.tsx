'use client';

/**
 * What the advertiser can verify without trusting anyone: the budget still
 * unreleased, the amount each action costs, and the ratio table that cannot
 * change while the campaign runs.
 */
import { Megaphone } from 'lucide-react';

import { config, explorerContract } from '@/lib/chain/config';
import { getCampaignView } from '@/lib/chain/read';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Note, Panel, Problem, Proof, Stat } from './panel';

/**
 * How many more actions the remaining budget pays for.
 *
 * The contract keeps `remaining` but not the budget it started with, so spend
 * cannot be shown (F4 in docs/03-contract-interface.md). This is the honest
 * figure in its place, and the more useful one for an advertiser deciding
 * whether to top up.
 */
function actionsLeft(remaining: string, perAction: string): string {
  const per = Number(perAction);
  if (!Number.isFinite(per) || per <= 0) return '—';
  return String(Math.floor(Number(remaining) / per));
}

export function AdvertiserPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive(() => getCampaignView(campaignId));
  const proof = useLatestProof(['campaign', 'close', 'settle']);

  return (
    <Panel
      title="Advertiser"
      role="campaign owner"
      icon={<Megaphone size={16} strokeWidth={2.2} />}
      proof={
        <Proof
          label="Escrow"
          hash={proof?.short}
          url={proof?.url}
          fallback={`${config.escrowId.slice(0, 8)}…${config.escrowId.slice(-6)}`}
        />
      }
    >
      {loading && !data ? <Note>Reading the campaign…</Note> : null}
      {error ? <Problem>Could not read the campaign: {error}</Problem> : null}

      {data ? (
        <>
          <div className="dstats">
            <Stat
              label="Budget remaining"
              value={data.remaining}
              unit="TUSDC"
              tone="positive"
            />
            <Stat label="Per action" value={data.perAction} unit="TUSDC" />
            <Stat
              label="Actions still funded"
              value={actionsLeft(data.remaining, data.perAction)}
              tone={data.open ? undefined : 'quiet'}
            />
            <Stat
              label="Status"
              value={data.open ? 'Open' : 'Closed'}
              tone={data.open ? undefined : 'quiet'}
            />
            <Stat
              label="Escrow holds"
              value={data.escrowTotalBalance}
              unit="TUSDC"
              tone="quiet"
              title="Across every campaign in this contract. The contract keeps no per-campaign balance, so this is not campaign 0 alone."
            />
          </div>

          <table className="dtable numeric">
            <thead>
              <tr>
                <th>Publisher</th>
                <th className="right">Player</th>
                <th className="right">Publisher</th>
                <th className="right">Platform</th>
              </tr>
            </thead>
            <tbody>
              {data.splits.map((split) => (
                <tr key={split.publisher}>
                  <td className="mono">
                    {split.publisher.slice(0, 4)}…{split.publisher.slice(-4)}
                  </td>
                  <td className="right">{split.player_bps / 100}%</td>
                  <td className="right">{split.publisher_bps / 100}%</td>
                  <td className="right">{split.platform_bps / 100}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Note>
            The ratio table is fixed for the life of the campaign — there is no
            contract function that changes it.{' '}
            <a
              href={explorerContract(config.escrowId)}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--green)', fontWeight: 700 }}
            >
              Inspect the contract
            </a>
          </Note>
        </>
      ) : null}
    </Panel>
  );
}
