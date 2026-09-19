import { CoinRush } from './coin-rush';
import { GemCascade } from './gem-cascade';
import { OrchardPairs } from './orchard-pairs';
import { ReflexGrid } from './reflex-grid';
import { StackTower } from './stack-tower';
import type { Game } from './types';

/**
 * The offerwall catalogue.
 *
 * Adding a game is two steps: write a component that takes `onComplete`, and
 * add an entry here. Nothing else changes — the payout path, the clawback
 * window and the panels are all game-agnostic, because a game knows nothing
 * about Stellar.
 *
 * The studios are invented. The point of naming them at all is that a real
 * offerwall lists other people's games, and a wall of unattributed tiles
 * reads as a menu rather than a marketplace.
 */
export const GAMES: Game[] = [
  {
    id: 'coin-rush',
    title: 'Coin Rush',
    studio: 'Northline Games',
    genre: 'Arcade',
    goal: 'Collect 15 coins before the timer runs out',
    art: '🪙',
    cover: 'linear-gradient(135deg, #f4d75e 0%, #ff9e4d 100%)',
    seconds: 22,
    Play: CoinRush,
  },
  {
    id: 'stack-tower',
    title: 'Stack Tower',
    studio: 'Halcyon Interactive',
    genre: 'Timing',
    goal: 'Stack six blocks without losing the tower',
    art: '🧱',
    cover: 'linear-gradient(135deg, #b490f6 0%, #6c3fd4 100%)',
    seconds: 30,
    Play: StackTower,
  },
  {
    id: 'gem-cascade',
    title: 'Gem Cascade',
    studio: 'Bluepeak Studio',
    genre: 'Puzzle',
    goal: 'Score 40 by clearing runs of matching gems',
    art: '💎',
    cover: 'linear-gradient(135deg, #2c71f1 0%, #066ffa 100%)',
    seconds: 35,
    Play: GemCascade,
  },
  {
    id: 'reflex-grid',
    title: 'Reflex Grid',
    studio: 'Kestrel Works',
    genre: 'Reaction',
    goal: 'Hit 12 targets with three lives',
    art: '🎯',
    cover: 'linear-gradient(135deg, #ff9e4d 0%, #c2571d 100%)',
    seconds: 25,
    Play: ReflexGrid,
  },
  {
    id: 'orchard-pairs',
    title: 'Orchard Pairs',
    studio: 'Twelvefold',
    genre: 'Memory',
    goal: 'Match all six pairs',
    art: '🍒',
    cover: 'linear-gradient(135deg, #98d985 0%, #2f6b1e 100%)',
    seconds: 30,
    Play: OrchardPairs,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
