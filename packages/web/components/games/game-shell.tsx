'use client';

/**
 * The chrome every game shares.
 *
 * Five games built independently would drift into five different ideas of
 * what a score looks like, and the offerwall would feel like a directory of
 * other people's apps rather than one product. The shell fixes the score
 * readout, the progress toward the goal and the win moment; each game brings
 * only its own board and its own colour.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** A score pop, so a tap feels like it landed rather than merely counting. */
export type Pop = { id: number; x: number; y: number; text: string };

export function useScorePops() {
  const [pops, setPops] = useState<Pop[]>([]);
  const nextId = useRef(0);

  const pop = useCallback((x: number, y: number, text: string) => {
    const id = nextId.current++;
    setPops((prev) => [...prev.slice(-6), { id, x, y, text }]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 700);
  }, []);

  return { pops, pop };
}

export function ScorePops({ pops }: { pops: Pop[] }) {
  return (
    <>
      {pops.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute z-20 select-none text-sm font-bold"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            color: 'white',
            textShadow: '0 1px 6px rgba(0,0,0,.45)',
            animation: 'rr-pop 700ms ease-out forwards',
          }}
        >
          {p.text}
        </span>
      ))}
    </>
  );
}

/**
 * Score, goal and whatever the game wants to show beside them.
 *
 * The progress bar is the part that matters: a goal you can see approaching
 * is what makes the last few taps feel worth making.
 */
export function GameHud({
  score,
  goal,
  accent,
  right,
}: {
  score: number;
  goal: number;
  accent: string;
  right?: React.ReactNode;
}) {
  const pct = Math.min(100, (score / goal) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold tabular-nums">
          {score}
          <span className="text-xs font-medium opacity-50"> / {goal}</span>
        </span>
        {right}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--line)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
    </div>
  );
}

/** The play surface: themed, full width, fixed height so the phone never jumps. */
export function Board({
  background,
  height = 260,
  children,
}: {
  background: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ height, background, boxShadow: 'inset 0 -24px 48px rgba(0,0,0,.18)' }}
    >
      {children}
    </div>
  );
}

export function Overlay({
  tone,
  title,
  subtitle,
  action,
}: {
  tone: 'win' | 'lose';
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]"
      style={{ background: 'rgba(29,29,29,.55)', animation: 'rr-fade 220ms ease-out' }}
    >
      <p
        className="text-2xl font-extrabold"
        style={{ color: tone === 'win' ? 'var(--rail)' : 'white' }}
      >
        {title}
      </p>
      {subtitle && <p className="text-xs text-white/70">{subtitle}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="rounded-full px-5 py-2 text-sm font-bold"
          style={{ background: 'white', color: 'var(--ink)' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Fire a reward exactly once.
 *
 * `onComplete` settles on chain and pays real money, so a second call pays
 * twice. React runs effects and state updaters more than once under
 * StrictMode, which makes any "it only happens on the winning move" reasoning
 * unsafe. Every game claims through this.
 */
export function useClaimOnce(onComplete: () => void) {
  const claimed = useRef(false);
  return useCallback(() => {
    if (claimed.current) return false;
    claimed.current = true;
    onComplete();
    return true;
  }, [onComplete]);
}

/** A countdown that stops itself, for games played against a clock. */
export function useCountdown(seconds: number, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const expired = useRef(false);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      setLeft((prev) => {
        const next = prev - 1;
        if (next <= 0 && !expired.current) {
          expired.current = true;
          onExpire();
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [running, onExpire]);

  const reset = useCallback(() => {
    expired.current = false;
    setLeft(seconds);
  }, [seconds]);

  return { left, reset };
}

export function Timer({ left, warn = 5 }: { left: number; warn?: number }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
      style={{
        background: left <= warn ? 'var(--warn)' : 'var(--line)',
        color: left <= warn ? 'white' : 'var(--muted)',
      }}
    >
      {left}s
    </span>
  );
}
