'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { GamePlayProps } from './types';

const SYMBOLS = ['🍋', '🌶', '🫐', '🥝', '🍒', '🥑'];
const FLIP_BACK_MS = 700;

type Card = { id: number; symbol: string; matched: boolean };

function shuffled(): Card[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((symbol, id) => ({
    id,
    symbol,
    matched: false,
  }));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Six pairs, click to flip, done when the board is clear.
 *
 * Click-only on purpose: a keyboard game is a liability on a projector, and a
 * trackpad is the only input anyone is guaranteed to have on stage.
 */
export function MemoryMatch({ onComplete }: GamePlayProps) {
  const [cards, setCards] = useState<Card[]>(shuffled);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  /**
   * `onComplete` pays a reward, so it must fire once. Effects run twice under
   * StrictMode, which would otherwise settle and pay the same board twice.
   */
  const claimed = useRef(false);

  const matchedCount = cards.filter((c) => c.matched).length;
  const done = matchedCount === cards.length;

  const flip = useCallback(
    (id: number) => {
      if (locked || done) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.matched || flipped.includes(id)) return;

      const next = [...flipped, id];
      setFlipped(next);
      if (next.length < 2) return;

      setMoves((m) => m + 1);
      const [a, b] = next.map((i) => cards.find((c) => c.id === i)!);

      if (a.symbol === b.symbol) {
        setCards((prev) =>
          prev.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c)),
        );
        setFlipped([]);
        return;
      }

      // Hold the mismatch on screen long enough to be seen, then flip back.
      setLocked(true);
      setTimeout(() => {
        setFlipped([]);
        setLocked(false);
      }, FLIP_BACK_MS);
    },
    [cards, flipped, locked, done],
  );

  useEffect(() => {
    if (!done || claimed.current) return;
    claimed.current = true;
    onComplete();
  }, [done, onComplete]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between text-xs" style={{ color: 'var(--muted)' }}>
        <span>
          {matchedCount / 2} of {SYMBOLS.length} pairs
        </span>
        <span>{moves} moves</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => {
          const face = card.matched || flipped.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => flip(card.id)}
              aria-label={face ? card.symbol : 'hidden card'}
              className="aspect-square rounded-lg border text-2xl transition-transform active:scale-95"
              style={{
                background: face ? 'var(--surface)' : 'var(--ink)',
                borderColor: card.matched ? 'var(--green)' : 'var(--border)',
                opacity: card.matched ? 0.55 : 1,
              }}
            >
              {face ? card.symbol : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
