import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RefreshProvider } from '@/lib/demo/refresh';

import { PublisherPanel } from './publisher-panel';

/**
 * "Withdraw whenever you like, no minimum" is the publisher panel's whole
 * claim, and a button that only appears above some threshold would quietly
 * contradict it. These hold the two halves: the withdraw reaches the chain,
 * and nothing about the offer depends on how much has accrued beyond there
 * being something to take.
 */
const PUBLISHER = 'GPUBLISHERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const { withdrawClaim, getCampaignView, claimOf } = vi.hoisted(() => ({
  withdrawClaim: vi.fn(),
  getCampaignView: vi.fn(),
  claimOf: vi.fn(),
}));

vi.mock('@/lib/demo/console-actions', () => ({ withdrawClaim }));
vi.mock('@/lib/chain/read', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chain/read')>('@/lib/chain/read');
  return { ...actual, getCampaignView, claimOf };
});

const view = (campaignId = 3) =>
  render(
    <RefreshProvider>
      <PublisherPanel campaignId={campaignId} />
    </RefreshProvider>,
  );

beforeEach(() => {
  getCampaignView.mockResolvedValue({
    id: 3,
    advertiser: 'GADV',
    platform: 'GPLAT',
    open: true,
    perAction: '1.0000',
    remaining: '4.0000',
    escrowTotalBalance: '9.0000',
    splits: [
      { publisher: PUBLISHER, player_bps: 3000, publisher_bps: 4500, platform_bps: 2500 },
    ],
  });
  claimOf.mockResolvedValue(18_000_000n);
  withdrawClaim.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('publisher panel', () => {
  it('withdraws the accrued share for the campaign on screen', async () => {
    withdrawClaim.mockResolvedValue({
      amount: '1.8000000',
      tx: { hash: 'c'.repeat(64), url: 'https://example.test/c' },
    });

    view(7);
    await screen.findByText('1.8000');

    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }));

    await waitFor(() => expect(withdrawClaim).toHaveBeenCalledWith(7, PUBLISHER));
    expect(await screen.findByText(/Withdrew 1\.8000000/)).toBeInTheDocument();
  });

  it('offers the withdrawal at any accrued amount, however small', async () => {
    claimOf.mockResolvedValue(1n); // a ten-millionth of a unit

    view();
    await screen.findByText(/Withdrawable now/);

    expect(screen.getByRole('button', { name: /withdraw/i })).toBeEnabled();
  });

  it('has nothing to offer before the first action settles', async () => {
    claimOf.mockResolvedValue(0n);

    view();
    await screen.findByText(/Nothing accrued/);

    expect(screen.getByRole('button', { name: /withdraw/i })).toBeDisabled();
  });

  it('surfaces a refusal rather than reporting a payout that did not happen', async () => {
    withdrawClaim.mockRejectedValue(new Error('withdraw failed — NothingToWithdraw'));

    view();
    await screen.findByText('1.8000');
    await userEvent.click(screen.getByRole('button', { name: /withdraw/i }));

    expect(await screen.findByText(/NothingToWithdraw/)).toBeInTheDocument();
  });
});
