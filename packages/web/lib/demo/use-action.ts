'use client';

/**
 * Running one panel action.
 *
 * Every action ends with a refresh rather than a local update, because the
 * panels claim their numbers come from the chain. The button is disabled while
 * it runs so a double click cannot spend the budget twice, and a refusal is
 * kept on screen — the interesting ones, like a conversion refused because the
 * window is still open, are the demo's argument rather than a malfunction.
 */
import { useCallback, useState } from 'react';

import { useRefresh } from './refresh';

export interface ActionState {
  run: () => void;
  pending: boolean;
  error: string | null;
}

export function useAction(action: () => Promise<unknown>): ActionState {
  const { refresh } = useRefresh();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    if (pending) return;
    setPending(true);
    setError(null);

    void (async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(false);
        refresh();
      }
    })();
  }, [action, pending, refresh]);

  return { run, pending, error };
}
