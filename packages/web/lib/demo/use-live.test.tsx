import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RefreshProvider } from './refresh';
import { useLive } from './use-live';

/**
 * The regression: the reader lives in a ref, so the effect cannot see what it
 * closes over. When the console learned its campaign id from the validator —
 * which happens on every load, after the first read — the advertiser panel
 * kept showing campaign 0's budget under a header naming campaign 7, for a
 * whole poll interval. On the one panel whose job is to be checked.
 */
function Probe({ read }: { read: (id: number) => Promise<string> }) {
  const [id, setId] = useState(0);
  const { data, loading } = useLive(() => read(id), { key: id, pollMs: 0 });

  return (
    <div>
      <button type="button" onClick={() => setId(7)}>
        switch
      </button>
      <output>{loading ? 'loading' : (data ?? 'nothing')}</output>
    </div>
  );
}

describe('useLive', () => {
  it('reads again as soon as its key changes', async () => {
    const read = vi.fn(async (id: number) => `campaign ${id}`);

    render(
      <RefreshProvider>
        <Probe read={read} />
      </RefreshProvider>,
    );

    expect(await screen.findByText('campaign 0')).toBeInTheDocument();

    screen.getByRole('button', { name: 'switch' }).click();

    // Never the old campaign's answer under the new campaign's id: the
    // previous value is dropped rather than shown while the new one loads.
    await waitFor(() => expect(screen.getByText('campaign 7')).toBeInTheDocument());
    expect(read).toHaveBeenLastCalledWith(7);
  });

  it('shows no stale answer while the new one is in flight', async () => {
    let release: (value: string) => void = () => {};
    const read = vi.fn((id: number) =>
      id === 0
        ? Promise.resolve('campaign 0')
        : new Promise<string>((resolve) => {
            release = resolve;
          }),
    );

    render(
      <RefreshProvider>
        <Probe read={read} />
      </RefreshProvider>,
    );
    expect(await screen.findByText('campaign 0')).toBeInTheDocument();

    screen.getByRole('button', { name: 'switch' }).click();

    await waitFor(() => expect(screen.getByText('loading')).toBeInTheDocument());
    expect(screen.queryByText('campaign 0')).not.toBeInTheDocument();

    release('campaign 7');
    await waitFor(() => expect(screen.getByText('campaign 7')).toBeInTheDocument());
  });
});
