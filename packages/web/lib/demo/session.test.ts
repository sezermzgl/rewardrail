import { beforeEach, describe, expect, it } from 'vitest';

import { demoPlayers, SEEDED_LABELS, sessionPlayers } from './session';

/**
 * The regression this covers: the deployed validator remembers every account
 * any scripted rehearsal ever opened — eleven of them at one point, nine with
 * no balance and no completed task — and the player panel rendered a card for
 * each. Four panels of eleven cards is not a console, and a visitor cannot
 * tell which row is theirs.
 */
const player = (label: string, publicKey = `G${label.toUpperCase()}`) => ({
  publicKey,
  label,
});

const all = [
  player('honest'),
  player('fraudster'),
  player('merge-check@example.com'),
  player('honest-1789855802969@rehearsal.test'),
  player('fraud-1789855802969@rehearsal.test'),
  player('judge-check@example.com'),
];

describe('the demo set', () => {
  it('keeps the two accounts a walkthrough follows and counts the rest', () => {
    const { shown, hidden } = demoPlayers(all, []);

    expect(shown.map((p) => p.label)).toEqual(SEEDED_LABELS);
    expect(hidden).toBe(all.length - 2);
  });

  it('keeps whoever signed in from this browser', () => {
    const { shown, hidden } = demoPlayers(all, ['GJUDGE-CHECK@EXAMPLE.COM']);

    expect(shown.map((p) => p.label)).toContain('judge-check@example.com');
    expect(shown).toHaveLength(3);
    expect(hidden).toBe(all.length - 3);
  });

  it('hides nothing when there is nothing left over', () => {
    const { shown, hidden } = demoPlayers(all.slice(0, 2), []);

    expect(shown).toHaveLength(2);
    expect(hidden).toBe(0);
  });
});

describe('the session list', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  it('remembers an account and tells subscribers', () => {
    const seen: string[][] = [];
    const stop = sessionPlayers.subscribe((players) => seen.push(players));

    sessionPlayers.add('GABC');
    sessionPlayers.add('GABC');
    sessionPlayers.add('GDEF');
    stop();

    // One call on subscribe, then one per genuinely new account.
    expect(seen).toEqual([[], ['GABC'], ['GABC', 'GDEF']]);
  });

  it('survives a reload', () => {
    sessionPlayers.add('GABC');
    expect(sessionPlayers.all()).toEqual(['GABC']);
  });
});
