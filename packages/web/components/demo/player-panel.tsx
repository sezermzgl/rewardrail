'use client';

/**
 * The panel that carries the demo: two players, one honest and one not.
 *
 * Language constraint (the spec's "Consistency in language"): the words
 * wallet, seed, private key, gas, transaction fee and blockchain do not appear
 * here. This must read like a rewards app, because that is the visual proof of
 * the design claim — the player never learns any of this exists. A test holds
 * the line; see player-panel.test.ts.
 */
import { useCallback } from 'react';
import { Sparkles, UserRound } from 'lucide-react';

import {
  completeAction,
  convertReward,
  fetchPlayers,
  type ValidatorPlayer,
} from '@/lib/demo/validator';
import { useAction } from '@/lib/demo/use-action';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Action, Note, Panel, Problem, Proof, Stat } from './panel';

function status(player: ValidatorPlayer): { text: string; tone: string } {
  if (player.flagged) return { text: 'On hold', tone: 'held' };
  if (player.canConvert) return { text: 'Ready to cash out', tone: 'ready' };
  const left = player.windowRemainingSeconds;
  return { text: left && left > 0 ? `Ready in ${left}s` : 'On hold', tone: 'waiting' };
}

function PlayerCard({ player, campaignId }: { player: ValidatorPlayer; campaignId: number }) {
  const earn = useAction(
    useCallback(() => completeAction(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );
  const cashOut = useAction(
    useCallback(() => convertReward(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );

  const state = status(player);
  const nothingToCashOut = Number(player.rewardBalance) <= 0;

  return (
    <div className="dcard" data-flagged={player.flagged}>
      <div className="dcard__top">
        <UserRound size={16} strokeWidth={2.2} style={{ color: 'var(--muted)' }} />
        <span className="dcard__name">{player.label}</span>
        <span className="dpill" data-tone={state.tone}>
          {state.text}
        </span>
      </div>

      <div className="dstats">
        <Stat
          label="Rewards earned"
          value={player.rewardBalance}
          unit="pts"
          tone={Number(player.rewardBalance) > 0 ? 'positive' : 'quiet'}
        />
        <Stat label="Cashed out" value={player.tusdcBalance} unit="USD" />
      </div>

      <div className="dactions">
        <Action
          label="Complete a task"
          onClick={earn.run}
          pending={earn.pending}
          icon={<Sparkles size={14} strokeWidth={2.4} />}
        />
        <Action
          label="Cash out"
          variant="quiet"
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

      <Note>
        {player.tasks} {player.tasks === 1 ? 'task' : 'tasks'} completed
      </Note>

      {earn.error ? <Problem>{earn.error}</Problem> : null}
      {cashOut.error ? <Problem>{cashOut.error}</Problem> : null}
    </div>
  );
}

export function PlayerPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const proof = useLatestProof(['reward', 'convert']);
  const offline = error?.includes('not reachable');

  return (
    <Panel
      title="Player"
      role="two accounts"
      icon={<UserRound size={16} strokeWidth={2.2} />}
      proof={
        <Proof
          label="Last payout"
          hash={proof?.short}
          url={proof?.url}
          fallback="no rewards yet"
        />
      }
    >
      {loading && !data ? <Note>Loading accounts…</Note> : null}
      {offline ? (
        <Note>
          Accounts appear once the platform service is running. The advertiser and
          publisher panels read the chain directly and stay live without it.
        </Note>
      ) : error ? (
        <Problem>{error}</Problem>
      ) : null}

      {data?.map((player) => (
        <PlayerCard key={player.publicKey} player={player} campaignId={campaignId} />
      ))}

      {data?.length === 0 ? <Note>No accounts yet.</Note> : null}

      <Note>No payout threshold. Rewards arrive in seconds.</Note>
    </Panel>
  );
}
