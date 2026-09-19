# @rewardrail/web

Next.js App Router, TypeScript, Tailwind. Two routes:

| Route | What it is |
| --- | --- |
| `/` | Placeholder. The landing page specified in `docs/superpowers/specs/2026-09-19-rewardrail-landing-design.md` replaces `app/page.tsx`. |
| `/demo` | The four-panel testnet demo (#13). |

```bash
npm run dev --workspace @rewardrail/web     # http://localhost:3000/demo
```

## The demo route

Four panels on one page — advertiser, player, publisher, operator — with the
shared transaction log beneath them. One page on purpose: switching pages
breaks the flow and scatters the judges' attention.

**The panels keep no local state.** Every figure is re-read rather than patched
optimistically, because a balance that came from the chain is the auditability
claim itself. `lib/demo/refresh.tsx` carries one counter; an action in any panel
makes all four re-read.

### Two sources, on purpose

| Panel | Reads from | Works without the validator |
| --- | --- | --- |
| Advertiser | Escrow contract, via Soroban RPC | Yes |
| Publisher | Escrow contract, via Soroban RPC | Yes |
| Player | Validator — tier and window are off-chain by design | No |
| Operator | Validator — risk signals are off-chain by design | No |

The tier rule is a business rule that changes far more often than the contract,
which is why it is not on chain. So the two chain-backed panels stay live with
no backend running, and the other two say so rather than showing nothing.

A failing read backs off rather than retrying every three seconds into a dead
port, and the player list is coalesced so three components asking at once
produce one request.

## Configuration

Contract ids default to `packages/scripts/deployed.json`, which the setup
scripts write and the repo tracks, so the panels point at the current
deployment with nothing to configure. Override with `NEXT_PUBLIC_ESCROW_CONTRACT_ID`,
`NEXT_PUBLIC_TUSDC_SAC_ID`, `NEXT_PUBLIC_VALIDATOR_URL`, `NEXT_PUBLIC_CAMPAIGN_ID`.

## Libraries

`lib/chain` and `lib/log` import no framework and are documented separately.
