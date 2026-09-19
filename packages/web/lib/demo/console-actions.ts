/**
 * The writes the demo console's own panels make.
 *
 * Separate from `actions.ts`, which is the player app's. The split is by
 * actor, not by convenience: these are the advertiser's, publisher's and
 * operator's actions, and none of them may ever appear in the player panel —
 * a player who can see a clawback button is a demo that argues against itself.
 */
import { post, type TxRef } from './post';

export interface FraudResult {
  player: string;
  /** Display units. `"0"` when the window had already closed. */
  clawedBack: string;
  clawbackTx?: TxRef;
  refundTx?: TxRef;
  /** Present when there was nothing left to reverse, and says why. */
  note?: string;
  tier: {
    tier: 'trusted' | 'new' | 'suspicious';
    canConvert: boolean;
    reason: string;
    windowRemainingSeconds: number | null;
  };
}

/**
 * Flag a player and reverse what they were paid.
 *
 * Two outcomes, and the second is the more interesting one. If the player
 * still holds REWARD, it is clawed back and the campaign is refunded — two
 * hashes. If they already converted, nothing is reversed and the response says
 * so: the window had closed and the money is theirs. That is the boundary of
 * the clawback claim, and the panel shows it rather than hiding it.
 */
export const flagFraud = (campaignId: number, player: string) =>
  post<FraudResult>('/fraud/flag', { campaignId, player });

export interface WithdrawResult {
  /** Display units, as the contract paid it. */
  amount: string;
  tx: TxRef;
}

/**
 * Pull a publisher's accrued share out of escrow.
 *
 * No minimum and no schedule: the share accrues on every settled action and
 * the publisher takes it whenever they choose. That is the whole claim of the
 * publisher panel, and a button is the only way to demonstrate it.
 *
 * The contract requires the publisher's own authorization, which a browser
 * does not hold, so the validator signs with the key it keeps for the demo
 * publishers. An address it holds no key for comes back as a plain 400.
 */
export const withdrawClaim = (campaignId: number, publisher: string) =>
  post<WithdrawResult>('/publisher/withdraw', { campaignId, publisher });

export interface OpenedCampaign {
  campaignId: number;
  tx: TxRef;
}

/**
 * Open a campaign and lock its budget in escrow.
 *
 * Amounts are whole units, not stroops: a budget of 5 is 5 USDC. The publisher
 * and the split table fall back to the demo's own, because a form that asks
 * for basis points before it will open anything is a form nobody fills in
 * during a four-minute demo.
 *
 * The id comes back rather than being chosen. Campaign ids are global and
 * increment on every open, so the console must follow the id it was given
 * instead of the one it was configured with.
 */
export const openCampaign = (budget: number, perAction: number) =>
  post<OpenedCampaign>('/campaign/open', { budget, perAction });

export interface ClosedCampaign {
  /** Display units returned to the advertiser. */
  refunded: string;
  tx: TxRef;
}

/**
 * Close a campaign and take the unspent budget back.
 *
 * This is the advertiser's exit, and the reason the escrow is not a deposit
 * the platform keeps: whatever no action has released is refunded by the
 * contract, not by a support ticket.
 */
export const closeCampaign = (campaignId: number) =>
  post<ClosedCampaign>('/campaign/close', { campaignId });
