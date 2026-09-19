'use client';

/**
 * The most recent transaction behind a panel's numbers.
 *
 * Each panel ends with a proof strip, and an empty one would be decoration.
 * The shared log already holds every hash the demo has produced, so a panel
 * asks it for the kinds of event it is responsible for and shows the latest.
 */
import { useEffect, useState } from 'react';

import { shortHash } from '@/lib/log/normalize';
import { transactionLog } from '@/lib/log/store';
import type { LogEntry, LogKind } from '@/lib/log/types';

export interface Proof {
  hash: string;
  short: string;
  url: string;
}

export function useLatestProof(kinds: LogKind[]): Proof | null {
  const [proof, setProof] = useState<Proof | null>(null);
  const key = kinds.join(',');

  useEffect(() => {
    const wanted = new Set(key.split(',') as LogKind[]);

    const pick = (entries: LogEntry[]) => {
      // Entries are oldest first, so the last match is the most recent.
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (wanted.has(entry.kind) && entry.hash && entry.url) {
          setProof({ hash: entry.hash, short: shortHash(entry.hash), url: entry.url });
          return;
        }
      }
      setProof(null);
    };

    return transactionLog.subscribe(pick);
  }, [key]);

  return proof;
}
