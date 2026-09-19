'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GamePlayProps } from './types';

const TARGET_SCORE = 12;
const ROUND_SECONDS = 20;
const SPAWN_MS = 700;

type Coin = { id: number; x: number; y: number };

/**
 * Tap the coins before the clock runs out.
 *
 * Reaching the target score is the milestone the reward is paid against, which
 * is the shape of a real offerwall task: not "installed", but "got somewhere".
 * Running out of time is a loss the player can retry, so the demo can show a
 * failed attempt without breaking anything.
 */
export function CoinRush({ onComplete }: GamePlayProps) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND_SECONDS);
  const [state, setState] = useState<'playing' | 'won' | 'lost'>('playing');
  const nextId = useRef(0);
  const scoreRef = useRef(0);
  /**
   * `onComplete` settles on chain and pays a reward, so firing it twice pays
   * twice. React invokes state updaters and effects more than once under
   * StrictMode, which makes "call it from an updater" quietly unsafe. A ref
   * set in the event handler fires exactly once.
   */
  const claimed = useRef(false);

  // Win and loss are decided where they happen — on the tap that reaches the
  // target, and on the tick that runs out the clock. Deciding them in an
  // effect instead would mean rendering a stale state first and correcting it.
  const tap = useCallback(
    (id: number) => {
      setCoins((prev) => prev.filter((c) => c.id !== id));
      scoreRef.current += 1;
      setScore(scoreRef.current);

      if (scoreRef.current >= TARGET_SCORE && !claimed.current) {
        claimed.current = true;
        setState('won');
        onComplete();
      }
    },
    [onComplete],
  );

  // Spawn a coin on a cadence, and let old ones expire so the board never
  // fills up into a free score.
  useEffect(() => {
    if (state !== 'playing') return;
    const spawn = setInterval(() => {
      const id = nextId.current++;
      setCoins((prev) => [
        ...prev.slice(-4),
        { id, x: 8 + Math.random() * 76, y: 8 + Math.random() * 68 },
      ]);
      setTimeout(() => setCoins((prev) => prev.filter((c) => c.id !== id)), 1600);
    }, SPAWN_MS);
    return () => clearInterval(spawn);
  }, [state]);

  useEffect(() => {
    if (state !== 'playing') return;
    const tick = setInterval(() => {
      setLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) setState('lost');
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [state]);

  const retry = () => {
    setCoins([]);
    scoreRef.current = 0;
    setScore(0);
    setLeft(ROUND_SECONDS);
    setState('playing');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between text-xs" style={{ color: 'var(--muted)' }}>
        <span>
          {score} / {TARGET_SCORE} coins
        </span>
        <span style={{ color: left <= 5 && state === 'playing' ? 'var(--coral)' : undefined }}>
          {Math.max(0, left)}s
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border"
        style={{ height: 240, background: 'var(--ink)', borderColor: 'var(--border)' }}
      >
        {state === 'playing' &&
          coins.map((coin) => (
            <button
              key={coin.id}
              type="button"
              onClick={() => tap(coin.id)}
              aria-label="coin"
              className="absolute text-2xl transition-transform active:scale-90"
              style={{ left: `${coin.x}%`, top: `${coin.y}%` }}
            >
              🪙
            </button>
          ))}

        {state === 'lost' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-sm" style={{ color: 'var(--surface)' }}>
              Out of time — {score} of {TARGET_SCORE}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: 'var(--lime)', color: 'var(--ink)' }}
            >
              Try again
            </button>
          </div>
        )}

        {state === 'won' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--lime)' }}>
              Goal reached
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
