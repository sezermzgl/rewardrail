'use client';

/**
 * The platform's own view. Technical language is fine here: this actor already
 * sees the infrastructure, and the risk signals are the whole point of the
 * panel.
 */
import { fetchPlayers, type ValidatorPlayer } from '@/lib/demo/validator';
import { explorerAccount } from '@/lib/chain/config';
import { useLive } from '@/lib/demo/use-live';

import { Panel, Placeholder, Problem } from './panel';

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(createdAt: number): string {
  return ((Date.now() - createdAt) / DAY_MS).toFixed(1);
}

export function OperatorPanel() {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const offline = error?.includes('not reachable');

  return (
    <Panel title="Operator" role="platform">
      {loading && !data ? <Placeholder>Reading risk signals…</Placeholder> : null}
      {offline ? (
        <Placeholder>Validator offline — tier and fraud signals are held there, not on chain.</Placeholder>
      ) : error ? (
        <Problem>{error}</Problem>
      ) : null}

      {data && data.length > 0 ? (
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ color: 'var(--muted)' }}>
              <th className="text-left font-normal">Account</th>
              <th className="text-right font-normal">Age</th>
              <th className="text-right font-normal">Tasks</th>
              <th className="text-right font-normal">Tier</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player) => (
              <tr key={player.publicKey}>
                <td className="truncate pr-2">
                  <a
                    className="underline underline-offset-2"
                    href={explorerAccount(player.publicKey)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {player.label}
                  </a>
                </td>
                <td className="numeric text-right">{ageDays(player.createdAt)}d</td>
                <td className="numeric text-right">{player.tasks}</td>
                <td
                  className="text-right"
                  style={{ color: player.flagged ? 'var(--warn)' : 'var(--muted)' }}
                >
                  {player.flagged ? 'flagged' : player.tier}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>
        Trusted requires 7+ days and 5+ tasks together. Either alone is easy to game.
      </p>
    </Panel>
  );
}
