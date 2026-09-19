'use client';

/**
 * The platform's own view. Technical language is fine here: this actor already
 * sees the infrastructure, and the risk signals are the whole point of the
 * panel.
 *
 * The flag button is the panel's reason to exist (#16). Clawback is the
 * project's strongest claim and, until this existed, the only way to trigger
 * it was curl — which proves the mechanism to nobody watching a demo.
 */
import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Undo2 } from 'lucide-react';

import { explorerAccount } from '@/lib/chain/config';
import { flagFraud, type FraudResult } from '@/lib/demo/console-actions';
import { SEEDED_LABELS, sessionPlayers } from '@/lib/demo/session';
import { fetchPlayers, type ValidatorPlayer } from '@/lib/demo/validator';
import { useAction } from '@/lib/demo/use-action';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Action, Note, Panel, Problem, Proof, Stat } from './panel';

const DAY_MS = 24 * 60 * 60 * 1000;
const ageDays = (createdAt: number) => ((Date.now() - createdAt) / DAY_MS).toFixed(1);

/**
 * The walkthrough's accounts first, then everything else, newest first.
 *
 * Nothing is hidden — this is the platform's risk view and an operator who
 * cannot see an account cannot act on it. But the deployed service remembers
 * every account a scripted rehearsal ever opened, and hunting for the
 * fraudster among a dozen rows is not how this step should go with a judge
 * watching.
 */
function forWalkthroughFirst(
  players: ValidatorPlayer[],
  signedIn: string[],
): ValidatorPlayer[] {
  const relevant = (player: ValidatorPlayer) =>
    SEEDED_LABELS.includes(player.label) || signedIn.includes(player.publicKey);

  return [...players].sort((a, b) => {
    const byRelevance = Number(relevant(b)) - Number(relevant(a));
    return byRelevance !== 0 ? byRelevance : b.createdAt - a.createdAt;
  });
}

/**
 * What the reversal actually did, in the operator's own words.
 *
 * Both outcomes are worth reading. Reversing something proves the clawback
 * works; reversing nothing proves the window is a real boundary rather than a
 * setting the platform can ignore, which is the harder half of the claim.
 */
function outcomeOf(result: FraudResult): string {
  if (Number(result.clawedBack) > 0) {
    return `Reversed ${result.clawedBack} — pulled back from the player and returned to the campaign budget.`;
  }
  return (
    result.note ??
    'Nothing to reverse: the reward had already been converted, so the payout stands.'
  );
}

function PlayerRow({
  player,
  campaignId,
}: {
  player: ValidatorPlayer;
  campaignId: number;
}) {
  const [outcome, setOutcome] = useState<string | null>(null);

  const flag = useAction(
    useCallback(async () => {
      setOutcome(null);
      setOutcome(outcomeOf(await flagFraud(campaignId, player.publicKey)));
    }, [campaignId, player.publicKey]),
  );

  return (
    <>
      <tr>
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
        <td className="right">
          <Action
            label={player.flagged ? 'Flagged' : 'Flag'}
            variant="danger"
            onClick={flag.run}
            pending={flag.pending}
            disabled={player.flagged}
            title={
              player.flagged
                ? 'Already flagged. The clawback chain has run for this account.'
                : 'Flag as fraudulent: claws back the REWARD still held and refunds the campaign.'
            }
            icon={<Undo2 size={13} strokeWidth={2.4} />}
          />
        </td>
      </tr>

      {flag.error || outcome ? (
        <tr>
          <td colSpan={5}>
            {flag.error ? (
              <Problem>{flag.error}</Problem>
            ) : (
              <Note>{outcome}</Note>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function OperatorPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const proof = useLatestProof(['clawback', 'refund', 'flag']);
  const offline = error?.includes('not reachable');

  const [signedIn, setSignedIn] = useState<string[]>([]);
  useEffect(() => sessionPlayers.subscribe(setSignedIn), []);

  const flagged = data?.filter((p) => p.flagged).length ?? 0;
  const held = data?.filter((p) => !p.canConvert && !p.flagged).length ?? 0;
  const rows = data ? forWalkthroughFirst(data, signedIn) : [];

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
                <th className="right">Reversal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((player) => (
                <PlayerRow key={player.publicKey} player={player} campaignId={campaignId} />
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <Note>
        Trusted requires 7+ days and 5+ tasks together. Either alone is easy to
        game: a bot can wait, and a farm can grind tasks.
      </Note>
      <Note>
        Flagging runs the whole chain in one call: the REWARD still held is
        clawed back and the campaign budget is refunded by exactly that amount.
        A reward already converted is out of reach, which is what the window is
        for.
      </Note>
    </Panel>
  );
}
