'use client';

/**
 * The player's app — the surface a real user would actually hold.
 *
 * Everything else in this repo is infrastructure or an operator console. This
 * is the one screen a person uses, so it is framed as a phone and it never
 * says wallet, seed, gas, transaction fee or blockchain. The player picks a
 * game, plays it, and money arrives. That the money arrived over Stellar is
 * true and invisible, which is the design claim the rest of the project rests
 * on: a rewarded-ads user is not a crypto user.
 *
 * The transaction links at the bottom are the one deliberate exception. They
 * are there for the judges, not the player, and they are labelled as such.
 */
import { useCallback, useEffect, useState } from 'react';

import { GAMES } from '../../components/games/registry';
import type { Game } from '../../components/games/types';
import { cashout, completeAction, convert, type CompletedAction } from '../../lib/demo/actions';
import { fetchHealth, fetchPlayers, type ValidatorPlayer } from '../../lib/demo/validator';

type Screen = { kind: 'wall' } | { kind: 'playing'; game: Game } | { kind: 'earned'; game: Game };

export default function PlayPage() {
  const [player, setPlayer] = useState<ValidatorPlayer | null>(null);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'wall' });
  const [earned, setEarned] = useState<CompletedAction | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const players = await fetchPlayers();
    // The honest account is the one a walkthrough follows; the fraudulent one
    // exists for the operator panel to flag.
    setPlayer(players.find((p) => p.label === 'honest') ?? players[0] ?? null);
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
          setError('The validator is not running. Start it in packages/validator.');
        }
      }
      await refresh().catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // The clawback window ticks down in the UI so "come back in a moment" is a
  // visible countdown rather than a mystery.
  useEffect(() => {
    if (!player?.windowRemainingSeconds) return;
    const t = setInterval(() => refresh().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [player?.windowRemainingSeconds, refresh]);

  const onGameComplete = useCallback(
    async (game: Game) => {
      if (campaignId === null || !player) return;
      setBusy('Paying your reward…');
      setError(null);
      try {
        const result = await completeAction(campaignId, player.publicKey);
        setEarned(result);
        setScreen({ kind: 'earned', game });
        await refresh();
      } catch (err) {
        setError((err as Error).message);
        setScreen({ kind: 'wall' });
      } finally {
        setBusy(null);
      }
    },
    [campaignId, player, refresh],
  );

  const onCashOut = async () => {
    if (campaignId === null || !player) return;
    setBusy('Moving your balance…');
    setError(null);
    setNotice(null);
    try {
      const done = await convert(campaignId, player.publicKey);
      setNotice(`${done.amount} moved to your cash balance.`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onWithdraw = async () => {
    if (!player) return;
    setBusy('Opening your withdrawal…');
    setError(null);
    setNotice(null);
    try {
      // The anchor sets its own bounds; this demo anchor takes 1–10.
      const started = await cashout(player.publicKey, 1.2);
      window.open(started.interactiveUrl, '_blank', 'noopener');
      setNotice('Your bank details go to the payout provider, not to us.');
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
        <Header points={points} cash={cash} />

        <div className="flex flex-1 flex-col gap-4 p-4">
          {error && <Banner tone="bad">{error}</Banner>}
          {notice && <Banner tone="good">{notice}</Banner>}
          {busy && <Banner tone="info">{busy}</Banner>}

          {frozen && (
            <Banner tone="info">
              Your reward clears in {player?.windowRemainingSeconds ?? 0}s. This is how we take
              back rewards earned by cheating — without it, we could not pay out instantly.
            </Banner>
          )}

          {screen.kind === 'wall' && (
            <Offerwall onPick={(game) => setScreen({ kind: 'playing', game })} />
          )}

          {screen.kind === 'playing' && (
            <Playing game={screen.game} onDone={() => onGameComplete(screen.game)} onBack={() => setScreen({ kind: 'wall' })} />
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
        </div>

        <Footer
          canCashOut={Boolean(player?.canConvert) && points > 0}
          hasCash={cash > 0}
          onCashOut={onCashOut}
          onWithdraw={onWithdraw}
          disabled={Boolean(busy)}
        />
      </div>
    </main>
  );
}

function Header({ points, cash }: { points: number; cash: number }) {
  return (
    <header className="px-5 pb-4 pt-6" style={{ background: 'var(--ink)', color: 'var(--surface)' }}>
      <p className="text-[11px] uppercase tracking-widest opacity-60">Your rewards</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums">{points.toFixed(2)}</p>
      <p className="mt-1 text-xs opacity-70">
        {cash > 0 ? `$${cash.toFixed(2)} ready to withdraw` : 'Play a game to start earning'}
      </p>
    </header>
  );
}

function Offerwall({ onPick }: { onPick: (game: Game) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-sm font-semibold">Earn today</h1>
      {GAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          onClick={() => onPick(game)}
          className="flex items-center gap-3 rounded-xl border p-3 text-left transition-transform active:scale-[0.99]"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-2xl" style={{ background: 'var(--canvas)' }}>
            {game.art}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{game.title}</span>
            <span className="block truncate text-xs" style={{ color: 'var(--muted)' }}>
              {game.goal}
            </span>
          </span>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--lime)', color: 'var(--ink)' }}>
            ~{game.seconds}s
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
