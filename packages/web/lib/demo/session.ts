/**
 * The accounts this browser signed in as.
 *
 * The validator's player list is everything it has ever seen. On the deployed
 * service that includes every account a scripted rehearsal left behind —
 * eleven of them at one point, nine with no balance and no completed task. A
 * console that renders a card for each of them has stopped being a console,
 * and a visitor cannot tell which row is theirs.
 *
 * So the panels show the demo set: the two seeded accounts a walkthrough
 * follows, plus whoever signed in here. This is the "plus" half. It lives in
 * `localStorage` rather than in React state because two panels need it and it
 * should survive the reload that a mid-demo mistake tends to produce.
 *
 * No framework imports: a component subscribes, this does not know about one.
 */

const STORAGE_KEY = 'rewardrail.session-players';

type Listener = (players: string[]) => void;

const listeners = new Set<Listener>();

/**
 * Storage throws outright in a private window and the session list is a
 * convenience rather than the source of truth, so every access is guarded and
 * a failure leaves the console showing the seeded pair alone.
 */
function read(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function write(players: string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(players));
  } catch {
    /* a session list that cannot persist is still a session list */
  }
}

export const sessionPlayers = {
  all: read,

  /** Remember an account this browser just signed in as. */
  add(publicKey: string): void {
    const current = read();
    if (current.includes(publicKey)) return;
    const next = [...current, publicKey];
    write(next);
    for (const listener of listeners) listener(next);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    listener(read());
    return () => {
      listeners.delete(listener);
    };
  },
};

/**
 * The accounts the walkthrough follows, seeded from `players.json`.
 *
 * One honest and one fraudulent: clawback only reaches a reward that has not
 * been converted, so the pair is what demonstrates fraud protection and user
 * protection in the same run.
 */
export const SEEDED_LABELS = ['honest', 'fraudster'];

/**
 * Narrow a validator player list down to the ones worth a card.
 *
 * Everything else is counted, never dropped — a panel that quietly hides
 * accounts would be a strange thing to ship next to an audit trail — and the
 * console offers a toggle to show the lot.
 */
export function demoPlayers<T extends { publicKey: string; label: string }>(
  all: T[],
  signedIn: string[],
): { shown: T[]; hidden: number } {
  const keep = new Set(signedIn);
  const shown = all.filter(
    (player) => SEEDED_LABELS.includes(player.label) || keep.has(player.publicKey),
  );
  return { shown, hidden: all.length - shown.length };
}

/* ------------------------------------------------------------------ *
 * The player app's own account
 * ------------------------------------------------------------------ */

/**
 * Who is holding the phone at /play.
 *
 * Without this the app showed whichever account the service happened to list
 * first, so every visitor shared one balance and one clawback window — and a
 * reward somebody else had just earned sat there looking like theirs. The
 * email is kept alongside the address so a reload signs back into the same
 * account rather than opening a second one.
 *
 * It is an external store rather than component state because the page is
 * prerendered: the server has no `localStorage`, so the account can only
 * arrive after hydration, and `useSyncExternalStore` is how React is told
 * that without a cascade of effects.
 */
export interface PlayAccount {
  email: string;
  player: string;
}

const ACCOUNT_KEY = 'rewardrail.play-account';

/**
 * Cached because `getSnapshot` must return the same reference until something
 * actually changes; parsing on every call would re-render forever.
 */
let account: PlayAccount | null | undefined;
const accountListeners = new Set<() => void>();

function loadAccount(): PlayAccount | null {
  try {
    const raw = globalThis.localStorage?.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'player' in parsed && 'email' in parsed) {
      return parsed as PlayAccount;
    }
    return null;
  } catch {
    return null;
  }
}

export const playAccount = {
  subscribe(listener: () => void): () => void {
    accountListeners.add(listener);
    return () => {
      accountListeners.delete(listener);
    };
  },

  get(): PlayAccount | null {
    if (account === undefined) account = loadAccount();
    return account;
  },

  /** The server has no storage, so there is nobody signed in yet. */
  getServer(): PlayAccount | null {
    return null;
  },

  set(next: PlayAccount | null): void {
    account = next;
    try {
      if (next) globalThis.localStorage?.setItem(ACCOUNT_KEY, JSON.stringify(next));
      else globalThis.localStorage?.removeItem(ACCOUNT_KEY);
    } catch {
      /* a private window can still play; it signs in again next time */
    }
    for (const listener of accountListeners) listener();
  },
};
