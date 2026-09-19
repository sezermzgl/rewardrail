'use client';

/**
 * Read something once, again whenever the refresh signal fires, and on a timer
 * so a balance moved by another actor still appears.
 *
 * Errors are surfaced rather than swallowed. A panel that silently shows a
 * stale number during a demo is worse than one that says it could not read.
 *
 * A failing read backs off. The validator is not always running — the two
 * chain-backed panels work without it — and a three-second retry against a
 * dead port fills the console with hundreds of errors, which is exactly what
 * nobody wants behind them when a judge opens dev tools.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRefresh } from './refresh';

export interface Live<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

const MAX_BACKOFF_FACTOR = 10;

export function useLive<T>(
  read: () => Promise<T>,
  { pollMs = 10_000 }: { pollMs?: number } = {},
): Live<T> {
  const { version } = useRefresh();
  const [state, setState] = useState<Live<T>>({ data: null, error: null, loading: true });

  // Keeping the reader in a ref lets a caller pass an inline arrow function
  // without the effect resubscribing on every render.
  const readRef = useRef(read);
  readRef.current = read;

  const failuresRef = useRef(0);

  const run = useCallback(async (alive: () => boolean) => {
    try {
      const data = await readRef.current();
      failuresRef.current = 0;
      if (alive()) setState({ data, error: null, loading: false });
    } catch (err) {
      failuresRef.current += 1;
      if (alive()) {
        setState((prev) => ({
          data: prev.data,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const alive = () => mounted;

    const tick = async () => {
      await run(alive);
      if (!mounted || pollMs <= 0) return;
      const factor = Math.min(2 ** failuresRef.current, MAX_BACKOFF_FACTOR);
      timer = setTimeout(() => void tick(), pollMs * factor);
    };

    void tick();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [run, version, pollMs]);

  return state;
}
