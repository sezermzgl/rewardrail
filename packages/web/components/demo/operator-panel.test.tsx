import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RefreshProvider } from '@/lib/demo/refresh';
import type { ValidatorPlayer } from '@/lib/demo/validator';

import { OperatorPanel } from './operator-panel';

/**
 * The flag button is the only way to trigger the clawback chain from the
 * interface, and clawback is the project's strongest claim (#16). Two things
 * are worth holding: that the button reaches the validator with the campaign
 * it belongs to, and that the "nothing to reverse" outcome is shown rather
 * than swallowed — that outcome is the argument for the window existing, so a
 * silent success would lose the demo its point.
 */
const { flagFraud, fetchPlayers } = vi.hoisted(() => ({
  flagFraud: vi.fn(),
  fetchPlayers: vi.fn(),
}));

vi.mock('@/lib/demo/console-actions', () => ({ flagFraud }));
vi.mock('@/lib/demo/validator', () => ({ fetchPlayers }));

function player(overrides: Partial<ValidatorPlayer> = {}): ValidatorPlayer {
  return {
    publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRS',
    label: 'farm account',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    tasks: 9,
    flagged: false,
    lastRewardAt: Date.now(),
    tier: 'suspicious',
    canConvert: false,
    reason: 'too new',
    windowRemainingSeconds: 40,
    rewardBalance: '1.2000000',
    tusdcBalance: '0',
    ...overrides,
  };
}

const view = (campaignId = 3) =>
  render(
    <RefreshProvider>
      <OperatorPanel campaignId={campaignId} />
    </RefreshProvider>,
  );

beforeEach(() => {
  fetchPlayers.mockResolvedValue([player()]);
  flagFraud.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('operator panel', () => {
  it('flags the listed player against the campaign on screen', async () => {
    flagFraud.mockResolvedValue({
      player: 'GABC',
      clawedBack: '1.2000',
      clawbackTx: { hash: 'a'.repeat(64), url: 'https://example.test/a' },
      refundTx: { hash: 'b'.repeat(64), url: 'https://example.test/b' },
      tier: { tier: 'suspicious', canConvert: false, reason: 'flagged', windowRemainingSeconds: null },
    });

    view(7);
    await screen.findByText('farm account');

    await userEvent.click(screen.getByRole('button', { name: /flag/i }));

    await waitFor(() =>
      expect(flagFraud).toHaveBeenCalledWith(7, player().publicKey),
    );
    expect(await screen.findByText(/Reversed 1\.2000/)).toBeInTheDocument();
  });

  it('says so when the window had already closed and nothing was reversed', async () => {
    flagFraud.mockResolvedValue({
      player: 'GABC',
      clawedBack: '0',
      note: 'player already converted — the payout is theirs, the window had closed',
      tier: { tier: 'suspicious', canConvert: true, reason: 'flagged', windowRemainingSeconds: null },
    });

    view();
    await screen.findByText('farm account');
    await userEvent.click(screen.getByRole('button', { name: /flag/i }));

    expect(await screen.findByText(/the window had closed/)).toBeInTheDocument();
  });

  it('surfaces a refusal instead of reporting a reversal that did not happen', async () => {
    flagFraud.mockRejectedValue(new Error('clawback failed — trustline not authorized'));

    view();
    await screen.findByText('farm account');
    await userEvent.click(screen.getByRole('button', { name: /flag/i }));

    expect(await screen.findByText(/trustline not authorized/)).toBeInTheDocument();
  });

  it('offers no second flag for an account already flagged', async () => {
    fetchPlayers.mockResolvedValue([player({ flagged: true })]);

    view();
    await screen.findByText('farm account');

    expect(screen.getByRole('button', { name: /flagged/i })).toBeDisabled();
  });
});
