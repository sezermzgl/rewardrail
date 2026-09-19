/**
 * The shared transaction log.
 *
 * Holds every row the demo produces, from both sources, deduplicated and in
 * order. Survives a page reload and a validator restart, because #17 asks for
 * the whole flow to be readable in one list at the end — and the validator
 * keeps its events in memory, so a restart would otherwise erase the demo's
 * first half.
 *
 * No framework imports: a component subscribes, this does not know about one.
 */
import { config } from '../chain/config';
import { fromLocalAction, fromValidatorEvent, sortEntries } from './normalize';
import type { LocalEntryInput, LogEntry, ValidatorEvent } from './types';

type Listener = (entries: LogEntry[]) => void;

const STORAGE_KEY = 'rewardrail.transaction-log';

/**
 * Storage can be absent, full, or throw outright in a private window, and the
 * log is a convenience rather than the source of truth — so every access is
 * guarded and a failure is silent.
 */
function readStored(): LogEntry[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStored(entries: LogEntry[]): void {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* a log that cannot persist is still a log */
  }
}

export class TransactionLog {
  private entries = new Map<string, LogEntry>();
  private listeners = new Set<Listener>();

  /** Reload what a previous page view left behind. Safe to call more than once. */
  restore(): this {
    for (const entry of readStored()) this.entries.set(entry.id, entry);
    return this;
  }

  all(): LogEntry[] {
    return sortEntries([...this.entries.values()]);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.all());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Record something a panel did itself, and return the row it produced. */
  record(input: LocalEntryInput): LogEntry {
    const entry = fromLocalAction(input);
    this.merge([entry]);
    return entry;
  }

  /**
   * Fetch the validator's events and fold them in.
   *
   * Returns how many rows were new, so a caller can decide whether anything
   * is worth reacting to. A validator that is down is not an error the log
   * should raise: the panels that call the escrow directly keep working, and
   * their rows are already here.
   */
  async pull(labels: Record<string, string> = {}): Promise<number> {
    let events: ValidatorEvent[];
    try {
      const res = await fetch(`${config.validatorUrl}/events`);
      if (!res.ok) return 0;
      events = (await res.json()) as ValidatorEvent[];
    } catch {
      return 0;
    }

    const rows: LogEntry[] = [];
    for (const event of events) {
      const entry = fromValidatorEvent(event, labels);
      if (entry) rows.push(entry);
    }
    return this.merge(rows);
  }

  /** Fold rows in, keeping the first version of any id already held. */
  private merge(rows: LogEntry[]): number {
    let added = 0;
    for (const row of rows) {
      if (this.entries.has(row.id)) continue;
      this.entries.set(row.id, row);
      added += 1;
    }
    if (added > 0) this.emit();
    return added;
  }

  /** Only between demo runs. The log is meant to accumulate, not to reset. */
  clear(): void {
    this.entries.clear();
    this.emit();
  }

  private emit(): void {
    const snapshot = this.all();
    writeStored(snapshot);
    for (const listener of this.listeners) listener(snapshot);
  }
}

/** The app has one log; every panel writes into the same list. */
export const transactionLog = new TransactionLog();

/** Player display names, so rows read "honest player" rather than an address. */
export async function fetchPlayerLabels(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${config.validatorUrl}/players`);
    if (!res.ok) return {};
    const players = (await res.json()) as Array<{ publicKey: string; label: string }>;
    return Object.fromEntries(players.map((p) => [p.publicKey, p.label]));
  } catch {
    return {};
  }
}
