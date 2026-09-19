'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Board, GameHud, Overlay, ScorePops, useClaimOnce, useScorePops } from './game-shell';
import type { GamePlayProps } from './types';

const SIZE = 3;
const GOAL = 12;
const LIVES = 3;
/** The first target waits this long; every hit shaves some off. */
const START_MS = 1250;
const FLOOR_MS = 520;

/**
 * One tile lights up. Hit it before it goes out.
 *
 * Three misses and the run ends, which is what gives each tap weight — the
 * pressure comes from the cost of being wrong, not from a clock ticking in
 * the corner. The window shrinks as you go, so the last few are genuinely
 * quick.
 */
export function ReflexGrid({ onComplete }: GamePlayProps) {
  const [lit, setLit] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [state, setState] = useState<'playing' | 'won' | 'lost'>('playing');
  const { pops, pop } = useScorePops();

  const hitsRef = useRef(0);
  const livesRef = useRef(LIVES);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claim = useClaimOnce(onComplete);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const loseLife = useCallback(() => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) {
      setState('lost');
      setLit(null);
    }
  }, []);

  /**
   * Light a new tile and arm the miss timer.
   *
   * A round schedules the next one, so the function has to reach itself. It
   * does that through a ref that an effect keeps current — never assigned
   * while rendering, which would make the value depend on when React happens
   * to re-render rather than on the game.
   */
  const roundRef = useRef<() => void>(() => {});

  const startRound = useCallback(() => {
    if (livesRef.current <= 0 || hitsRef.current >= GOAL) return;

    // The window shrinks with every hit, so the last targets are quick.
    const windowMs = Math.max(FLOOR_MS, START_MS - hitsRef.current * 60);
    setLit(Math.floor(Math.random() * SIZE * SIZE));
    clearTimer();

    timer.current = setTimeout(() => {
      setLit(null);
      loseLife();
      setTimeout(() => roundRef.current(), 350);
    }, windowMs);
  }, [clearTimer, loseLife]);

  useEffect(() => {
    roundRef.current = startRound;
  }, [startRound]);

  useEffect(() => {
    const start = setTimeout(() => roundRef.current(), 500);
    return () => {
      clearTimeout(start);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const tap = useCallback(
    (cell: number) => {
      if (state !== 'playing') return;

      if (cell !== lit) {
        clearTimer();
        setLit(null);
        loseLife();
        setTimeout(() => roundRef.current(), 350);
        return;
      }

      clearTimer();
      setLit(null);
      hitsRef.current += 1;
      setHits(hitsRef.current);
      pop(((cell % SIZE) + 0.5) * (100 / SIZE), (Math.floor(cell / SIZE) + 0.5) * (100 / SIZE), '+1');

      if (hitsRef.current >= GOAL) {
        setState('won');
        claim();
        return;
      }
      setTimeout(() => roundRef.current(), 260);
    },
    [lit, state, clearTimer, loseLife, pop, claim],
  );

  const retry = () => {
    hitsRef.current = 0;
    livesRef.current = LIVES;
    setHits(0);
    setLives(LIVES);
    setState('playing');
    setTimeout(() => roundRef.current(), 400);
  };

  return (
    <div className="flex flex-col gap-3">
      <GameHud
        score={hits}
        goal={GOAL}
        accent="var(--orange)"
        right={
          <span className="text-sm tracking-widest" aria-label={`${lives} lives left`}>
            {'●'.repeat(lives)}
            <span style={{ opacity: 0.25 }}>{'●'.repeat(LIVES - lives)}</span>
          </span>
        }
      />

      <Board background="linear-gradient(180deg, #3a1d07 0%, #1a0c02 100%)">
        <div className="absolute inset-3 grid grid-cols-3 grid-rows-3 gap-2">
          {Array.from({ length: SIZE * SIZE }, (_, cell) => {
            const on = cell === lit;
            return (
              <button
                key={cell}
                type="button"
                onClick={() => tap(cell)}
                aria-label={on ? 'target' : 'tile'}
                className="rounded-xl transition-all duration-100 active:scale-95"
                style={{
                  background: on ? 'var(--orange)' : 'rgba(255,255,255,.07)',
                  boxShadow: on ? '0 0 26px rgba(255,158,77,.75)' : 'none',
                }}
              />
            );
          })}
        </div>

        <ScorePops pops={pops} />

        {state === 'lost' && (
          <Overlay
            tone="lose"
            title="Out of lives"
            subtitle={`${hits} of ${GOAL} hit`}
            action={{ label: 'Try again', onClick: retry }}
          />
        )}
        {state === 'won' && <Overlay tone="win" title="Goal reached" />}
      </Board>
    </div>
  );
}
