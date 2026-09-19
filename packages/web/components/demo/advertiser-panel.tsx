'use client';

/**
 * What the advertiser can verify without trusting anyone: the budget still
 * unreleased, the amount each action costs, and the ratio table that cannot
 * change while the campaign runs.
 *
 * And what they can do about it (#14). Opening locks a budget in escrow;
 * closing takes back whatever no action released. Both are the advertiser's
 * own calls, and both end in a hash — which is the difference between a
 * custody claim and a promise.
 */
import { useCallback, useState } from 'react';
import { Megaphone, PlusCircle, Undo2 } from 'lucide-react';

import { config, explorerContract } from '@/lib/chain/config';
import { getCampaignView } from '@/lib/chain/read';
import { closeCampaign, openCampaign } from '@/lib/demo/console-actions';
import { useAction } from '@/lib/demo/use-action';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Action, Note, Panel, Problem, Proof, Stat } from './panel';

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

/**
 * Opening a campaign.
 *
 * Two numbers, both in whole units. The publisher and the split table are the
 * demo's own defaults on purpose: a form that asks for basis points before it
 * will do anything is a form nobody fills in with a judge watching, and the
 * ratio table below already shows what those defaults are.
 */
function OpenForm({ onOpened }: { onOpened: (campaignId: number) => void }) {
  const [budget, setBudget] = useState('5');
  const [perAction, setPerAction] = useState('1');

  const open = useAction(
    useCallback(async () => {
      const result = await openCampaign(Number(budget), Number(perAction));
      onOpened(result.campaignId);
    }, [budget, perAction, onOpened]),
  );

  const invalid =
    !(Number(budget) > 0) ||
    !(Number(perAction) > 0) ||
    Number(perAction) > Number(budget);

  return (
    <form
      className="dsignin"
      onSubmit={(event) => {
        event.preventDefault();
        open.run();
      }}
    >
      <input
        type="number"
        min="1"
        step="1"
        value={budget}
        aria-label={`Budget in ${config.payoutAssetCode}`}
        onChange={(event) => setBudget(event.target.value)}
      />
      <input
        type="number"
        min="0.1"
        step="0.1"
        value={perAction}
        aria-label={`Per action in ${config.payoutAssetCode}`}
        onChange={(event) => setPerAction(event.target.value)}
      />
      <Action
        label="Open campaign"
        onClick={open.run}
        pending={open.pending}
        disabled={invalid}
        title={
          invalid
            ? 'A budget has to cover at least one action.'
            : `Lock ${budget} ${config.payoutAssetCode} in escrow at ${perAction} per action.`
        }
        icon={<PlusCircle size={14} strokeWidth={2.4} />}
      />
      {open.error ? <Problem>{open.error}</Problem> : null}
    </form>
  );
}

export function AdvertiserPanel({
  campaignId,
  onCampaignOpened,
}: {
  campaignId: number;
  onCampaignOpened: (campaignId: number) => void;
}) {
  const { data, error, loading } = useLive(() => getCampaignView(campaignId), {
    key: campaignId,
  });
  const proof = useLatestProof(['campaign', 'close', 'settle']);
  const [refunded, setRefunded] = useState<string | null>(null);

  const close = useAction(
    useCallback(async () => {
      setRefunded(null);
      const result = await closeCampaign(campaignId);
      setRefunded(result.refunded);
    }, [campaignId]),
  );

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
              unit={config.payoutAssetCode}
              tone="positive"
            />
            <Stat label="Per action" value={data.perAction} unit={config.payoutAssetCode} />
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
              unit={config.payoutAssetCode}
              tone="quiet"
              title={`Across every campaign in this contract. The contract keeps no per-campaign balance, so this is not campaign ${campaignId} alone.`}
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

          <div className="dactions">
            <Action
              label="Close campaign"
              variant="danger"
              onClick={close.run}
              pending={close.pending}
              disabled={!data.open}
              title={
                data.open
                  ? 'Close the campaign and refund whatever no action released.'
                  : 'Already closed.'
              }
              icon={<Undo2 size={14} strokeWidth={2.4} />}
            />
          </div>

          {close.error ? <Problem>{close.error}</Problem> : null}
          {refunded && !close.error ? (
            <Note>
              Closed. {refunded} {config.payoutAssetCode} went back to the
              advertiser — the contract returned it, nobody approved it.
            </Note>
          ) : null}
        </>
      ) : null}

      <OpenForm onOpened={onCampaignOpened} />

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
    </Panel>
  );
}
