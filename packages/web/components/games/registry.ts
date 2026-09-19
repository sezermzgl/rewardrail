import { CoinRush } from './coin-rush';
import { MemoryMatch } from './memory-match';
import type { Game } from './types';

/**
 * The offerwall catalogue.
 *
 * Adding a game is two steps: write a component that takes `onComplete`, and
 * add an entry here. Nothing else in the app needs to change — the payout
 * path, the clawback window and the panels are all game-agnostic.
 */
export const GAMES: Game[] = [
  {
    id: 'coin-rush',
    title: 'Coin Rush',
    studio: 'Northline Games',
    goal: 'Collect 12 coins before the timer runs out',
    art: '🪙',
    seconds: 20,
    Play: CoinRush,
  },
  {
    id: 'memory-match',
    title: 'Orchard Pairs',
    studio: 'Twelvefold',
    goal: 'Match all six pairs',
    art: '🍒',
    seconds: 30,
    Play: MemoryMatch,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
