/**
 * The one POST to the validator, shared by every panel that writes.
 *
 * It lives in its own module because two files now need it — `actions.ts` for
 * the player app's writes and `console-actions.ts` for the demo console's —
 * and the alternative is two copies of the same error handling, which is the
 * split that gets one copy fixed and the other forgotten.
 */
import { config } from '../chain/config';

export async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.validatorUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'The validator is not reachable. Start it with `npm start` in packages/validator.',
    );
  }

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // The validator answers failures with { error, detail }, and the specific
    // reason is the only part a caller can act on — a status code is not.
    const reason = [payload.error, payload.detail ?? payload.reason]
      .filter(Boolean)
      .join(' — ');
    throw new Error(reason || `request failed with ${res.status}`);
  }
  return payload as T;
}

/** A submitted transaction, as every validator write reports it. */
export interface TxRef {
  hash: string;
  url: string;
}
