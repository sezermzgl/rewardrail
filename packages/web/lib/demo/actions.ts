/**
 * The writes the player app makes.
 *
 * Reads live in validator.ts. These are separate because they are the ones
 * that move money: each returns the transaction hashes so the app can show
 * the player what happened on chain, which is the whole auditability claim
 * made visible rather than asserted.
 */
import { config } from '../chain/config';

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.validatorUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The validator is not reachable. Start it with `npm start` in packages/validator.');
  }

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // The validator answers failures with { error, detail } and a 409 carries
    // the tier that blocked it, so surface the specific reason rather than a
    // status code the player cannot act on.
    const reason = [payload.error, payload.detail ?? payload.reason]
      .filter(Boolean)
      .join(' — ');
    throw new Error(reason || `request failed with ${res.status}`);
  }
  return payload as T;
}

export interface TxRef {
  hash: string;
  url: string;
}

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
