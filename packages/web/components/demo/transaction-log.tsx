'use client';

/**
 * The shared log (#17). Without a visible hash the auditability claim is just
 * words, so every row that has one links to Stellar Expert.
 */
import { useEffect, useState } from 'react';

import { shortHash } from '@/lib/log/normalize';
import { transactionLog } from '@/lib/log/store';
import type { LogEntry } from '@/lib/log/types';
import { fetchPlayers } from '@/lib/demo/validator';

export function TransactionLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = transactionLog.restore().subscribe(setEntries);

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    // Labels come from the coalesced player fetch the panels already make, so
    // the log does not add a third identical request on every poll.
    const pull = async () => {
      try {
        const players = await fetchPlayers();
        const labels = Object.fromEntries(players.map((p) => [p.publicKey, p.label]));
        if (alive) await transactionLog.pull(labels);
        failures = 0;
      } catch {
        // The validator being down is a normal state; back off rather than
        // retrying into a dead port four times a second.
        failures += 1;
      }
      if (!alive) return;
      timer = setTimeout(() => void pull(), 4000 * Math.min(2 ** failures, 8));
    };

    void pull();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <section
      className="rounded-lg border p-4"
      style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Transaction log</h2>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={() => transactionLog.clear()}
            className="text-[12px] underline underline-offset-2"
            style={{ color: 'var(--muted)' }}
            title="Rows survive a reload on purpose. Clear them between a rehearsal and the real run."
          >
            Clear
          </button>
        ) : null}
      </header>

      {entries.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          Every action appears here with the transaction that proves it.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-[13px]">
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th className="text-left font-normal">Time</th>
                <th className="text-left font-normal">Action</th>
                <th className="text-left font-normal">Actor</th>
                <th className="text-right font-normal">Amount</th>
                <th className="text-right font-normal">Proof</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="numeric py-1 pr-2 whitespace-nowrap">
                    {entry.at.slice(11, 19)}
                  </td>
                  <td className="py-1 pr-2">{entry.action}</td>
                  <td className="py-1 pr-2">{entry.actor}</td>
                  <td className="numeric py-1 pr-2 text-right">{entry.amount ?? '—'}</td>
                  <td className="mono py-1 text-right whitespace-nowrap">
                    {entry.url ? (
                      <a
                        className="underline underline-offset-2"
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortHash(entry.hash ?? '')}
                      </a>
                    ) : (
                      <span title={entry.note} style={{ color: 'var(--muted)' }}>
                        {entry.note ? 'no transaction' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
