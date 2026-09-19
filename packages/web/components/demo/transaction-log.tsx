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
    <section className="dlog">
      <header className="dlog__head">
        <h2>Transaction log</h2>
        <small>
          {entries.length > 0
            ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}, oldest first`
            : 'every action, with the transaction that proves it'}
        </small>
        {entries.length > 0 ? (
          <button
            type="button"
            className="dlog__clear"
            onClick={() => transactionLog.clear()}
            title="Rows survive a reload on purpose. Clear them between a rehearsal and the real run."
          >
            Clear
          </button>
        ) : null}
      </header>

      {entries.length === 0 ? (
        <p className="dlog__empty">
          Nothing yet. Complete a task in the player panel and the settlement
          will appear here with its hash.
        </p>
      ) : (
        <div className="dlog__scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th className="right">Amount</th>
                <th className="right">Proof</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="numeric mono" style={{ color: 'var(--muted)' }}>
                    {entry.at.slice(11, 19)}
                  </td>
                  <td>{entry.action}</td>
                  <td style={{ fontWeight: 700 }}>{entry.actor}</td>
                  <td className="right numeric">{entry.amount ?? '—'}</td>
                  <td className="right">
                    {entry.url ? (
                      <a
                        className="dlog__hash mono"
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortHash(entry.hash ?? '')}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--muted)' }} title={entry.note}>
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
