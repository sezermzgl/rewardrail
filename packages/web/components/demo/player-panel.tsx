'use client';

/**
 * The panel that carries the demo: two players, one honest and one not.
 *
 * Language constraint (the spec's "Consistency in language"): the words
 * wallet, seed, private key, gas, transaction fee and blockchain do not appear
 * here. This must read like a rewards app, because that is the visual proof of
 * the design claim — the player never learns any of this exists.
 */
import { useCallback } from 'react';

import {
  completeAction,
  convertReward,
  fetchPlayers,
  type ValidatorPlayer,
} from '@/lib/demo/validator';
import { useAction } from '@/lib/demo/use-action';
import { useLive } from '@/lib/demo/use-live';

import { Action, Figure, Panel, Placeholder, Problem } from './panel';

function statusLine(player: ValidatorPlayer): { text: string; tone: string } {
  if (player.flagged) return { text: 'On hold', tone: 'var(--warn)' };
  if (player.canConvert) return { text: 'Can cash out now', tone: 'var(--accent)' };
  const seconds = player.windowRemainingSeconds;
  return {
    text: seconds && seconds > 0 ? `Available in ${seconds}s` : 'On hold',
    tone: 'var(--muted)',
  };
}

function PlayerCard({
  player,
  campaignId,
}: {
  player: ValidatorPlayer;
  campaignId: number;
}) {
  const earn = useAction(
    useCallback(() => completeAction(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );
  const cashOut = useAction(
    useCallback(() => convertReward(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );

  const status = statusLine(player);
  const nothingToCashOut = Number(player.rewardBalance) <= 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border p-3"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{player.label}</span>
        <span className="text-[12px] font-medium" style={{ color: status.tone }}>
          {status.text}
        </span>
      </div>

      <Figure label="Rewards earned" value={player.rewardBalance} unit="pts" />
      <Figure label="Cashed out" value={player.tusdcBalance} unit="USD" />
      <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
        {player.tasks} {player.tasks === 1 ? 'task' : 'tasks'} completed
      </p>

      <div className="mt-1 flex flex-wrap gap-2">
        <Action label="Complete a task" onClick={earn.run} pending={earn.pending} />
        <Action
          label="Cash out"
          onClick={cashOut.run}
          pending={cashOut.pending}
          disabled={!player.canConvert || nothingToCashOut}
          title={
            nothingToCashOut
              ? 'Nothing to cash out yet'
              : player.canConvert
                ? undefined
                : player.reason
          }
        />
      </div>

      {earn.error ? <Problem>{earn.error}</Problem> : null}
      {cashOut.error ? <Problem>{cashOut.error}</Problem> : null}
    </div>
  );
}

export function PlayerPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const offline = error?.includes('not reachable');

  return (
    <Panel title="Player" role="two accounts">
      {loading && !data ? <Placeholder>Loading accounts…</Placeholder> : null}
      {offline ? (
        <Placeholder>
          Accounts appear once the platform service is running. The advertiser and
          publisher panels read the chain directly and stay live without it.
        </Placeholder>
      ) : error ? (
        <Problem>{error}</Problem>
      ) : null}

      {data?.map((player) => (
        <PlayerCard key={player.publicKey} player={player} campaignId={campaignId} />
      ))}

      {data?.length === 0 ? <Placeholder>No accounts yet.</Placeholder> : null}

      <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        No payout threshold. Rewards arrive in seconds.
      </p>
    </Panel>
  );
}
