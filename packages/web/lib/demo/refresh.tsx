'use client';

/**
 * The refresh signal.
 *
 * The panels keep no local state: after any action, everything re-reads from
 * the chain rather than patching a number optimistically (#13). One shared
 * counter is how an action in one panel makes the other three re-read, which
 * is what makes the balances on screen the claim itself rather than a
 * rendering of it.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface RefreshValue {
  version: number;
  refresh: () => void;
}

const RefreshContext = createContext<RefreshValue>({ version: 0, refresh: () => {} });

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, refresh }), [version, refresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export const useRefresh = () => useContext(RefreshContext);
