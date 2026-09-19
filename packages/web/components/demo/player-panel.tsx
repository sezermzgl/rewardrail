'use client';

/**
 * The panel that carries the demo: two players, one honest and one not.
 *
 * Language constraint (#15, and the spec's "Consistency in language"): the
 * words wallet, seed, private key, gas, transaction fee and blockchain do not
 * appear here. This must read like a rewards app, because that is the visual
 * proof of the design claim — the player never learns any of this exists.
 */
import { fetchPlayers, ValidatorOffline, type ValidatorPlayer } from '@/lib/demo/validator';
import { useLive } from '@/lib/demo/use-live';

import { Figure, Panel, Placeholder, Problem } from './panel';

function TierBadge({ player }: { player: ValidatorPlayer }) {
  const label =
    player.tier === 'trusted'
      ? 'Can cash out now'
      : player.tier === 'suspicious'
        ? 'On hold'
        : player.windowRemainingSeconds && player.windowRemainingSeconds > 0
          ? `Available in ${player.windowRemainingSeconds}s`
          : 'Can cash out now';

  const tone = player.tier === 'suspicious' ? 'var(--warn)' : 'var(--accent)';

  return (
    <span className="text-[12px] font-medium" style={{ color: tone }}>
      {label}
    </span>
  );
}

export function PlayerPanel() {
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
        <div
          key={player.publicKey}
          className="flex flex-col gap-1 rounded-md border p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{player.label}</span>
            <TierBadge player={player} />
          </div>
          <Figure label="Rewards earned" value={player.rewardBalance} unit="pts" />
          <Figure label="Cashed out" value={player.tusdcBalance} unit="USD" />
          <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {player.tasks} {player.tasks === 1 ? 'task' : 'tasks'} completed
          </p>
        </div>
      ))}

      {data?.length === 0 ? <Placeholder>No accounts yet.</Placeholder> : null}

      <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        No payout threshold. Rewards arrive in seconds.
      </p>
    </Panel>
  );
}
