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
