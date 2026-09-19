/**
 * One row of the shared transaction log.
 *
 * The log is the visual counterpart of the auditability claim: if the hash is
 * not on screen, the claim is just words (#17).
 */

export type LogKind =
  | 'campaign' // advertiser opened a campaign
  | 'signup' // a player account was sponsored into existence
  | 'settle' // a verified action split three ways
  | 'reward' // REWARD reached the player
  | 'convert' // REWARD burned, TUSDC withdrawn from escrow
  | 'withdraw' // a publisher or the platform pulled its claim
  | 'flag' // an operator marked a player fraudulent
  | 'clawback' // REWARD pulled back from the player
  | 'refund' // the reversed amount returned to the campaign
  | 'close'; // campaign closed, remainder refunded

export type LogActorRole = 'advertiser' | 'player' | 'publisher' | 'platform' | 'operator';

export interface LogEntry {
  /** Stable across refetches so polling never duplicates a row. */
  id: string;
  /** ISO 8601. */
  at: string;
  kind: LogKind;
  /** Human sentence for the row, already in the log's voice. */
  action: string;
  /** Display name when known, otherwise a shortened address. */
  actor: string;
  actorAddress?: string;
  role?: LogActorRole;
  /** Display units, not stroops. */
  amount?: string;
  hash?: string;
  url?: string;
  /** Why there is no hash, for the rows that legitimately have none. */
  note?: string;
}

/** What the validator's GET /events returns, before normalisation. */
export interface ValidatorEvent {
  at: string;
  kind: string;
  actor?: string;
  amount?: string;
  hash?: string;
  url?: string;
  note?: string;
}

/** A row a panel records itself, for calls that never touch the validator. */
export interface LocalEntryInput {
  kind: LogKind;
  actorAddress?: string;
  actorLabel?: string;
  role?: LogActorRole;
  amount?: string;
  hash?: string;
  note?: string;
  at?: string;
}
