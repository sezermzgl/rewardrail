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
import { useCallback, useState } from 'react';
import { LogIn, Sparkles, UserRound } from 'lucide-react';

import { completeAction, convert, signIn } from '@/lib/demo/actions';
import { fetchPlayers, type ValidatorPlayer } from '@/lib/demo/validator';
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
    useCallback(() => convert(campaignId, player.publicKey), [campaignId, player.publicKey]),
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

/**
 * Signing in.
 *
 * An email and nothing else. This is the panel's strongest single claim: the
 * account behind it is opened on chain, holds no XLM, and the person who
 * signed in was asked for nothing they would have to keep safe.
 */
function SignInForm() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const submit = useAction(
    useCallback(async () => {
      const outcome = await signIn(email);
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

  return (
    <Panel
      title="Player"
      role={`${data?.length ?? 0} ${data?.length === 1 ? 'account' : 'accounts'}`}
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

      {data?.map((player) => (
        <PlayerCard key={player.publicKey} player={player} campaignId={campaignId} />
      ))}

      {data?.length === 0 ? <Note>No accounts yet.</Note> : null}

      <Note>No payout threshold. Rewards arrive in seconds.</Note>
    </Panel>
  );
}
