import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RefreshProvider } from '@/lib/demo/refresh';
import type { ValidatorPlayer } from '@/lib/demo/validator';

import { PlayerPanel } from './player-panel';

/**
 * Two regressions live here.
 *
 * The panel used to render a card for every account the validator had ever
 * seen, which on the deployed service meant a dozen of them and no way to
 * tell which belonged to the walkthrough.
 *
 * And the anchor step assumed a hosted page always came back. The Turkish
 * ramp is SEP-6, which has none — the response carries a reference instead —
 * so the old code opened an empty tab in front of whoever was watching.
 */
const { cashout, completeAction, convert, signIn, fetchPlayers } = vi.hoisted(() => ({
  cashout: vi.fn(),
  completeAction: vi.fn(),
  convert: vi.fn(),
  signIn: vi.fn(),
  fetchPlayers: vi.fn(),
}));

vi.mock('@/lib/demo/actions', () => ({ cashout, completeAction, convert, signIn }));
vi.mock('@/lib/demo/validator', () => ({ fetchPlayers }));

function player(overrides: Partial<ValidatorPlayer> = {}): ValidatorPlayer {
  return {
    publicKey: 'GHONEST',
    label: 'honest',
    createdAt: Date.now(),
    tasks: 1,
    flagged: false,
    lastRewardAt: Date.now(),
    tier: 'new',
    canConvert: true,
    reason: 'clawback window has closed',
    windowRemainingSeconds: 0,
    rewardBalance: '0',
    tusdcBalance: '1.2000000',
    ...overrides,
  };
}

const view = (campaignId = 7) =>
  render(
    <RefreshProvider>
      <PlayerPanel campaignId={campaignId} />
    </RefreshProvider>,
  );

beforeEach(() => {
  globalThis.localStorage?.clear();
  fetchPlayers.mockResolvedValue([player()]);
  cashout.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('player panel', () => {
  it('shows the walkthrough accounts and offers the rest behind a count', async () => {
    fetchPlayers.mockResolvedValue([
      player(),
      player({ publicKey: 'GFRAUD', label: 'fraudster' }),
      player({ publicKey: 'GOLD1', label: 'honest-123@rehearsal.test' }),
      player({ publicKey: 'GOLD2', label: 'fraud-123@rehearsal.test' }),
    ]);

    view();
    await screen.findByText('honest');

    expect(screen.getByText('fraudster')).toBeInTheDocument();
    expect(screen.queryByText('honest-123@rehearsal.test')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /2 more accounts/i }));
    expect(screen.getByText('honest-123@rehearsal.test')).toBeInTheDocument();
  });

  it('reports the anchor reference when the payout provider has no hosted page', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    cashout.mockResolvedValue({
      protocol: 'sep6',
      anchorTransactionId: 'sep_im0ffggrilugmkps9wda',
      interactiveUrl: null,
      deliveryTx: { hash: 'c'.repeat(64), url: 'https://example.test/c' },
      sessionToken: 'token',
      asset: 'USDC',
      amount: 1.2,
      limits: { min: null, max: null },
    });

    view();
    await screen.findByText('honest');
    await userEvent.click(screen.getByRole('button', { name: /send to bank/i }));

    await waitFor(() => expect(cashout).toHaveBeenCalledWith('GHONEST', 1.2));
    expect(await screen.findByText(/sep_im0ffggrilugmkps9wda/)).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('hands the player to the payout provider when there is a page to open', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    cashout.mockResolvedValue({
      protocol: 'sep24',
      anchorTransactionId: 'abc',
      interactiveUrl: 'https://anchor.test/interactive',
      deliveryTx: null,
      sessionToken: 'token',
      asset: 'SRT',
      amount: 1.2,
      limits: { min: '1', max: '10' },
    });

    view();
    await screen.findByText('honest');
    await userEvent.click(screen.getByRole('button', { name: /send to bank/i }));

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://anchor.test/interactive',
        '_blank',
        'noopener',
      ),
    );
  });

  it('will not offer a cash-out the ledger still has frozen', async () => {
    // The validator restarted and lost its clock, so it reports no countdown.
    // The trustline has not forgotten.
    fetchPlayers.mockResolvedValue([
      player({
        rewardBalance: '1.2000000',
        canConvert: false,
        windowRemainingSeconds: null,
        rewardFrozen: true,
        reason: 'the reward is still frozen on the ledger',
      }),
    ]);

    view();
    await screen.findByText('honest');

    expect(screen.getByText(/held by the ledger/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cash out$/i })).toBeDisabled();
  });
});
