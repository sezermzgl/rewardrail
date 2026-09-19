'use client';

import { useCallback, useState } from 'react';

import { Board, GameHud, Overlay, useClaimOnce } from './game-shell';
import type { GamePlayProps } from './types';

const FRUIT = ['🍋', '🫐', '🍒', '🥝', '🍑', '🍇'];
const FLIP_BACK_MS = 650;
const PAIRS = FRUIT.length;

type Card = { id: number; fruit: string; matched: boolean };

function shuffled(): Card[] {
  const deck = [...FRUIT, ...FRUIT].map((fruit, id) => ({ id, fruit, matched: false }));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Six pairs, face down. Clear the board.
 *
 * The only scoring pressure is the move counter, which is enough: a player
 * who pays attention finishes in about fifteen moves, one who guesses takes
 * twice that, and both can see the difference.
 */
export function OrchardPairs({ onComplete }: GamePlayProps) {
  const [cards, setCards] = useState<Card[]>(shuffled);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const claim = useClaimOnce(onComplete);
  const matched = cards.filter((c) => c.matched).length / 2;
  const done = matched === PAIRS;

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

      if (a.fruit === b.fruit) {
        const cleared = cards.map((c) =>
          c.id === a.id || c.id === b.id ? { ...c, matched: true } : c,
        );
        setCards(cleared);
        setFlipped([]);
        // Claim from the handler rather than an effect: effects run twice
        // under StrictMode and this call pays real money.
        if (cleared.every((c) => c.matched)) claim();
        return;
      }

      // Hold the mismatch long enough to be read, then turn it back.
      setLocked(true);
      setTimeout(() => {
        setFlipped([]);
        setLocked(false);
      }, FLIP_BACK_MS);
    },
    [cards, flipped, locked, done, claim],
  );

  return (
    <div className="flex flex-col gap-3">
      <GameHud
        score={matched}
        goal={PAIRS}
        accent="var(--rail)"
        right={
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {moves} {moves === 1 ? 'move' : 'moves'}
          </span>
        }
      />

      <Board background="linear-gradient(180deg, #11321f 0%, #07180f 100%)">
        <div className="absolute inset-3 grid grid-cols-4 grid-rows-3 gap-2">
          {cards.map((card) => {
            const face = card.matched || flipped.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => flip(card.id)}
                aria-label={face ? card.fruit : 'face down card'}
                className="grid place-items-center rounded-xl text-2xl transition-all duration-150 active:scale-95"
                style={{
                  background: face ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.08)',
                  border: card.matched ? '2px solid var(--rail)' : '2px solid transparent',
                  opacity: card.matched ? 0.6 : 1,
                  transform: face ? 'rotateY(0deg)' : 'rotateY(0deg)',
                  boxShadow: face ? '0 4px 12px rgba(0,0,0,.35)' : 'none',
                }}
              >
                {face ? card.fruit : ''}
              </button>
            );
          })}
        </div>

        {done && <Overlay tone="win" title="Board cleared" subtitle={`${moves} moves`} />}
      </Board>
    </div>
  );
}
