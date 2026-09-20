# @rewardrail/validator

The service that decides. It signs action proofs, sets risk tiers, pays and
freezes rewards, drives the clawback chain and talks to the anchor.

It holds no campaign funds. The escrow only pays what the contract itself
computes, so a stolen validator key can misdirect a payout but cannot change
its size or drain a budget.

Deployed at `rewardrail-validator.onrender.com`.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/health` | Config, the demo campaign id, and whether writes are guarded |
| GET | `/players` | Every account with balances, tier and clawback state |
| GET | `/events` | The append-only feed the console's transaction log reads |
| GET | `/campaign/:id` | Campaign state, straight from the contract |
| POST | `/player/signup` | Opens a sponsored account from an email address |
| POST | `/action/complete` | Settles an action and pays the reward, frozen |
| POST | `/player/convert` | Burns the reward and redeems the escrowed payout |
| POST | `/player/reconcile` | Pays a reward `settle` recorded but never delivered |
| POST | `/fraud/flag` | Claws the reward back and refunds the campaign |
| POST | `/publisher/withdraw` | Pulls a publisher's accrued share |
| POST | `/campaign/open` · `/campaign/close` | The advertiser's two calls |
| GET | `/advertiser/quote` · POST `/advertiser/fund` | Soroswap, XLM into the payout asset |
| GET | `/anchor` · POST `/player/cashout` · GET `/player/cashout/:id` | The exit to a bank account |

## Two things worth understanding

**A reward is paid and frozen in one transaction.** Three operations by the
issuer — authorize the trustline, send, revoke — so there is no moment where
the reward is both received and transferable. Split across transactions, the
clawback window would be advisory: a player could forward the reward to a
second account and convert from there.

**The tier gate is off chain and the freeze is on chain, and they guard
different parties.** `/player/convert` checks the tier, which the platform
could in principle stall; the trustline's authorization state is the ledger's
own answer and the player cannot get around it. Since the in-memory clock is
lost on a restart, the tier is reconciled against that trustline before any
conversion — otherwise the panel offers a cash-out the burn then refuses.

## Running it

```bash
npm start        # or: npm run dev, which restarts on change
```

Keys load from `packages/scripts/keys.json`, `players.json` and
`deployed.json`, so run the setup in `packages/scripts` first. A stateless
host has no such files: `VALIDATOR_KEYS`, `VALIDATOR_PLAYERS` and
`VALIDATOR_DEPLOYED` each take the same JSON, and the files stay as the
fallback so local development needs no exports.

```bash
ANCHOR_HOME_DOMAIN=tr-mock-anchor.fly.dev ANCHOR_ASSET_CODE=USDC \
PAYOUT_ASSET_CODE=USDC PAYOUT_ASSET_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
DEMO_CAMPAIGN_ID=7 npm start
```

Every tunable is in [`.env.example`](../../.env.example);
`CLAWBACK_WINDOW_SECONDS` shortens the window for a walkthrough and defaults
to 60.

## Before it goes on a public URL

**Writes need a key.** Every POST moves money or reverses it, and this service
holds the REWARD issuer key, so an open write endpoint on a public host is
somebody else's demo to end. `WRITE_SECRET` turns on a check for an
`x-rewardrail-key` header on POST routes; reads stay open, because balances
and campaign state are public on chain anyway and the panels should work for
anyone handed the link. It fails closed: with `NODE_ENV=production` and no
secret, the service refuses to start rather than publishing an open write
surface by omission.

The web app attaches that header server-side, in
`packages/web/app/api/validator/[...path]/route.ts`. A guard whose key ships
in the browser bundle is decoration.

**It is not serverless, on purpose.** Player records, the tier clock and the
event feed live in memory, and a signup writes its custodial key to disk —
none of which survives an instance that comes and goes between requests. On a
free instance type the container still stops after fifteen minutes idle, so
the first request after a quiet spell pays about a minute for the cold start.

## What production would change

Player keys are custodial and held here, which is deliberate — a rewarded-ads
user is not a crypto user, and handing them a seed phrase produces nothing but
user loss in this segment. But in a hackathon they live in memory and a JSON
file. Production means a KMS, for these and for the issuer key, and that is
the same caveat as the environment variables above, for the same reason.
