'use client';

import { useCallback, useRef, useState } from 'react';

import { Board, GameHud, Overlay, ScorePops, useClaimOnce, useScorePops } from './game-shell';
import type { GamePlayProps } from './types';

const COLS = 6;
const ROWS = 7;
const GOAL = 40;
const COLOURS = ['#2c71f1', '#b490f6', '#ff9e4d', '#98d985', '#f4d75e'];

type Grid = (number | null)[];

const randomGrid = (): Grid =>
  Array.from({ length: COLS * ROWS }, () => Math.floor(Math.random() * COLOURS.length));

const at = (i: number) => ({ col: i % COLS, row: Math.floor(i / COLS) });

/** Every gem reachable from `start` through neighbours of the same colour. */
function group(grid: Grid, start: number): number[] {
  const colour = grid[start];
  if (colour === null) return [];

  const seen = new Set<number>([start]);
  const queue = [start];

  while (queue.length) {
    const i = queue.pop()!;
    const { col, row } = at(i);
    const neighbours = [
      col > 0 ? i - 1 : -1,
      col < COLS - 1 ? i + 1 : -1,
      row > 0 ? i - COLS : -1,
      row < ROWS - 1 ? i + COLS : -1,
    ];
    for (const n of neighbours) {
      if (n >= 0 && !seen.has(n) && grid[n] === colour) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return [...seen];
}

/** Clear cells, let the column above fall into the hole, refill from the top. */
function collapse(grid: Grid, cleared: number[]): Grid {
  const next = [...grid];
  for (const i of cleared) next[i] = null;

  for (let col = 0; col < COLS; col += 1) {
    const column: (number | null)[] = [];
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      const v = next[row * COLS + col];
      if (v !== null) column.push(v);
    }
    while (column.length < ROWS) column.push(Math.floor(Math.random() * COLOURS.length));
    for (let row = ROWS - 1, k = 0; row >= 0; row -= 1, k += 1) {
      next[row * COLS + col] = column[k];
    }
  }
  return next;
}

/**
 * Tap a run of touching gems to clear it. Bigger runs score more than their
 * size, so the goal rewards looking before tapping.
 *
 * A pair is worth two; a run of five is worth fifteen. That curve is the
 * whole design — it makes patience the fast strategy, which is what stops
 * this being a clicking exercise.
 */
export function GemCascade({ onComplete }: GamePlayProps) {
  const [grid, setGrid] = useState<Grid>(randomGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);
  const { pops, pop } = useScorePops();

  const scoreRef = useRef(0);
  const claim = useClaimOnce(onComplete);

  const tap = useCallback(
    (index: number) => {
      if (won) return;
      const run = group(grid, index);
      if (run.length < 2) return;

      // Triangular-ish scoring: a run of n is worth n(n-1)/2 + n.
      const gained = (run.length * (run.length - 1)) / 2 + run.length;
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setBest((b) => Math.max(b, run.length));

      const { col, row } = at(index);
      pop(((col + 0.5) / COLS) * 100, ((row + 0.5) / ROWS) * 100, `+${gained}`);

      setGrid(collapse(grid, run));

      if (scoreRef.current >= GOAL) {
        setWon(true);
        claim();
      }
    },
    [grid, won, pop, claim],
  );

  return (
    <div className="flex flex-col gap-3">
      <GameHud
        score={score}
        goal={GOAL}
        accent="var(--blue)"
        right={
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {best > 1 ? `best run ${best}` : 'tap matching gems'}
          </span>
        }
      />

      <Board background="linear-gradient(180deg, #101a2e 0%, #060a14 100%)">
        <div
          className="absolute inset-2 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {grid.map((colour, i) => (
            <button
              key={i}
              type="button"
              onClick={() => tap(i)}
              aria-label="gem"
              className="rounded-md transition-transform active:scale-90"
              style={{
                background:
                  colour === null
                    ? 'transparent'
                    : `radial-gradient(circle at 34% 28%, ${COLOURS[colour]}, ${COLOURS[colour]}99)`,
                boxShadow: colour === null ? 'none' : 'inset 0 -2px 4px rgba(0,0,0,.35)',
              }}
            />
          ))}
        </div>

        <ScorePops pops={pops} />
        {won && <Overlay tone="win" title="Goal reached" />}
      </Board>
    </div>
  );
}
