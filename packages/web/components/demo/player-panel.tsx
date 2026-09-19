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
import { useCallback, useEffect, useState } from 'react';
import { Banknote, LogIn, Sparkles, UserRound } from 'lucide-react';

import { cashout, completeAction, convert, signIn } from '@/lib/demo/actions';
import { demoPlayers, sessionPlayers } from '@/lib/demo/session';
import { fetchPlayers, type ValidatorPlayer } from '@/lib/demo/validator';
import { useAction } from '@/lib/demo/use-action';
import { useLatestProof } from '@/lib/demo/use-proof';
import { useLive } from '@/lib/demo/use-live';

import { Action, Note, Panel, Problem, Proof, Stat } from './panel';

function status(player: ValidatorPlayer): { text: string; tone: string } {
  if (player.flagged) return { text: 'On hold', tone: 'held' };
  if (player.canConvert) return { text: 'Ready to cash out', tone: 'ready' };
  const left = player.windowRemainingSeconds;
  if (left && left > 0) return { text: `Ready in ${left}s`, tone: 'waiting' };
  // No countdown but the ledger still has the reward frozen — the service
  // restarted and lost the clock, while the trustline did not.
  if (player.rewardFrozen) return { text: 'Held by the ledger', tone: 'waiting' };
  return { text: 'On hold', tone: 'waiting' };
}

function PlayerCard({ player, campaignId }: { player: ValidatorPlayer; campaignId: number }) {
  const [paidOut, setPaidOut] = useState<string | null>(null);

  const earn = useAction(
    useCallback(() => completeAction(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );
  const cashOut = useAction(
    useCallback(() => convert(campaignId, player.publicKey), [campaignId, player.publicKey]),
  );

  /**
   * The last mile: the balance leaves for a bank account.
   *
   * This is the 3:00 step of the demo script, and until now the console had
   * no button for it — the anchor could only be reached from the player app.
   * The Turkish ramp is SEP-6, which has no hosted page, so what comes back
   * is a transaction id and the payment that delivered the asset.
   */
  const withdraw = useAction(
    useCallback(async () => {
      setPaidOut(null);
      const started = await cashout(player.publicKey, Number(player.tusdcBalance));
      setPaidOut(
        started.interactiveUrl
          ? 'The payout provider took over: bank details are given to them, never to us.'
          : `Withdrawal ${started.anchorTransactionId} opened at the payout provider. Bank details never reach us.`,
      );
      if (started.interactiveUrl) {
        window.open(started.interactiveUrl, '_blank', 'noopener');
      }
    }, [player.publicKey, player.tusdcBalance]),
  );

  const state = status(player);
  const nothingToCashOut = Number(player.rewardBalance) <= 0;
  const nothingToWithdraw = Number(player.tusdcBalance) <= 0;

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
        <Action
          label="Send to bank"
          variant="quiet"
          onClick={withdraw.run}
          pending={withdraw.pending}
          disabled={nothingToWithdraw}
          title={
            nothingToWithdraw
              ? 'Cash out a reward first.'
              : 'Open a withdrawal with the payout provider, paid out in Turkish lira.'
          }
          icon={<Banknote size={14} strokeWidth={2.4} />}
        />
      </div>

      <Note>
        {player.tasks} {player.tasks === 1 ? 'task' : 'tasks'} completed
      </Note>

      {earn.error ? <Problem>{earn.error}</Problem> : null}
      {cashOut.error ? <Problem>{cashOut.error}</Problem> : null}
      {withdraw.error ? <Problem>{withdraw.error}</Problem> : null}
      {paidOut && !withdraw.error ? <Note>{paidOut}</Note> : null}
    </div>
  );
}

/**
 * Signing in.
 *
 * An email and nothing else. This is the panel's strongest single claim: the
 * account behind it is opened on chain, holds nothing the person has to look
 * after, and they were asked for nothing they would have to keep safe.
 *
 * The account is remembered for this browser so the console can show it
 * alongside the two the walkthrough follows, instead of losing it among every
 * account the service has ever seen.
 */
function SignInForm() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const submit = useAction(
    useCallback(async () => {
      const outcome = await signIn(email);
      sessionPlayers.add(outcome.player);
      setResult(
        outcome.returning
          ? `Welcome back, ${outcome.label}.`
          : `Account ready for ${outcome.label}. Nothing to set up.`,
      );
      setEmail('');
    }, [email]),
  );

  return (
    <form
      className="dsignin"
      onSubmit={(event) => {
        event.preventDefault();
        submit.run();
      }}
    >
      <input
        type="email"
        required
        value={email}
        placeholder="you@example.com"
        aria-label="Email address"
        onChange={(event) => setEmail(event.target.value)}
      />
      <Action
        label="Sign in"
        onClick={submit.run}
        pending={submit.pending}
        disabled={email.trim().length === 0}
        icon={<LogIn size={14} strokeWidth={2.4} />}
      />
      {submit.error ? <Problem>{submit.error}</Problem> : null}
      {result && !submit.error ? <p className="dsignin__ok">{result}</p> : null}
    </form>
  );
}

export function PlayerPanel({ campaignId }: { campaignId: number }) {
  const { data, error, loading } = useLive<ValidatorPlayer[]>(fetchPlayers, { pollMs: 3000 });
  const proof = useLatestProof(['reward', 'convert']);
  const offline = error?.includes('not reachable');

  const [signedIn, setSignedIn] = useState<string[]>([]);
  useEffect(() => sessionPlayers.subscribe(setSignedIn), []);
  const [showAll, setShowAll] = useState(false);

  const { shown, hidden } = demoPlayers(data ?? [], signedIn);
  const visible = showAll ? (data ?? []) : shown;

  return (
    <Panel
      title="Player"
      role={`${visible.length} ${visible.length === 1 ? 'account' : 'accounts'}`}
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
      <SignInForm />

      {loading && !data ? <Note>Loading accounts…</Note> : null}
      {offline ? (
        <Note>
          Accounts appear once the platform service is running. The advertiser and
          publisher panels read the chain directly and stay live without it.
        </Note>
      ) : error ? (
        <Problem>{error}</Problem>
      ) : null}

      {visible.map((player) => (
        <PlayerCard key={player.publicKey} player={player} campaignId={campaignId} />
      ))}

      {data && data.length > 0 && visible.length === 0 ? (
        <Note>No accounts from this walkthrough yet. Sign in above.</Note>
      ) : null}
      {data?.length === 0 ? <Note>No accounts yet.</Note> : null}

      {/* Hidden rather than dropped: rehearsals leave accounts behind, and a
          panel that silently omits them would be a strange thing to put next
          to an audit trail. */}
      {hidden > 0 ? (
        <button type="button" className="dmore" onClick={() => setShowAll((v) => !v)}>
          {showAll
            ? 'Show only this walkthrough'
            : `Show ${hidden} more ${hidden === 1 ? 'account' : 'accounts'} from earlier runs`}
        </button>
      ) : null}

      <Note>No payout threshold. Rewards arrive in seconds.</Note>
    </Panel>
  );
}
