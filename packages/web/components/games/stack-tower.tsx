'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Board, GameHud, Overlay, useClaimOnce } from './game-shell';
import type { GamePlayProps } from './types';

const GOAL = 6;
const BOARD_H = 260;
const BLOCK_H = 30;
const START_W = 74;
const TICK_MS = 16;

type Block = { left: number; width: number };

/**
 * Drop each block onto the one below. Overhang is sliced off, so the tower
 * narrows every time you are late.
 *
 * This is the one game here with a skill ceiling. A player who taps carelessly
 * runs out of width in four drops; a player who watches the slider gets six.
 * That difference is what makes it feel like a game rather than a formality.
 */
export function StackTower({ onComplete }: GamePlayProps) {
  const [stack, setStack] = useState<Block[]>([{ left: 13, width: START_W }]);
  const [slider, setSlider] = useState<Block>({ left: 0, width: START_W });
  const [state, setState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [perfect, setPerfect] = useState(0);

  const dir = useRef(1);
  const speed = useRef(0.9);
  const claim = useClaimOnce(onComplete);
  const placed = stack.length - 1;

  // The slider bounces between the edges. Each successful drop speeds it up,
  // so the sixth block is meaningfully harder than the first.
  useEffect(() => {
    if (state !== 'playing') return;
    const tick = setInterval(() => {
      setSlider((prev) => {
        let next = prev.left + dir.current * speed.current;
        if (next <= 0) {
          next = 0;
          dir.current = 1;
        } else if (next + prev.width >= 100) {
          next = 100 - prev.width;
          dir.current = -1;
        }
        return { ...prev, left: next };
      });
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [state]);

  const drop = useCallback(() => {
    if (state !== 'playing') return;

    const below = stack[stack.length - 1];
    const overlapLeft = Math.max(below.left, slider.left);
    const overlapRight = Math.min(below.left + below.width, slider.left + slider.width);
    const width = overlapRight - overlapLeft;

    if (width <= 2) {
      setState('lost');
      return;
    }

    const offBy = Math.abs(slider.left - below.left);
    if (offBy < 1.5) setPerfect((p) => p + 1);

    const next = [...stack, { left: overlapLeft, width }];
    setStack(next);
    speed.current = Math.min(2.4, speed.current + 0.22);
    setSlider({ left: 0, width });
    dir.current = 1;

    if (next.length - 1 >= GOAL) {
      setState('won');
      claim();
    }
  }, [stack, slider, state, claim]);

  const retry = () => {
    setStack([{ left: 13, width: START_W }]);
    setSlider({ left: 0, width: START_W });
    speed.current = 0.9;
    dir.current = 1;
    setPerfect(0);
    setState('playing');
  };

  return (
    <div className="flex flex-col gap-3">
      <GameHud
        score={placed}
        goal={GOAL}
        accent="var(--lavender)"
        right={
          perfect > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-bold"
              style={{ background: 'var(--lavender)', color: 'white' }}
            >
              {perfect} perfect
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              tap to drop
            </span>
          )
        }
      />

      <button
        type="button"
        onClick={drop}
        aria-label="drop the block"
        className="block w-full text-left"
        disabled={state !== 'playing'}
      >
        <Board background="linear-gradient(180deg, #2b1a55 0%, #150a2d 100%)" height={BOARD_H}>
          {stack.map((block, i) => (
            <div
              key={i}
              className="absolute rounded-md"
              style={{
                left: `${block.left}%`,
                width: `${block.width}%`,
                height: BLOCK_H,
                bottom: i * BLOCK_H,
                background: `hsl(${262 + i * 14} 70% ${58 - i * 3}%)`,
                boxShadow: '0 2px 0 rgba(0,0,0,.25)',
              }}
            />
          ))}

          {state === 'playing' && (
            <div
              className="absolute rounded-md"
              style={{
                left: `${slider.left}%`,
                width: `${slider.width}%`,
                height: BLOCK_H,
                bottom: stack.length * BLOCK_H,
                background: 'var(--rail)',
                boxShadow: '0 0 20px rgba(152,217,133,.55)',
              }}
            />
          )}

          {state === 'lost' && (
            <Overlay
              tone="lose"
              title="Tower fell"
              subtitle={`${placed} of ${GOAL} blocks`}
              action={{ label: 'Try again', onClick: retry }}
            />
          )}
          {state === 'won' && <Overlay tone="win" title="Tower complete" />}
        </Board>
      </button>
    </div>
  );
}
