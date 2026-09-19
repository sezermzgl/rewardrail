'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Board,
  GameHud,
  Overlay,
  ScorePops,
  Timer,
  useClaimOnce,
  useCountdown,
  useScorePops,
} from './game-shell';
import type { GamePlayProps } from './types';

const GOAL = 15;
const ROUND_SECONDS = 22;
const SPAWN_MS = 620;
const COIN_LIFE_MS = 1700;
/** Taps this close together keep the chain alive. */
const CHAIN_WINDOW_MS = 900;

type Coin = { id: number; x: number; y: number; golden: boolean };

/**
 * Tap coins before they fall away. Consecutive hits build a chain, and a
 * golden coin is worth three.
 *
 * The chain is what turns a clicking exercise into a game: it rewards keeping
 * a rhythm rather than tapping whenever convenient, so a good run finishes
 * noticeably faster than a careless one.
 */
export function CoinRush({ onComplete }: GamePlayProps) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [score, setScore] = useState(0);
  const [chain, setChain] = useState(0);
  const [state, setState] = useState<'playing' | 'won' | 'lost'>('playing');
  const { pops, pop } = useScorePops();

  const nextId = useRef(0);
  const scoreRef = useRef(0);
  const lastTap = useRef(0);
  const claim = useClaimOnce(onComplete);

  const onExpire = useCallback(() => setState('lost'), []);
  const { left, reset } = useCountdown(ROUND_SECONDS, state === 'playing', onExpire);

  const tap = useCallback(
    (coin: Coin) => {
      setCoins((prev) => prev.filter((c) => c.id !== coin.id));

      const now = Date.now();
      const chained = now - lastTap.current < CHAIN_WINDOW_MS;
      lastTap.current = now;
      const nextChain = chained ? chain + 1 : 1;
      setChain(nextChain);

      const base = coin.golden ? 3 : 1;
      const bonus = nextChain >= 4 ? 2 : nextChain >= 2 ? 1 : 0;
      const gained = base + bonus;

      scoreRef.current += gained;
      setScore(scoreRef.current);
      pop(coin.x, coin.y, `+${gained}`);

      if (scoreRef.current >= GOAL) {
        setState('won');
        claim();
      }
    },
    [chain, pop, claim],
  );

  // Coins appear and expire on their own, so the board never fills into a
  // free score and the player has to keep moving.
  useEffect(() => {
    if (state !== 'playing') return;
    const spawn = setInterval(() => {
      const id = nextId.current++;
      setCoins((prev) => [
        ...prev.slice(-4),
        { id, x: 10 + Math.random() * 74, y: 12 + Math.random() * 64, golden: Math.random() < 0.18 },
      ]);
      setTimeout(() => setCoins((prev) => prev.filter((c) => c.id !== id)), COIN_LIFE_MS);
    }, SPAWN_MS);
    return () => clearInterval(spawn);
  }, [state]);

  // Let the chain lapse when the player stops, otherwise it only ratchets up.
  useEffect(() => {
    if (state !== 'playing' || chain === 0) return;
    const t = setTimeout(() => setChain(0), CHAIN_WINDOW_MS);
    return () => clearTimeout(t);
  }, [chain, state]);

  const retry = () => {
    setCoins([]);
    scoreRef.current = 0;
    setScore(0);
    setChain(0);
    reset();
    setState('playing');
  };

  return (
    <div className="flex flex-col gap-3">
      <GameHud
        score={score}
        goal={GOAL}
        accent="var(--coin)"
        right={
          <span className="flex items-center gap-2">
            {chain >= 2 && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{
                  background: 'var(--orange)',
                  color: 'white',
                  animation: 'rr-pulse 600ms ease-in-out infinite',
                }}
              >
                {chain}× chain
              </span>
            )}
            <Timer left={left} />
          </span>
        }
      />

      <Board background="linear-gradient(170deg, #1b2a4a 0%, #0d1526 100%)">
        {/* A few stars, so the board is a place rather than a rectangle. */}
        {[18, 44, 71, 88].map((x, i) => (
          <span
            key={x}
            className="absolute rounded-full"
            style={{
              left: `${x}%`,
              top: `${12 + i * 19}%`,
              width: 3,
              height: 3,
              background: 'rgba(255,255,255,.35)',
            }}
          />
        ))}

        {state === 'playing' &&
          coins.map((coin) => (
            <button
              key={coin.id}
              type="button"
              onClick={() => tap(coin)}
              aria-label={coin.golden ? 'golden coin' : 'coin'}
              className="absolute grid place-items-center rounded-full font-bold transition-transform active:scale-75"
              style={{
                left: `${coin.x}%`,
                top: `${coin.y}%`,
                width: coin.golden ? 46 : 38,
                height: coin.golden ? 46 : 38,
                background: coin.golden
                  ? 'radial-gradient(circle at 34% 30%, #fff3b0, #e0a32a)'
                  : 'radial-gradient(circle at 34% 30%, #ffe9a3, #d8b23f)',
                color: '#6b4b06',
                boxShadow: coin.golden
                  ? '0 0 18px rgba(244,215,94,.7), 0 4px 10px rgba(0,0,0,.4)'
                  : '0 4px 10px rgba(0,0,0,.4)',
                animation: 'rr-drop-in 200ms ease-out',
              }}
            >
              {coin.golden ? '★' : '¢'}
            </button>
          ))}

        <ScorePops pops={pops} />

        {state === 'lost' && (
          <Overlay
            tone="lose"
            title="Out of time"
            subtitle={`${score} of ${GOAL} collected`}
            action={{ label: 'Try again', onClick: retry }}
          />
        )}
        {state === 'won' && <Overlay tone="win" title="Goal reached" />}
      </Board>
    </div>
  );
}
