import { describe, expect, it } from 'vitest';

import { fromLocalAction, fromValidatorEvent, sortEntries } from './normalize';

/**
 * #17 asks for the whole demo to be readable in one list at the end. A kind
 * the normaliser does not recognise is dropped without a sound, so the rows
 * most worth checking are the ones whose names differ between the validator
 * and the log — the campaign's own opening and closing among them.
 */
const at = '2026-09-20T09:00:00.000Z';
const hash = 'f'.repeat(64);

describe('validator events', () => {
  it('keeps the campaign open and close rows the validator names differently', () => {
    const opened = fromValidatorEvent({ at, kind: 'campaign_open', hash, amount: '5' });
    const closed = fromValidatorEvent({ at, kind: 'campaign_close', hash, amount: '1.5' });

    expect(opened?.kind).toBe('campaign');
    expect(opened?.action).toBe('Campaign opened, budget locked');
    expect(closed?.kind).toBe('close');
    expect(closed?.role).toBe('advertiser');
  });

  it('keeps the rows the Soroswap and anchor steps produce', () => {
    for (const kind of ['swap', 'cashout', 'reconcile', 'withdraw']) {
      expect(fromValidatorEvent({ at, kind, hash })).not.toBeNull();
    }
  });

  it('drops a kind it has no row for rather than inventing one', () => {
    expect(fromValidatorEvent({ at, kind: 'heartbeat', hash })).toBeNull();
  });

  it('links every hash to the explorer and names the actor when it knows it', () => {
    const entry = fromValidatorEvent(
      { at, kind: 'reward', hash, actor: 'GPLAYER', amount: '1.2000000' },
      { GPLAYER: 'honest player' },
    );

    expect(entry?.url).toContain(hash);
    expect(entry?.actor).toBe('honest player');
    expect(entry?.amount).toBe('1.2000');
  });

  it('gives a row with no hash an id that cannot collide with a hashed one', () => {
    const noHash = fromValidatorEvent({ at, kind: 'flag', note: 'nothing left' });
    const hashed = fromValidatorEvent({ at, kind: 'flag', hash });

    expect(noHash?.id).not.toBe(hashed?.id);
    expect(noHash?.url).toBeUndefined();
  });
});

describe('ordering', () => {
  it('reads oldest first, so the finished log is the demo in order', () => {
    const rows = [
      fromLocalAction({ kind: 'close', at: '2026-09-20T09:05:00.000Z' }),
      fromLocalAction({ kind: 'campaign', at: '2026-09-20T09:00:00.000Z' }),
    ];

    expect(sortEntries(rows).map((row) => row.kind)).toEqual(['campaign', 'close']);
  });
});
