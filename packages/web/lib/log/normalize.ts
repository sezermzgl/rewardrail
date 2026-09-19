/**
 * Turning raw activity into log rows.
 *
 * Two sources feed the log and neither is complete on its own. The validator
 * records what it does — settle, reward, convert, flag, clawback, refund. The
 * advertiser, publisher and operator panels call the escrow directly, so
 * opening a campaign, withdrawing a claim and closing a campaign never reach
 * the validator at all. Both arrive here and leave in the same shape.
 */
import { explorerTx } from '../chain/config';
import type {
  LocalEntryInput,
  LogActorRole,
  LogEntry,
  LogKind,
  ValidatorEvent,
} from './types';

/** `GABC…WXYZ` — long enough to compare by eye, short enough for a table. */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Hashes are 64 hex characters; nobody reads the middle. */
export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

const ACTIONS: Record<LogKind, string> = {
  campaign: 'Campaign opened, budget locked',
  signup: 'Player account created, reserves sponsored',
  settle: 'Action verified, three shares split',
  reward: 'Reward paid to the player',
  convert: 'Reward converted and withdrawn',
  withdraw: 'Accrued share withdrawn',
  flag: 'Player flagged as fraudulent',
  clawback: 'Reward pulled back',
  refund: 'Reversed amount returned to the campaign',
  close: 'Campaign closed, remainder refunded',
};

const ROLES: Partial<Record<LogKind, LogActorRole>> = {
  campaign: 'advertiser',
  signup: 'player',
  settle: 'player',
  reward: 'player',
  convert: 'player',
  withdraw: 'publisher',
  flag: 'operator',
  clawback: 'operator',
  refund: 'operator',
  close: 'advertiser',
};

const KNOWN_KINDS = new Set<string>(Object.keys(ACTIONS));

const isLogKind = (kind: string): kind is LogKind => KNOWN_KINDS.has(kind);

/**
 * A row's identity.
 *
 * A hash identifies a row on its own; the log polls, so the same event must
 * not appear twice. The rows that legitimately have no hash — a flag against a
 * player who already converted — fall back to time and kind, which is unique
 * enough because one operator cannot flag the same player twice in a
 * millisecond.
 */
function entryId(kind: string, at: string, hash?: string): string {
  return hash ? `${kind}:${hash}` : `${kind}:${at}`;
}

function resolveActor(address: string | undefined, label: string | undefined): string {
  if (label) return label;
  if (address) return shortAddress(address);
  return '—';
}

/**
 * Normalise one validator event.
 *
 * `labels` maps a public key to the name the demo shows — "honest player"
 * rather than `GABC…WXYZ`. Unknown addresses degrade to a shortened form
 * rather than being dropped.
 */
export function fromValidatorEvent(
  event: ValidatorEvent,
  labels: Record<string, string> = {},
): LogEntry | null {
  if (!isLogKind(event.kind)) return null;

  const address = event.actor;
  return {
    id: entryId(event.kind, event.at, event.hash),
    at: event.at,
    kind: event.kind,
    action: ACTIONS[event.kind],
    actor: resolveActor(address, address ? labels[address] : undefined),
    actorAddress: address,
    role: ROLES[event.kind],
    amount: formatAmount(event.amount),
    hash: event.hash,
    url: event.hash ? explorerTx(event.hash) : undefined,
    note: event.note,
  };
}

/** Record something a panel did directly against the escrow. */
export function fromLocalAction(input: LocalEntryInput): LogEntry {
  const at = input.at ?? new Date().toISOString();
  return {
    id: entryId(input.kind, at, input.hash),
    at,
    kind: input.kind,
    action: ACTIONS[input.kind],
    actor: resolveActor(input.actorAddress, input.actorLabel),
    actorAddress: input.actorAddress,
    role: input.role ?? ROLES[input.kind],
    amount: formatAmount(input.amount),
    hash: input.hash,
    url: input.hash ? explorerTx(input.hash) : undefined,
    note: input.note,
  };
}

/**
 * One decimal convention for the amount column.
 *
 * Horizon returns 7 decimals ("1.2000000") while the chain helpers format 4,
 * so a log fed from both sources would show the same value two ways. Four is
 * enough to read a $0.03 reward and short enough to scan.
 */
export function formatAmount(amount: string | undefined, decimals = 4): string | undefined {
  if (amount === undefined) return undefined;
  const value = Number(amount);
  if (!Number.isFinite(value)) return amount;
  return value.toFixed(decimals);
}

/** Oldest first, so the finished log reads as the demo's narrative. */
export function sortEntries(entries: LogEntry[]): LogEntry[] {
  return [...entries].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
