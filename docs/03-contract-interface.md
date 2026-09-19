# Contract Interface Contract

*The agreement that lets the escrow (#5–#8) and the validator (#9–#12) be built in parallel.*

Status: **draft, pending agreement between @KkutaySarii and @sezermzgl.**

Nothing here overrides `02-technical-spec.md` on intent. It resolves the places
where the spec stops short of a signature the two sides can both code against.

---

## 0. Three decisions the spec leaves open

### D1 — Who mints REWARD

The spec says `settle` "mints the player's share as REWARD". REWARD is a classic
asset whose clawback authority lives in a classic issuer account; `settle` runs
in Soroban. `issue-assets.js` deploys a SAC for TUSDC only, and says REWARD "is
minted per payout" without naming the minter.

| Option | Mechanism | Cost |
| --- | --- | --- |
| **A** | Deploy a REWARD SAC, `set_admin` to the escrow contract, `settle` mints | Payout is atomic. Unverified: whether the classic issuer keeps CLAWBACK authority after admin transfer |
| **B** | `settle` records a reserve claim only; the validator pays REWARD in a separate classic transaction | Clawback authority stays plainly classic — already proven by `prove-clawback.js`. Payout is two transactions, not one |

**Recommendation: B.** The project's single load-bearing claim is clawback, and
B leaves the mechanism that has already been proven on testnet untouched. A's
atomicity is worth less than the risk of discovering at hour 10 that
`set_admin` silently broke clawback.

**Before choosing A, run the experiment**: deploy a REWARD SAC, transfer admin
to a contract, then attempt a classic CLAWBACK from the issuer. Twenty minutes,
and it is the same shape as `prove-clawback.js`. Do not take either answer on
faith.

B's honest cost, stated plainly to judges: if the classic REWARD payment fails
after `settle` succeeded, the action is marked spent but the player has no
balance. `action_id` is idempotent, so the fix is a retry of the payment, never
a re-settle.

### D2 — How REWARD becomes TUSDC

The pitch says "path payment via the built-in DEX". The spec says the matching
TUSDC "stays in escrow as reserve and is paid out when the player converts".
These are different mechanisms, and the DEX route needs REWARD/TUSDC liquidity
nobody has committed to providing.

**Resolution: the escrow reserve route. No DEX.** Conversion is two steps:

1. The player's REWARD is burned — a classic payment from the player back to the
   REWARD issuer, signed by the backend (custodial key), fee-bumped by the sponsor.
2. `release_reserve` moves the matching TUSDC out of escrow to the player.

**This requires a sixth contract function.** The spec's five-function table
cannot express conversion: the escrow holds the TUSDC and only a contract call
can move it. `release_reserve` is specified in §2 below.

Order matters. Burn first, then release: a failed release leaves the player
short and is recoverable by retry, whereas a failed burn after release is a
double spend.

### D3 — How much `refund_clawback` returns

Clawback recovers only the player's REWARD. The publisher and platform claims
were credited at `settle` and are not touched.

Therefore `remaining` increases by **exactly the player share**,
`per_action * player_bps / 10000` — not by `per_action`. Crediting the full
amount double-counts the two shares that never left.

The same call must decrement the player's reserve by that amount, because the
REWARD it backed no longer exists.

**Consequence for #6**: replay protection cannot be a boolean. `refund_clawback`
has to derive the amount itself, and the split depends on which publisher the
action ran under. `settle` must therefore store a record per `action_id`:

```rust
pub struct Action {
    pub player: Address,
    pub publisher: Address,
    pub player_share: i128,
    pub refunded: bool,
}
```

Deriving the amount rather than accepting it from the caller is the same
principle that keeps the amount out of the signed message: the contract is the
only party that decides what anything is worth.

---

## 1. Types and units

| Concern | Decision |
| --- | --- |
| Amounts on chain | `i128` in stroops — 7 decimals, 1 TUSDC = 10_000_000 |
| Amounts over the API | Decimal strings (`"0.4000000"`), converted at the boundary |
| `campaign_id` | `u64`, assigned by the contract, returned from `open_campaign` |
| `action_id` | `BytesN<32>` |
| Proof signature | `BytesN<64>`, ed25519 |
| Proof public key | `BytesN<32>` — the raw key, not the `G...` string |

The `G...` form is a checksummed encoding of the 32 raw bytes. On the JS side
the raw form comes from `Keypair.fromPublicKey(g).rawPublicKey()`. Passing the
`G...` string where 32 bytes are expected is the most likely first bug in #10.

### Two different validator identities

The campaign carries both, and they are not interchangeable:

- `validator: BytesN<32>` — the **ed25519 proof key**. Authorizes payouts by
  signature. Never needs to be an account.
- `operator: Address` — the **calling identity** for `release_reserve` and
  `refund_clawback`, checked with `require_auth()`.

`operator` does not exist in the spec's `Campaign` struct. Without it,
conversion and clawback refunds are callable by anyone.

---

## 2. Functions

```rust
fn open_campaign(
    env: Env,
    advertiser: Address,      // require_auth
    operator: Address,
    token: Address,           // TUSDC SAC
    validator: BytesN<32>,    // ed25519 proof key
    per_action: i128,
    budget: i128,
    splits: Map<Address, Split>,
) -> u64;                     // campaign_id
```
Transfers `budget` from advertiser to the contract. Rejects unless every
`Split` sums to exactly 10000 and `per_action > 0`.

```rust
fn settle(
    env: Env,
    campaign_id: u64,
    player: Address,
    publisher: Address,
    action_id: BytesN<32>,
    signature: BytesN<64>,
) -> SettleResult;
```
No `require_auth`. The ed25519 signature is the authorization, so anyone may
relay a valid proof — the platform simply pays the fee.

Order: reject if `action_id` is known → verify the signature over
`SHA256(campaign_id_be || player_raw || publisher_raw || action_id)` → reject if
`remaining < per_action` → decrement `remaining` → credit publisher and platform
claims → credit `reserve[player]` with the player share → store the `Action`
record.

Under **D1-B** it does **not** move REWARD. The validator does that next.

```rust
pub struct SettleResult {
    pub player_share: i128,
    pub publisher_share: i128,
    pub platform_share: i128,
    pub remaining: i128,
}
```
The validator needs `player_share` to know how much REWARD to pay, and the
panels need `remaining`. Returning them avoids a second read.

```rust
fn withdraw(env: Env, campaign_id: u64, claimant: Address) -> i128;   // require_auth(claimant)
fn release_reserve(env: Env, campaign_id: u64, player: Address, amount: i128) -> i128;  // require_auth(operator) — NEW, see D2
fn refund_clawback(env: Env, campaign_id: u64, action_id: BytesN<32>) -> i128;  // require_auth(operator)
fn close_campaign(env: Env, campaign_id: u64) -> i128;                // require_auth(advertiser)
```

`withdraw` transfers the full accrued claim and zeroes it. No minimum — the
no-threshold principle applies here too.

`release_reserve` returns the reserve left. It must reject `amount >
reserve[player]`; the contract cannot see whether the REWARD burn actually
happened, so this bound is the only thing preventing a double conversion.

`refund_clawback` returns the new `remaining`. Rejects if the action is unknown
or already refunded. `action_id` **stays spent** — the action happened, it was
merely unpaid.

`close_campaign` returns the refunded amount, sets `open = false`, and refuses
while any claim or reserve is still outstanding.

## 3. Views

The web panels read from the chain and keep no local state (#13). None of these
exist in the spec, and without them the four panels have nothing to render.

```rust
fn get_campaign(env: Env, campaign_id: u64) -> Campaign;
fn get_claim(env: Env, campaign_id: u64, claimant: Address) -> i128;
fn get_reserve(env: Env, campaign_id: u64, player: Address) -> i128;
fn get_action(env: Env, campaign_id: u64, action_id: BytesN<32>) -> Option<Action>;
```

| Panel | Reads |
| --- | --- |
| Advertiser | `get_campaign` — budget, remaining, splits, open |
| Player | `get_reserve` + the classic REWARD balance |
| Publisher | `get_claim` |
| Operator | `get_action` |

## 4. Errors

`#[contracterror] #[repr(u32)]`. The numbers are part of the agreement: #10
maps them to API messages, so renumbering later breaks the validator silently.

| Code | Name | Raised by |
| --- | --- | --- |
| 1 | `UnknownCampaign` | all |
| 2 | `CampaignClosed` | `settle`, `release_reserve` |
| 3 | `BadSplits` | `open_campaign` |
| 4 | `UnknownPublisher` | `settle` |
| 5 | `AlreadySettled` | `settle` |
| 6 | `BadSignature` | `settle` |
| 7 | `InsufficientRemaining` | `settle` |
| 8 | `InsufficientClaim` | `withdraw` |
| 9 | `InsufficientReserve` | `release_reserve` |
| 10 | `UnknownAction` | `refund_clawback` |
| 11 | `AlreadyRefunded` | `refund_clawback` |
| 12 | `OutstandingBalances` | `close_campaign` |
| 13 | `NotAuthorized` | any `require_auth` path |

`5`, `6` and `7` are the three the test suite (#8) must prove and the demo may
have to explain. They deserve the clearest API messages.

## 5. The JS boundary

`packages/validator` codes against this shape. A mock implementation satisfies
it until #6 lands, and swapping in the real client should touch one module.

```
settle({ campaignId, player, publisher, actionId, signature })
  -> { txHash, playerShare, publisherShare, platformShare, remaining }

withdraw({ campaignId, claimant })              -> { txHash, amount }
releaseReserve({ campaignId, player, amount })  -> { txHash, reserveLeft }
refundClawback({ campaignId, actionId })        -> { txHash, remaining }
closeCampaign({ campaignId })                   -> { txHash, refunded }

getCampaign(campaignId)                         -> Campaign
getClaim(campaignId, claimant)                  -> string
getReserve(campaignId, player)                  -> string
getAction(campaignId, actionId)                 -> Action | null
```

Rules at this boundary:

- Addresses are `G...` strings. The raw-bytes conversion happens inside.
- Amounts are decimal strings. Stroop conversion happens inside.
- Failures throw an error carrying `.code` and `.name` from §4. Nothing else
  throws that shape, so the API layer can map blindly.
- Every mutating call returns `txHash`. #17 needs one on every row, and adding
  it later means revisiting eight call sites.

## 6. What this changes in the open issues

| Issue | Change |
| --- | --- |
| #5 | `Campaign` gains `operator: Address`; add the four views of §3 |
| #6 | Replay storage is an `Action` record, not a flag; `settle` returns `SettleResult`; under D1-B it does not touch REWARD |
| #7 | Add `release_reserve`; `refund_clawback` derives the player share itself and takes no amount |
| #8 | Add: refund credits the player share only; double conversion is rejected; `close_campaign` refuses while balances are outstanding |
| #10 | Mock against §5 today; the swap is one module |
| #11 | Conversion is burn-then-`release_reserve`, no DEX |
| #12 | Three hashes: clawback, burn, `refund_clawback` |
