# lib/log

The shared transaction log that sits at the bottom of the demo page (#17):
time, action, actor, shortened hash, every hash linking to Stellar Expert.

No React, no Next.js — a component subscribes, this does not know about one.
Safe to keep in place while `packages/web` is scaffolded around it.

## Two sources, because neither is complete

The validator records what it does: `settle`, `reward`, `convert`, `flag`,
`clawback`, `refund`. It never sees the rest. Opening a campaign, withdrawing a
publisher claim and closing a campaign are signed by the advertiser and the
publisher and go straight to the escrow, so three of the demo's eight steps
would be missing from `GET /events` alone.

So panels that call the escrow directly record their own rows with
`log.record(...)`, and `log.pull(labels)` folds in the validator's. Both leave
`normalize.ts` in the same shape, deduplicated by transaction hash — polling
never doubles a row.

## Persistence

Rows are kept in `sessionStorage` for the length of the demo. The validator
holds its events in memory, so without this a restart mid-presentation would
erase the first half of the log. Every storage access is guarded: a private
window, blocked site data or a quota error degrades to an in-memory log rather
than an error.

## Details that matter on screen

- **Rows without a hash are still rows.** Flagging a player who already
  converted produces no transaction — there is nothing left to claw back. The
  row renders with its note instead of a link, because that outcome is part of
  the story the demo tells.
- **One decimal convention.** Horizon returns 7 decimals, the chain helpers
  format 4. Unnormalised, the same amount appears two ways in one column.
- **Unknown kinds are dropped, not rendered.** A validator that learns a new
  event type should not put a blank row on screen mid-demo.

## Verified

A simulated full demo run produces **9 rows**, all carrying a hash and an
explorer link, in demo order: campaign → signup → settle → reward → convert →
publisher withdrawal → clawback → refund → close.
