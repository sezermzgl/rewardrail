/**
 * The validator backend, as the panels see it.
 *
 * Player identity, risk tier and the clawback window live off chain by design
 * — the tier rule is a business rule that changes far more often than the
 * contract does. So the player and operator panels read them here while the
 * advertiser and publisher panels read straight from the chain.
 *
 * A validator that is not running is a normal state during development, and
 * these calls say so rather than throwing: the two chain-backed panels stay
 * live either way.
 */
import { config } from '../chain/config';

export interface ValidatorPlayer {
  publicKey: string;
  label: string;
  createdAt: number;
  tasks: number;
  flagged: boolean;
  lastRewardAt: number | null;
  tier: 'trusted' | 'new' | 'suspicious';
  canConvert: boolean;
  reason: string;
  windowRemainingSeconds: number | null;
  missing?: { ageDays: number; tasks: number };
  rewardBalance: string;
  tusdcBalance: string;
}

export class ValidatorOffline extends Error {
  constructor() {
    super('validator is not reachable');
    this.name = 'ValidatorOffline';
  }
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.validatorUrl}${path}`);
  } catch {
    throw new ValidatorOffline();
  }
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

/**
 * The player and operator panels and the transaction log all want the same
 * list. Without coalescing, one screen produces three identical requests every
 * poll — three times the load when the validator is up, three times the noise
 * when it is down.
 */
let inflight: { promise: Promise<ValidatorPlayer[]>; at: number } | null = null;
const COALESCE_MS = 1000;

export function fetchPlayers(): Promise<ValidatorPlayer[]> {
  const now = Date.now();
  if (inflight && now - inflight.at < COALESCE_MS) return inflight.promise;

  const promise = get<ValidatorPlayer[]>('/players');
  // Every sharer gets the same rejection, and nobody is left with an
  // unhandled one while the callers attach their own handlers.
  promise.catch(() => {});
  inflight = { promise, at: now };
  return promise;
}

/**
 * A POST the panels make on the player's behalf.
 *
 * The validator answers a refusal with a status and a JSON body, and the body
 * is the useful part: a locked conversion comes back as 409 with the tier that
 * explains why. Flattening that into "request failed" would throw away the
 * only thing worth putting on screen.
 */
export async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.validatorUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ValidatorOffline();
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = payload as { error?: string; detail?: string; reason?: string } | null;
    throw new Error(detail?.reason ?? detail?.detail ?? detail?.error ?? `request failed (${res.status})`);
  }
  return payload as T;
}

export interface TxRef {
  hash: string;
  url: string;
}

export interface ActionResult {
  actionId: string;
  amount: string;
  settleTx: TxRef;
  rewardTx: TxRef;
}

export interface ConvertResult {
  amount: string;
  burnTx: TxRef;
  withdrawTx: TxRef;
  note?: string;
}

/** A completed task becomes money: settle on chain, then the reward is paid. */
export const completeAction = (campaignId: number, player: string) =>
  post<ActionResult>('/action/complete', { campaignId, player });

/** The moment the reward stops being reversible. */
export const convertReward = (campaignId: number, player: string) =>
  post<ConvertResult>('/player/convert', { campaignId, player });

export interface ValidatorHealth {
  ok: boolean;
  escrow: string;
  tusdcSac: string;
  validator: string;
  tiers: { clawbackWindowSeconds: number; minAgeDays: number; minTasks: number };
}

export const fetchHealth = () => get<ValidatorHealth>('/health');
