# @rewardrail/contracts

The escrow. A Soroban contract in Rust that holds an advertiser's campaign
budget and releases it only against an action proof signed by that campaign's
validator.

Deployed on Stellar testnet as
[`CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI`](https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI).

## What it enforces

The contract does not know whether anybody played a game. That decision stays
with the validator, off chain. What it guarantees is the part the platform
must not be able to bend:

- The budget cannot move without a proof signed by the campaign's validator key
- Share ratios cannot deviate from the table the advertiser approved, because
  no function changes that table
- One action is paid at most once
- Unspent budget returns to the advertiser

The amount is never taken from the proof. It is derived from `per_action` and
the publisher's row in `splits`, so a stolen validator key can misdirect a
payout but cannot change its size.

## Surface

```
open_campaign(advertiser, platform, token, validator, per_action, budget, splits) -> u64
settle(campaign_id, player, publisher, action_id, signature)                      -> ()
withdraw(campaign_id, who)                                                        -> i128
redeem_player(campaign_id, player)                                                -> i128
refund_clawback(campaign_id, player)                                              -> i128
close_campaign(campaign_id)                                                       -> i128
get_campaign(campaign_id)  claim_of(campaign_id, who)  reserve_of(campaign_id, player)
is_settled(action_id)
```

`settle` takes no authorization: the ed25519 proof *is* the authorization, so
anyone may relay a valid one and simply pays the fee.

Two things are easy to get wrong and are written up in
[`docs/03-contract-interface.md`](../../docs/03-contract-interface.md):

**The proof digest.** `SHA256(campaign_id_be_u64 || player_xdr || publisher_xdr
|| action_id)`, where the addresses are `Address::to_xdr` — the XDR of an
ScVal wrapping an ScAddress, not a bare ScAddress and not the raw ed25519 key.
A wrong layout produces a signature that verifies nowhere and an error that
says nothing.

**Claims and reserves are different things.** A claim is withdrawable by its
owner; a player's payout is owed against a REWARD token they still hold, so it
lives under `Reserve` and leaves only through `redeem_player`, which only the
platform can call and which can only pay the player it belongs to. Without the
split a player could withdraw the escrowed value and keep the reward — the
same money twice.

## Build and test

Needs Rust with the `wasm32v1-none` target and the
[`stellar` CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli).

```bash
cargo test                                   # 15 tests
cargo build --target wasm32v1-none --release
```

Deployment goes through `packages/scripts`:

```bash
cd ../scripts && npm run deploy-escrow       # builds, deploys, writes deployed.json
```

The test worth knowing about is
`escrow_balance_always_covers_remaining_plus_everything_owed`: it asserts the
invariant directly, that the contract's token balance always equals
`remaining` plus every open claim and reserve. It is what caught the clawback
refund trusting its caller for an amount.
