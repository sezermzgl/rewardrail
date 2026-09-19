/**
 * The writes the player app makes.
 *
 * Reads live in validator.ts. These are separate because they are the ones
 * that move money: each returns the transaction hashes so the app can show
 * the player what happened on chain, which is the whole auditability claim
 * made visible rather than asserted.
 *
 * The POST itself lives in post.ts, shared with the demo console's writes.
 */
import { post, type TxRef } from './post';

export type { TxRef };

export interface CompletedAction {
  actionId: string;
  amount: string;
  settleTx: TxRef;
  rewardTx: TxRef;
  tier: {
    tier: 'trusted' | 'new' | 'suspicious';
    canConvert: boolean;
    reason: string;
    windowRemainingSeconds: number | null;
  };
}

/** A finished game becomes a settled action and a paid, frozen reward. */
export const completeAction = (campaignId: number, player: string) =>
  post<CompletedAction>('/action/complete', { campaignId, player });

export interface Conversion {
  amount: string;
  burnTx: TxRef;
  withdrawTx: TxRef;
  note: string;
}

/** Burn the reward and take the escrowed payout. Refused while frozen. */
export const convert = (campaignId: number, player: string) =>
  post<Conversion>('/player/convert', { campaignId, player });

export interface Cashout {
  anchorTransactionId: string;
  interactiveUrl: string;
  sessionToken: string;
  asset: string;
  amount: number;
  limits: { min: string; max: string };
}

/** Open a withdrawal at the anchor. Returns the anchor's own KYC page. */
export const cashout = (player: string, amount: number) =>
  post<Cashout>('/player/cashout', { player, amount });

export interface SignIn {
  player: string;
  label: string;
  /** True when the email already had an account, so nothing was created. */
  returning: boolean;
  signupTx?: TxRef;
}

/**
 * Sign in by email.
 *
 * A known email returns the account it already has; a new one opens a sponsored
 * account with a zero balance. The player funds nothing, signs nothing and is
 * asked for nothing beyond the address.
 */
export const signIn = (email: string) => post<SignIn>('/player/signup', { email });
