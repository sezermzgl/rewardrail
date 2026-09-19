import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RefreshProvider } from '@/lib/demo/refresh';

import { AdvertiserPanel } from './advertiser-panel';

/**
 * #14 is done when a campaign can be opened and closed from the interface with
 * the hashes shown. The half worth a test is the id: campaign ids are global
 * and increment on every open, so a panel that reports the id it asked for
 * rather than the one the contract returned would leave the whole console
 * pointed at somebody else's campaign.
 */
const { openCampaign, closeCampaign, getCampaignView } = vi.hoisted(() => ({
  openCampaign: vi.fn(),
  closeCampaign: vi.fn(),
  getCampaignView: vi.fn(),
}));

vi.mock('@/lib/demo/console-actions', () => ({ openCampaign, closeCampaign }));
vi.mock('@/lib/chain/read', async () => {
  const actual = await vi.importActual<typeof import('@/lib/chain/read')>('@/lib/chain/read');
  return { ...actual, getCampaignView };
});

const campaign = (open = true) => ({
  id: 3,
  advertiser: 'GADV',
  platform: 'GPLAT',
  open,
  perAction: '1.0000',
  remaining: '4.0000',
  escrowTotalBalance: '9.0000',
  splits: [
    { publisher: 'GPUBLISHER', player_bps: 3000, publisher_bps: 4500, platform_bps: 2500 },
  ],
});

function view(onCampaignOpened = vi.fn()) {
  render(
    <RefreshProvider>
      <AdvertiserPanel campaignId={3} onCampaignOpened={onCampaignOpened} />
    </RefreshProvider>,
  );
  return onCampaignOpened;
}

beforeEach(() => {
  getCampaignView.mockResolvedValue(campaign());
  openCampaign.mockReset();
  closeCampaign.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('advertiser panel', () => {
  it('hands the console the id the contract returned, not the one it was showing', async () => {
    openCampaign.mockResolvedValue({
      campaignId: 11,
      tx: { hash: 'd'.repeat(64), url: 'https://example.test/d' },
    });

    const onOpened = view();
    await screen.findByText('Budget remaining');

    await userEvent.click(screen.getByRole('button', { name: /open campaign/i }));

    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(11));
  });

  it('refuses a budget that cannot pay for a single action', async () => {
    view();
    await screen.findByText('Budget remaining');

    const budget = screen.getByLabelText(/^Budget/);
    await userEvent.clear(budget);
    await userEvent.type(budget, '0');

    expect(screen.getByRole('button', { name: /open campaign/i })).toBeDisabled();
    expect(openCampaign).not.toHaveBeenCalled();
  });

  it('shows what the refund returned when the campaign is closed', async () => {
    closeCampaign.mockResolvedValue({
      refunded: '4.0000000',
      tx: { hash: 'e'.repeat(64), url: 'https://example.test/e' },
    });

    view();
    await screen.findByText('Budget remaining');

    await userEvent.click(screen.getByRole('button', { name: /close campaign/i }));

    await waitFor(() => expect(closeCampaign).toHaveBeenCalledWith(3));
    expect(await screen.findByText(/4\.0000000/)).toBeInTheDocument();
  });

  it('offers no second close for a campaign already closed', async () => {
    getCampaignView.mockResolvedValue(campaign(false));

    view();
    await screen.findByText('Closed');

    expect(screen.getByRole('button', { name: /close campaign/i })).toBeDisabled();
  });

  it('surfaces a refusal rather than reporting a campaign that was never opened', async () => {
    openCampaign.mockRejectedValue(
      new Error('advertiser cannot cover that budget — holds 0 USDC'),
    );

    const onOpened = view();
    await screen.findByText('Budget remaining');
    await userEvent.click(screen.getByRole('button', { name: /open campaign/i }));

    expect(await screen.findByText(/cannot cover that budget/)).toBeInTheDocument();
    expect(onOpened).not.toHaveBeenCalled();
  });
});
