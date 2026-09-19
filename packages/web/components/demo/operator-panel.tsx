'use client';

/**
 * The platform's own view. Technical language is fine here: this actor already
 * sees the infrastructure, and the risk signals are the whole point of the
 * panel.
 */
import { ShieldAlert } from 'lucide-react';

import { explorerAccount } from '@/lib/chain/config';
import { fetchPlayers, type ValidatorPlayer } from '@/lib/demo/validator';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Note, Panel, Problem, Proof, Stat } from './panel';

const DAY_MS = 24 * 60 * 60 * 1000;
const ageDays = (createdAt: number) => ((Date.now() - createdAt) / DAY_MS).toFixed(1);

export function OperatorPanel() {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const proof = useLatestProof(['clawback', 'refund', 'flag']);
  const offline = error?.includes('not reachable');

  const flagged = data?.filter((p) => p.flagged).length ?? 0;
  const held = data?.filter((p) => !p.canConvert && !p.flagged).length ?? 0;

  return (
    <Panel
      title="Operator"
      role="platform"
      icon={<ShieldAlert size={16} strokeWidth={2.2} />}
      proof={
        <Proof
          label="Last reversal"
          hash={proof?.short}
          url={proof?.url}
          fallback="nothing reversed"
        />
      }
    >
      {loading && !data ? <Note>Reading risk signals…</Note> : null}
      {offline ? (
        <Note>Validator offline — tier and fraud signals are held there, not on chain.</Note>
      ) : error ? (
        <Problem>{error}</Problem>
      ) : null}

      {data && data.length > 0 ? (
        <>
          <div className="dstats dstats--three">
            <Stat label="Accounts" value={String(data.length)} />
            <Stat
              label="In window"
              value={String(held)}
              tone={held > 0 ? undefined : 'quiet'}
            />
            <Stat
              label="Flagged"
              value={String(flagged)}
              tone={flagged > 0 ? 'warning' : 'quiet'}
            />
          </div>

          <table className="dtable">
            <thead>
              <tr>
                <th>Account</th>
                <th className="right">Age</th>
                <th className="right">Tasks</th>
                <th className="right">Tier</th>
              </tr>
            </thead>
            <tbody>
              {data.map((player) => (
                <tr key={player.publicKey}>
                  <td>
                    <a
                      href={explorerAccount(player.publicKey)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--ink)', fontWeight: 700 }}
                    >
                      {player.label}
                    </a>
                  </td>
                  <td className="right numeric">{ageDays(player.createdAt)}d</td>
                  <td className="right numeric">{player.tasks}</td>
                  <td
                    className="right"
                    style={{ color: player.flagged ? 'var(--coral)' : 'var(--muted)', fontWeight: 700 }}
                  >
                    {player.flagged ? 'flagged' : player.tier}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <Note>
        Trusted requires 7+ days and 5+ tasks together. Either alone is easy to
        game: a bot can wait, and a farm can grind tasks.
      </Note>
    </Panel>
  );
}
