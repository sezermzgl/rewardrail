# Contract Interface

*What the escrow actually exposes, and what the validator (#9–#12) must match.*

The escrow shipped in `d0779be`, so this is no longer a proposal. It records the
interface as built, the three places the original proposal was resolved
differently, and the findings that are still open against it.

Read `02-technical-spec.md` for intent. Where the two disagree, the contract wins.

---

## 1. The proof message — the one place a mistake costs hours

The spec describes the signed message as raw 32-byte addresses. **The contract
does not do that.** `proof_message` builds:

```
SHA256( campaign_id as big-endian u64
      || Address::to_xdr(player)
      || Address::to_xdr(publisher)
      || action_id (32 bytes) )
```

`Address::to_xdr` is `soroban-sdk`'s serialization of the `Val` representation,
which is the XDR of an **ScVal wrapping an ScAddress** — not a bare ScAddress,
and not the raw ed25519 key. In JavaScript the matching form is:

```js
xdr.ScVal.scvAddress(Address.fromString(publicKey).toScAddress()).toXDR()
```

`e2e.js` already contains this and calls it "the one line worth being careful
about". It is right: a wrong layout produces a signature that verifies nowhere
and an error that says nothing useful.

The campaign's `validator` field is different again — there the ed25519 public
key genuinely is raw 32 bytes, passed as hex.

| Value | Form |
| --- | --- |
| `campaign_id` in the digest | big-endian u64, 8 bytes |
| `player` / `publisher` in the digest | ScVal-wrapped ScAddress XDR |
| `action_id` | raw 32 bytes |
| `Campaign.validator` | raw 32-byte ed25519 key |
| `signature` | raw 64 bytes |

## 2. Functions as built

```
open_campaign(advertiser, platform, token_address, validator, per_action, budget, splits) -> u64
settle(campaign_id, player, publisher, action_id, signature)                              -> ()
withdraw(campaign_id, who)                                                                -> i128
refund_clawback(campaign_id, player, amount)                                              -> ()
close_campaign(campaign_id)                                                               -> i128
get_campaign(campaign_id)                                                                 -> Campaign
claim_of(campaign_id, who)                                                                -> i128
is_settled(action_id)                                                                     -> bool
```

Auth: `open_campaign` needs the advertiser, `withdraw` needs `who`,
`refund_clawback` needs the campaign's `platform`, `close_campaign` needs the
advertiser. **`settle` requires no auth at all** — the ed25519 proof is the
authorization, so anyone may relay a valid one and simply pays the fee. In
`e2e.js` the sponsor relays.

`settle` accrues **all three shares as claims**, including the player's. The
player is not special: they `withdraw` TUSDC the same way the publisher does.
Rounding dust goes to the publisher, who takes `per_action` minus the other two
rather than its own basis points.

### Errors

```
1 CampaignNotFound     5 InvalidProof            9 InvalidAmount
2 CampaignClosed       6 ActionAlreadySettled   10 NoSplits
3 SplitsMustSumTo10000 7 InsufficientBudget
4 UnknownPublisher     8 NothingToWithdraw
```

## 3. How the shipped design differs from the proposal

| Proposed | Shipped | Verdict |
| --- | --- | --- |
| `operator: Address` | `platform: Address` | Same role, better name — it also receives the platform share |
| Player share held as a `reserve` | Player share is an ordinary claim | Simpler, and it removes the need for a sixth function |
| `release_reserve` for conversion | `withdraw` with the player as `who` | The proposal was solving a problem that does not exist |
| `settle -> SettleResult` | `settle -> ()` | See finding F3 |
| `Action` record for replay | `Spent(action_id) -> bool` | See finding F2 |
| `refund_clawback(campaign_id, action_id)` | `refund_clawback(campaign_id, player, amount)` | See finding F2 |

### D1 — who mints REWARD

The contract chose option B and says why: REWARD's SAC admin is the classic
issuer, so minting from the contract would need an issuer authorization entry on
every `settle`. `settle` records the entitlement; the validator pays REWARD as a
separate classic transaction, as `e2e.js` step 3 shows.

`npm run prove-sac-admin` measured the alternative on testnet:

| Question | Answer |
| --- | --- |
| Does deploying a SAC disturb classic clawback? | No |
| Does `set_admin` away from the issuer succeed? | Yes |
| Does classic CLAWBACK still work afterwards? | **Yes** |
| Does classic issuance still work afterwards? | Yes |
| Can the new admin mint through the SAC? | Yes |
| Can the new admin claw back through the SAC? | Yes |

So the stated reason is true only while the admin stays with the issuer. Moving
it to the escrow contract would let the contract mint under its own auth, with
no per-settle issuer entry, and the issuer would keep clawback — the premise the
whole project rests on survives the move.

**That is not an argument to change it now.** B is built, tested and running end
to end, and the rework lands in the hours the escrow can least afford it. It is
an argument for knowing the option is real if the demo narrative needs "one
transaction" to be literally true. The remaining unknown is small: the
experiment moved the admin to an account, not a contract.

## 4. Findings still open

### F1 — `InvalidProof` is never returned

A bad signature reaches `env.crypto().ed25519_verify`, which **traps** rather
than returning. `Error::InvalidProof = 5` is declared and never constructed; the
tests assert it with `#[should_panic]`.

For #10 this means the two most likely failures — a wrong key, and a proof
replayed against a different player — both arrive as an indistinguishable host
trap, not as error 5. "Surface contract rejections as clear API errors" cannot
be satisfied for the signature path without either verifying manually before the
call or mapping traps by context.

### F2 — `refund_clawback` trusts the caller for the amount — FIXED

It zeroes the player's claim, then adds the caller's `amount` to `remaining`.
Nothing ties the two together. A wrong `amount` inflates `remaining` past the
TUSDC the contract actually holds, and the failure surfaces much later as a
`withdraw` or `close_campaign` that cannot transfer.

Fixed in the 2026-09-19 redeploy: `refund_clawback(campaign_id, player)` now
derives the amount from the player's reserve, so the platform cannot inflate
`remaining`. That matches the principle the contract already states about
`settle` — the contract decides what things are worth, not the caller.

Worse case: if the player already withdrew, the claim is 0, the TUSDC has left
the contract, and `remaining` still grows by `amount`.

### F3 — `settle` returns nothing

The validator must call `claim_of` afterwards to know what was credited. #17
wants amounts in the shared log, so that is an extra round trip per action.
Returning the three amounts would remove it.

### F4 — a campaign's budget and its escrow balance are not readable

`open_campaign` receives `budget`, transfers it, and stores only `remaining`.
Nothing keeps the number it started from, so "spent so far" cannot be computed
from chain state. And because one contract carries every campaign, the
contract's token balance is a total, not any single campaign's escrow.

This bites #14 directly: of the four figures the advertiser panel is specified
to show — escrow balance, ratio table, spent, remaining — two are unavailable.
Measured again on the redeployed escrow: campaign 0 reports `remaining`
96.0000 TUSDC while the contract holds 103.8000, because campaign 1 is also
live in it. The per-campaign escrow figure the advertiser panel wants is the
one number that cannot be read.

Adding `budget: i128` to `Campaign` closes the spend half for one field. The
per-campaign balance half needs either a per-campaign accumulator or a panel
that shows the total and says so.

### F5 — the validator sends no CORS headers

A browser refuses to call it cross-origin, so every panel read and every panel
action fails with `ERR_FAILED` and nothing but a console message to explain it.
This blocks #14, #15 and #16 as much as it blocked #13.

Worked around in `packages/web/next.config.ts`: the panels call a same-origin
`/api/validator/*` path and Next forwards it to `VALIDATOR_ORIGIN`. That also
keeps the POSTs in #14–#16 free of preflight requests, and leaves no CORS
configuration to get wrong. The validator itself is unchanged; if it is ever
served to a browser from another origin, it will need the headers.

### F6 — a validator restart makes a frozen reward look spendable

The validator keeps players, task counts and `lastRewardAt` in memory, which it
documents as acceptable for a demo. One consequence is not: after a restart,
`lastRewardAt` is null, so `tierOf` reports the clawback window closed and
`canConvert` true for a player whose reward was paid seconds earlier.

The chain disagrees. Since the 2026-09-19 trustline freeze, the REWARD
trustline stays unauthorized for the window's duration, so the burn inside
`/player/convert` fails. The panel offers a cash-out the chain then refuses.

Observed while verifying #15: after restarting the validator, a player holding
1.2000000 REWARD from a minute earlier showed "Can cash out now".

It matters because a mid-presentation restart is exactly when this happens.
Reading `lastRewardAt` back from the trustline's authorization state on
startup, rather than assuming a cold store means a closed window, would keep
the two in step.

## 5. The JS boundary

`e2e.js` drives the contract through the `stellar` CLI. A backend cannot shell
out per request, so `packages/validator/src/chain.js` goes through Soroban RPC
instead, and `packages/scripts/src/soroban.js` does the same for the scripts
package. Both exist on purpose: the scripts one is standalone, the validator one
carries config and key handling.

The SDK had to move to 17 for either to work. `@stellar/stellar-sdk@13` cannot
parse protocol 28 Soroban RPC responses at all — it fails with
`Bad union switch: 4`. Classic operations are unaffected, which is why nothing
broke until the first RPC call was made.

What the boundary still lacks is error mapping. `invokeContract` throws
`` `${method} rejected: ${JSON.stringify(sent.errorResult)}` ``, so every
contract error arrives at the API layer as one opaque string. See F1.

## 6. What this changes in the open issues

| Issue | Change |
| --- | --- |
| #7 | F2: derive the refund amount from the claim being zeroed |
| #5 | F4: keep `budget` on `Campaign` so the advertiser panel can show spend |
| #6 | F1 and F3: return the three amounts; decide how a bad signature should surface |
| #9 | Config gains `ESCROW_CONTRACT_ID`, `TUSDC_SAC_ID`, the campaign id, and the `platform` key |
| #10 | Build the digest with ScVal-XDR addresses, not raw keys; expect traps, not error 5 |
| #11 | Conversion is: burn REWARD classically, then `withdraw` the player's TUSDC claim. No sixth function, no DEX |
| #12 | Three hashes: classic clawback, burn, `refund_clawback` |

---

## Breaking change — 2026-09-19, escrow redeployed

`CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI`

A player's entitlement is no longer a claim. `claim_of` returns `0` for players and is now only publisher and platform balances. Anything reading a player balance must call `reserve_of(campaign_id, player)`.

The split exists because a claim is withdrawable by its owner. A player's payout is owed against a REWARD token they still hold, so letting them call `withdraw` would pay the escrowed value while they kept the reward — the same value twice.

| Change | Before | Now |
| --- | --- | --- |
| Player balance | `claim_of` | `reserve_of` |
| Player payout | `withdraw`, player auth | `redeem_player(campaign_id, player)`, platform auth, always paid to that player |
| Clawback refund | `refund_clawback(campaign_id, player, amount)` | `refund_clawback(campaign_id, player)` — the contract uses the reserve, so the platform cannot inflate `remaining` |

Also fixed: `Spent` action ids now get a TTL extension. Without it the replay guard expired and a settled action became payable again.

Verified by `escrow_balance_always_covers_remaining_plus_everything_owed` in the contract tests: the escrow's token balance always equals `remaining` plus every open claim and reserve.
