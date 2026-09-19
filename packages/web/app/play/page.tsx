'use client';

/**
 * The player's app — the surface a real user would actually hold.
 *
 * Everything else in this repo is infrastructure or an operator console. This
 * is the one screen a person uses, so it is framed as a phone and it never
 * says wallet, seed, gas, transaction fee or blockchain. The player signs in,
 * picks a game, plays it, and money arrives. That the money arrived over
 * Stellar is true and invisible, which is the design claim the rest of the
 * project rests on: a rewarded-ads user is not a crypto user.
 *
 * The transaction links at the bottom are the one deliberate exception. They
 * are there for the judges, not the player, and they are labelled as such.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { GAMES } from '../../components/games/registry';
import type { Game } from '../../components/games/types';
import {
  cashout,
  completeAction,
  convert,
  signIn,
  type CompletedAction,
} from '../../lib/demo/actions';
import { playAccount, sessionPlayers } from '../../lib/demo/session';
import { fetchHealth, fetchPlayers, type ValidatorPlayer } from '../../lib/demo/validator';

type Screen = { kind: 'wall' } | { kind: 'playing'; game: Game } | { kind: 'earned'; game: Game };

export default function PlayPage() {
  /**
   * Who is signed in, read from the browser rather than held in component
   * state. The page is prerendered, so the server's answer is "nobody" and
   * the real one can only arrive on hydration — which is what this hook is
   * for, and why reading it in an effect was the wrong shape.
   */
  const account = useSyncExternalStore(
    playAccount.subscribe,
    playAccount.get,
    playAccount.getServer,
  );
  const [player, setPlayer] = useState<ValidatorPlayer | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'wall' });
  const [earned, setEarned] = useState<CompletedAction | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (publicKey: string) => {
    const players = await fetchPlayers();
    setPlayer(players.find((p) => p.publicKey === publicKey) ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Wrapped so the state updates land in a callback rather than
    // synchronously inside the effect body.
    void (async () => {
      try {
        const health = await fetchHealth();
        if (!cancelled) setCampaignId(health.demoCampaignId);
      } catch {
        if (!cancelled) {
          setError('The rewards service is not reachable. Try again in a moment.');
        }
      }
      if (account) await refresh(account.player).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [account, refresh]);

  // The clawback window ticks down in the UI so "come back in a moment" is a
  // visible countdown rather than a mystery.
  useEffect(() => {
    if (!account || !player?.windowRemainingSeconds) return;
    const t = setInterval(() => refresh(account.player).catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [account, player?.windowRemainingSeconds, refresh]);

  const onSignIn = useCallback(
    async (email: string) => {
      setBusy('Setting up your account…');
      setError(null);
      try {
        const outcome = await signIn(email);
        sessionPlayers.add(outcome.player);
        playAccount.set({ email: outcome.label, player: outcome.player });
        setNotice(
          outcome.returning
            ? `Welcome back, ${outcome.label}.`
            : 'Account ready. There was nothing to set up.',
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const onSignOut = useCallback(() => {
    playAccount.set(null);
    setPlayer(null);
    setEarned(null);
    setNotice(null);
    setError(null);
    setScreen({ kind: 'wall' });
  }, []);

  const onGameComplete = useCallback(
    async (game: Game) => {
      if (campaignId === null || !account) return;
      setBusy('Paying your reward…');
      setError(null);
      try {
        const result = await completeAction(campaignId, account.player);
        setEarned(result);
        setScreen({ kind: 'earned', game });
        await refresh(account.player);
      } catch (err) {
        setError((err as Error).message);
        setScreen({ kind: 'wall' });
      } finally {
        setBusy(null);
      }
    },
    [campaignId, account, refresh],
  );

  const onCashOut = async () => {
    if (campaignId === null || !account) return;
    setBusy('Moving your balance…');
    setError(null);
    setNotice(null);
    try {
      const done = await convert(campaignId, account.player);
      setNotice(`${done.amount} moved to your cash balance.`);
      await refresh(account.player);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Send the cash balance to a bank account.
   *
   * Two shapes come back, because there are two standards. SEP-24 returns the
   * payout provider's own page and the player finishes there. SEP-6 — which is
   * what the Turkish ramp speaks — has no page at all: it returns a reference
   * and the asset is delivered on the player's behalf. Assuming the page was
   * always there is how this used to open an empty tab in front of whoever
   * was watching.
   */
  const onWithdraw = async () => {
    if (!account || !player) return;
    setBusy('Opening your withdrawal…');
    setError(null);
    setNotice(null);
    try {
      const started = await cashout(account.player, Number(player.tusdcBalance));
      if (started.interactiveUrl) {
        window.open(started.interactiveUrl, '_blank', 'noopener');
        setNotice('Your bank details go to the payout provider, not to us.');
      } else {
        setNotice(
          `Withdrawal ${started.anchorTransactionId} is with the payout provider. ` +
            'They pay out in lira; your bank details never reach us.',
        );
      }
      await refresh(account.player).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const points = player ? Number(player.rewardBalance) : 0;
  const cash = player ? Number(player.tusdcBalance) : 0;
  const frozen = Boolean(player && !player.canConvert && points > 0);

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--canvas)' }}>
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-[2.25rem] border-8 shadow-xl"
        style={{ borderColor: 'var(--ink)', background: 'var(--surface)', minHeight: 720 }}
      >
        <Header points={points} cash={cash} email={account?.email} onSignOut={onSignOut} />

        <div className="flex flex-1 flex-col gap-4 p-4">
          {error && <Banner tone="bad">{error}</Banner>}
          {notice && <Banner tone="good">{notice}</Banner>}
          {busy && <Banner tone="info">{busy}</Banner>}

          {!account ? (
            <SignIn onSubmit={onSignIn} disabled={Boolean(busy)} />
          ) : (
            <>
              {frozen && (
                <Banner tone="info">
                  {player?.windowRemainingSeconds
                    ? `Your reward clears in ${player.windowRemainingSeconds}s. `
                    : 'Your reward is still clearing. '}
                  This is how we take back rewards earned by cheating — without it, we
                  could not pay out instantly.
                </Banner>
              )}

              {screen.kind === 'wall' && (
                <Offerwall onPick={(game) => setScreen({ kind: 'playing', game })} />
              )}

              {screen.kind === 'playing' && (
                <Playing
                  game={screen.game}
                  onDone={() => onGameComplete(screen.game)}
                  onBack={() => setScreen({ kind: 'wall' })}
                />
              )}

              {screen.kind === 'earned' && earned && (
                <Earned
                  game={screen.game}
                  earned={earned}
                  onBack={() => {
                    setEarned(null);
                    setScreen({ kind: 'wall' });
                  }}
                />
              )}
            </>
          )}
        </div>

        {account ? (
          <Footer
            canCashOut={Boolean(player?.canConvert) && points > 0}
            hasCash={cash > 0}
            onCashOut={onCashOut}
            onWithdraw={onWithdraw}
            disabled={Boolean(busy)}
          />
        ) : null}
      </div>
    </main>
  );
}

function Header({
  points,
  cash,
  email,
  onSignOut,
}: {
  points: number;
  cash: number;
  email?: string;
  onSignOut: () => void;
}) {
  return (
    <header className="px-5 pb-4 pt-6" style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest opacity-60">Your rewards</p>
        {email ? (
          <button
            type="button"
            onClick={onSignOut}
            className="truncate text-[11px] underline opacity-60"
            title={`Signed in as ${email}. Tap to switch account.`}
          >
            {email}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-4xl font-semibold tabular-nums">{points.toFixed(2)}</p>
      <p className="mt-1 text-xs opacity-70">
        {cash > 0 ? `$${cash.toFixed(2)} ready to withdraw` : 'Play a game to start earning'}
      </p>
    </header>
  );
}

/**
 * The whole sign-up flow.
 *
 * An email address and nothing else — no password, no setup step, no funding.
 * The account behind it is opened on the spot and the player is never asked
 * for anything they would have to keep safe.
 */
function SignIn({
  onSubmit,
  disabled,
}: {
  onSubmit: (email: string) => void;
  disabled: boolean;
}) {
  const [email, setEmail] = useState('');

  return (
    <form
      className="flex flex-1 flex-col justify-center gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (email.trim()) onSubmit(email.trim());
      }}
    >
      <div>
        <h1 className="text-xl font-bold">Start earning</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Play a game, get paid. Enter your email — there is nothing else to set up.
        </p>
      </div>

      <input
        type="email"
        required
        value={email}
        placeholder="you@example.com"
        aria-label="Email address"
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-2xl border px-4 py-3 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
      />

      <button
        type="submit"
        disabled={disabled || email.trim().length === 0}
        className="w-full rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-40"
        style={{ background: 'var(--ink)', color: 'var(--surface)' }}
      >
        Continue
      </button>

      <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
        No password, no setup, no minimum to cash out.
      </p>
    </form>
  );
}

function Offerwall({ onPick }: { onPick: (game: Game) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-bold">Earn today</h1>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {GAMES.length} games
        </span>
      </div>

      {GAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => onPick(game)}
          className="flex items-center gap-3 rounded-2xl p-2.5 text-left transition-transform active:scale-[0.98]"
          style={{ background: 'var(--panel)', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}
        >
          {/* Cover art. A gradient per game is what stops the wall reading
              as a settings menu with emoji in it. */}
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl"
            style={{ background: game.cover, boxShadow: 'inset 0 -6px 12px rgba(0,0,0,.18)' }}
          >
            {game.art}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{game.title}</span>
            <span className="block truncate text-[11px]" style={{ color: 'var(--muted)' }}>
              {game.studio} · {game.genre}
            </span>
            <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--muted)' }}>
              {game.goal}
            </span>
          </span>

          <span className="flex shrink-0 flex-col items-end gap-1">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: 'var(--rail)', color: 'var(--ink)' }}
            >
              Play
            </span>
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
              ~{game.seconds}s
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Playing({ game, onDone, onBack }: { game: Game; onDone: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{game.title}</h1>
          <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
            {game.studio}
          </p>
        </div>
        <button type="button" onClick={onBack} className="text-xs underline" style={{ color: 'var(--muted)' }}>
          Back
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {game.goal}
      </p>
      <game.Play onComplete={onDone} />
    </div>
  );
}

function Earned({ game, earned, onBack }: { game: Game; earned: CompletedAction; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="text-5xl">{game.art}</span>
      <div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {game.title} complete
        </p>
        <p className="text-3xl font-semibold tabular-nums">+{Number(earned.amount).toFixed(2)}</p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="rounded-full px-5 py-2 text-sm font-semibold"
        style={{ background: 'var(--lime)', color: 'var(--ink)' }}
      >
        Play another
      </button>

      {/* For the judges, not the player. */}
      <div className="w-full border-t pt-3 text-left text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <p className="mb-1 uppercase tracking-wide">Verifiable on chain</p>
        <a className="block truncate underline" href={earned.settleTx.url} target="_blank" rel="noopener noreferrer">
          settle · {earned.settleTx.hash.slice(0, 16)}…
        </a>
        <a className="block truncate underline" href={earned.rewardTx.url} target="_blank" rel="noopener noreferrer">
          reward paid · {earned.rewardTx.hash.slice(0, 16)}…
        </a>
      </div>
    </div>
  );
}

function Footer({
  canCashOut,
  hasCash,
  onCashOut,
  onWithdraw,
  disabled,
}: {
  canCashOut: boolean;
  hasCash: boolean;
  onCashOut: () => void;
  onWithdraw: () => void;
  disabled: boolean;
}) {
  return (
    <footer className="flex gap-2 border-t p-4" style={{ borderColor: 'var(--border)' }}>
      <button
        type="button"
        onClick={onCashOut}
        disabled={!canCashOut || disabled}
        className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ background: 'var(--ink)', color: 'var(--surface)' }}
      >
        Move to cash
      </button>
      <button
        type="button"
        onClick={onWithdraw}
        disabled={!hasCash || disabled}
        className="flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
        style={{ borderColor: 'var(--ink)' }}
      >
        Withdraw
      </button>
    </footer>
  );
}

function Banner({ tone, children }: { tone: 'good' | 'bad' | 'info'; children: React.ReactNode }) {
  const background = tone === 'bad' ? '#fdecea' : tone === 'good' ? '#eaf7f0' : 'var(--canvas)';
  const color = tone === 'bad' ? 'var(--warn)' : 'var(--ink)';
  return (
    <p className="rounded-lg px-3 py-2 text-xs" style={{ background, color }}>
      {children}
    </p>
  );
}
