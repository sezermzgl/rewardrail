# @rewardrail/web

Next.js App Router application carrying all three product surfaces.

| Route | What it is |
| --- | --- |
| `/` | The product case. Links straight through to the two below |
| `/play` | The player's rewards app: sign in by email, five playable games, a payout to a bank account |
| `/demo` | Four-panel settlement console — advertiser, player, publisher, operator — with a shared transaction log |

## Run locally

From the repository root:

```bash
npm install
npm run dev -w @rewardrail/web
```

The panels reach the validator through `/api/validator/*` on this app, so
point that at wherever it is running:

```bash
VALIDATOR_ORIGIN=http://localhost:8787 npm run dev -w @rewardrail/web
VALIDATOR_WRITE_SECRET=…   # needed for writes once the validator is guarded
```

## Verify

```bash
npm run test -w @rewardrail/web       # 55 tests
npm run lint -w @rewardrail/web
npm run typecheck -w @rewardrail/web
npm run build -w @rewardrail/web
```

## Why the validator is proxied

It sends no CORS headers, so a browser refuses to call it cross-origin. It
used to be a rewrite in `next.config.ts`, which was enough while the service
was open; it is a route handler now, because the write routes need an
`x-rewardrail-key` header and a rewrite cannot add one. The secret is read
from a variable with no `NEXT_PUBLIC_` prefix and never reaches the browser —
a guard whose key ships in the bundle is decoration. Same-origin also means
the panel POSTs never trigger a preflight.

## How the screens get their numbers

The panels keep no local state. Everything re-reads after every action,
because a balance that came from the chain is the auditability claim itself
rather than a rendering of it.

- `lib/chain` — reads the escrow through `simulateTransaction`: no signature,
  no fee, one round trip, so a panel can refetch freely
- `lib/demo` — the validator's side (player identity, risk tier, the clawback
  window), the writes, and the shared refresh signal
- `lib/log` — the transaction log, which survives a reload *and* a validator
  restart, so the whole flow is readable in one list at the end

Contract ids default to `packages/scripts/deployed.json`, which the setup
scripts write and the repo tracks, so no screen can drift from the live
deployment. `NEXT_PUBLIC_ESCROW_CONTRACT_ID`, `NEXT_PUBLIC_PAYOUT_SAC_ID`,
`NEXT_PUBLIC_VALIDATOR_URL` and `NEXT_PUBLIC_CAMPAIGN_ID` override them.

## Two constraints the tests hold

**The player's screens never say wallet, seed, private key, gas, transaction
fee or blockchain.** That is the visual proof of the whole design claim — a
rewarded-ads user is not a crypto user — and a word slipping in during a later
edit would quietly falsify it. `components/demo/player-panel.test.ts` scans
the source for them.

**Every call to action on the landing reaches something that runs.** They all
used to scroll to a mock panel on the same page, so the landing shipped
without a single route to `/demo` or `/play`. The figures in that mock are now
one recorded testnet run, and its hashes have to resolve in Stellar Expert.

## Deployment

The Vercel project is not connected to the repository, so the site does not
track `main`. It updates when someone runs `vercel deploy --prod`. Anything
that changes this package has to be deployed by hand, or the URL a visitor is
holding stays on the previous build.

## More

- [`components/games/README.md`](components/games/README.md) — adding a game to the offerwall
- [`lib/chain/README.md`](lib/chain/README.md) — the read layer
- [`lib/log/README.md`](lib/log/README.md) — the shared transaction log
