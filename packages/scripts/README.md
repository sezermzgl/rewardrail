# @rewardrail/scripts

Everything that sets up testnet, and everything that proves the design's
riskiest assumptions actually hold. These are not tests against mocks — each
one runs against Stellar testnet and either succeeds or tells you why not.

## Setup, in order

```bash
npm run bootstrap        # accounts, issuer flags, and the checks that they are set
npm run issue-assets     # TUSDC and its SAC — the no-anchor fallback path
npm run signup           # two sponsored players, holding zero XLM
npm run deploy-escrow    # builds and deploys the contract, writes deployed.json
npm run use-anchor-asset # trustlines, the SAC, and a campaign funded in USDC
```

`bootstrap` is idempotent: rerunning reuses `keys.json` rather than orphaning
a configured issuer. Secrets land in `keys.json` and `players.json`, both
gitignored, and contract ids land in `deployed.json`, which is tracked so the
web app and the validator cannot drift from the live deployment.

**Step order is not cosmetic.** A trustline takes its clawback status from the
issuer's flags at the moment it is created, and setting the flag afterwards
does not reach trustlines that already exist. Get it wrong and every reward is
permanently unreclaimable. `bootstrap` sets the flags first and reads them
back before anything is allowed to trust the asset.

## The proofs

```bash
npm run prove-clawback    # clawback works — and fails when the flags came late
npm run prove-auth-lock   # a frozen reward cannot be moved to a second account
npm run prove-sac-admin   # what moving a SAC admin does and does not break
npm run e2e               # the whole flow end to end, with assertions
```

`prove-auth-lock` is the one to run in front of a sceptic. It performs the
bypass attack on the clawback window: pay a reward, freeze it, then try to
forward it out of reach. The transfer is rejected with
`op_src_not_authorized`, the second account receives nothing, and clawback
still reaches the frozen reward. Without that, the window would be our
service's promise rather than the ledger's.

`prove-clawback` demonstrates both outcomes of the flag-ordering trap, which
is how that trap came to be documented rather than discovered on demo night.

## Funding a campaign

Three routes, in order of how real they are:

| Route | Command | Notes |
| --- | --- | --- |
| Swap XLM through Soroswap | `POST /advertiser/fund {"xlm":250}` on the validator | A real swap against real testnet liquidity |
| TRY bank transfer through the anchor | `npm run fund-from-anchor` | Written and working up to the anchor's payout leg, which currently stalls |
| Circle faucet | [faucet.circle.com](https://faucet.circle.com) | 20 USDC per request, for when you just need funds |

## Rehearsal

```bash
VALIDATOR=https://rewardrail.vercel.app/api/validator npm run rehearse
```

Runs the eight-step demo script end to end, reads every hash back from Horizon
to confirm it resolved and succeeded, and rewrites
[`docs/04-demo-rehearsal.md`](../../docs/04-demo-rehearsal.md) with the
results — keeping the hand-written analysis sections it does not own.

Pointed at the deployed URL rather than a local validator, the hashes are
evidence that the *published site* works, not that the code does: every call
goes through the same proxy, the same write key and the same container a
visitor's browser reaches.

Re-running opens a new campaign and new player accounts, so it never spends
the one the public console points at.

## The JS boundary

`src/soroban.js` wraps contract calls over Soroban RPC for this package;
`packages/validator/src/chain.js` does the same job for the service, with
config and key handling attached. Both exist on purpose — this one is
standalone.

The SDK has to be `@stellar/stellar-sdk` 17 or newer. Version 13 cannot parse
protocol 28 Soroban RPC responses at all and fails every contract call with
`Bad union switch: 4`, while classic operations keep working, which is why
nothing breaks until the first RPC call.
