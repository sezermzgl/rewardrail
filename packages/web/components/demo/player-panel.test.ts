import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The player panel must read like a rewards app.
 *
 * This is a claim the demo makes out loud — "the player never sees a wallet, a
 * seed phrase or a fee" — and the panel is its only evidence. A word slipping
 * in during a later edit would quietly falsify it, which is exactly the kind of
 * regression a test should hold.
 *
 * Comments are stripped first: this file and the panel's own header discuss the
 * forbidden words in order to forbid them.
 */
const FORBIDDEN = [
  'wallet',
  'seed',
  'private key',
  'gas',
  'transaction fee',
  'blockchain',
];

function visibleSource(path: string): string {
  const raw = readFileSync(join(__dirname, path), 'utf8');
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments, not protocol slashes
}

describe('player panel language', () => {
  const source = visibleSource('player-panel.tsx').toLowerCase();

  for (const word of FORBIDDEN) {
    it(`never says "${word}"`, () => {
      expect(source).not.toContain(word);
    });
  }

  it('still says what the player cares about', () => {
    expect(source).toContain('rewards earned');
    expect(source).toContain('cash out');
  });
});
