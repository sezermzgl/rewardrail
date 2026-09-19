# lib/chain

Reads RewardRail's state directly from Stellar. No React, no Next.js, no
framework imports — only `@stellar/stellar-sdk`. It is safe to keep in place
while `packages/web` is scaffolded around it.

Why it exists: the panels keep no local state and refetch after every action,
because a balance that came from the chain is the auditability claim itself
(#13). Reading through the validator would make that claim second-hand.

## Reads are simulations, not transactions

Every contract read goes through `simulateTransaction`. A simulation needs no
signature, no fee and no sequence number, and returns in one round trip, so a
panel can refetch as often as it likes. `packages/scripts/src/e2e.js` reads by
submitting real transactions — correct for a script that runs once, wrong for a
UI that refetches after every action.

## Configuration

Reads `NEXT_PUBLIC_ESCROW_CONTRACT_ID` and `NEXT_PUBLIC_TUSDC_SAC_ID`; the
network defaults to testnet so a panel renders without a `.env`. Current ids
live in `packages/scripts/deployed.json`.

## What the chain cannot answer

`getCampaignView` returns what is exact. Two numbers the advertiser panel (#14)
asks for are not derivable from chain state:

- **Spend so far.** `open_campaign` takes a budget, transfers it, and stores
  only `remaining`. The original budget is gone.
- **This campaign's escrow balance.** One contract carries every campaign, so
  its token balance is a total across all of them.

Verified on testnet against campaign 0: `remaining` 96.0000 while the contract
held 403.8000 TUSDC. Recorded as F4 in `docs/03-contract-interface.md`.
