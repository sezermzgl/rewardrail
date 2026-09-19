'use client';

/**
 * What the advertiser can verify without trusting anyone: the budget still
 * unreleased, the amount each action costs, and the ratio table that cannot
 * change while the campaign runs.
 */
import { getCampaignView } from '@/lib/chain/read';
import { explorerContract, config } from '@/lib/chain/config';
import { useLive } from '@/lib/demo/use-live';

import { Figure, Panel, Placeholder, Problem } from './panel';

export function AdvertiserPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive(() => getCampaignView(campaignId));

  return (
    <Panel title="Advertiser" role="campaign owner">
      {loading && !data ? <Placeholder>Reading the campaign…</Placeholder> : null}
      {error ? <Problem>Could not read the campaign: {error}</Problem> : null}

      {data ? (
        <>
          <Figure label="Status" value={data.open ? 'Open' : 'Closed'} />
          <Figure label="Per action" value={data.perAction} unit="TUSDC" />
          <Figure label="Budget remaining" value={data.remaining} unit="TUSDC" />
          <Figure
            label="Escrow holds"
            value={data.escrowTotalBalance}
            unit="TUSDC"
            hint="Across every campaign in this contract, not only this one. The contract keeps no per-campaign balance."
          />

          <div className="mt-1">
            <p className="mb-1 text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Ratio table — fixed for the campaign
            </p>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="text-left font-normal">Publisher</th>
                  <th className="text-right font-normal">Player</th>
                  <th className="text-right font-normal">Pub.</th>
                  <th className="text-right font-normal">Plat.</th>
                </tr>
              </thead>
              <tbody>
                {data.splits.map((split) => (
                  <tr key={split.publisher} className="numeric">
                    <td className="mono truncate pr-2 text-left">
                      {split.publisher.slice(0, 4)}…{split.publisher.slice(-4)}
                    </td>
                    <td className="text-right">{split.player_bps / 100}%</td>
                    <td className="text-right">{split.publisher_bps / 100}%</td>
                    <td className="text-right">{split.platform_bps / 100}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <a
            className="mt-1 text-[12px] underline underline-offset-2"
            style={{ color: 'var(--muted)' }}
            href={explorerContract(config.escrowId)}
            target="_blank"
            rel="noreferrer"
          >
            Inspect the escrow contract
          </a>
        </>
      ) : null}
    </Panel>
  );
}
