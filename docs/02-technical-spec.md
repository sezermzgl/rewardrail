# Technical Specification

*RewardRail implementation detail — Stellar testnet*

## System components

The system has four parts. The dividing principle: decisions are made off chain, value transfer happens on chain.

| Component | Where | Responsibility |
| --- | --- | --- |
| Escrow contract | Soroban, testnet | Holds the budget, splits shares, handles withdrawals and refunds |
| REWARD asset | Stellar classic | Reward balance, clawback authority |
| Validator service | Node.js backend | Signs task-completion proofs, decides the risk tier |
| Panel interface | Next.js | Screens for the four actors, surfaces transaction hashes |

### Responsibility boundary

What the chain does not know: whether the player actually played, whether the account is fraudulent, which offer to show to whom. All of that is the validator's job.

What the chain guarantees: that the budget cannot be spent without authorization, that share ratios cannot deviate from what the contract says, that the same action cannot be paid twice, and that unspent budget returns to the advertiser.

This distinction matters because the project's claim is not "the chain solves fraud." The claim is: whoever makes the fraud decision, the movement of money stays auditable and reversible.

```mermaid
flowchart LR
  UI[Panel<br/>Next.js] --> API[Validator<br/>Node.js]
  API -->|signed proof| SC[Escrow<br/>Soroban]
  API -->|clawback| ISS[REWARD issuer<br/>classic]
  SC <-->|SAC| ISS
  UI -->|reads| RPC[Soroban RPC<br/>Horizon]
```

## Assets and accounts

### Assets

| Asset | Type | Role |
| --- | --- | --- |
| `REWARD` | Classic asset we issue | The player's reward balance, clawback enabled |
| `TUSDC` | Test stablecoin we issue | The value held in escrow, standing in for USDC in the demo |
| `XLM` | Native | Only fees and reserves; the user never sees it |

Issuing our own test asset instead of real USDC is a deliberate choice. The testnet USDC issuer address and faucet availability are an external dependency, and it is not worth the risk of it failing mid-presentation. Architecturally there is no difference, since both are standard classic assets.

### Accounts

| Account | Flags | Notes |
| --- | --- | --- |
| REWARD issuer | `AUTH_REVOCABLE`, `AUTH_CLAWBACK_ENABLED` | Both are required for clawback and must be set before the asset is issued |
| TUSDC issuer | None | Plain issuer, no clawback needed |
| Sponsor / fee payer | None | Sponsors player accounts, signs fee-bumps |
| Validator | None | Only signs proofs, holds no funds |
| Advertiser | None | Holds TUSDC, deposits into escrow |
| Publisher | None | Receives TUSDC |
| Player (x2) | None | Sponsored, holds a REWARD trustline |

### Critical ordering

The clawback flag must be set **before any trustline is created**. When a trustline is created it is marked clawback-enabled according to the issuer's flags at that moment. Setting the flag afterwards does not cover existing trustlines.

This is the easiest mistake to make during setup, and it surfaces as "clawback isn't working" at demo time. The setup script must set the flags in the first step and verify them.

## Escrow contract

A single contract carries all campaigns. Deploying one contract per campaign is unnecessary complexity.

### Data structures

```rust
pub struct Split {
    pub player_bps: u32,     // basis points, 10000 = 100%
    pub publisher_bps: u32,
    pub platform_bps: u32,
}

pub struct Campaign {
    pub advertiser: Address,
    pub token: Address,          // the SAC address of TUSDC
    pub validator: BytesN<32>,   // ed25519 public key
    pub per_action: i128,        // total paid per action
    pub remaining: i128,
    pub splits: Map<Address, Split>,  // publisher -> ratio
    pub open: bool,
}
```

The `splits` map is how the per-publisher ratio decision is represented. It cannot be changed after the campaign opens; there is no function in the contract that updates this map.

### Functions

| Function | Caller | What it does |
| --- | --- | --- |
| `open_campaign` | Advertiser | Transfers the budget, registers the campaign |
| `settle` | Validator | Verifies the proof, splits shares, pays the player |
| `withdraw` | Publisher / platform | Withdraws the accrued claim |
| `refund_clawback` | Issuer admin | Returns a clawed-back reward to the campaign |
| `close_campaign` | Advertiser | Closes the campaign, refunds the remainder |

```rust
pub fn settle(
    env: Env,
    campaign_id: u64,
    player: Address,
    publisher: Address,
    action_id: BytesN<32>,
    signature: BytesN<64>,
) -> Result<(), Error>;
```

`settle` does the following in order: checks whether `action_id` has been used before, verifies the signature against the campaign's `validator` key, checks that `remaining` is sufficient, mints the player's share as REWARD, records the publisher and platform shares as claims, and marks `action_id` as spent.

### Important design notes

- **The player's share is minted, not transferred.** The escrow holds TUSDC; the player receives REWARD. The matching TUSDC stays in escrow as reserve and is paid out when the player converts.
- **The publisher share is pull, not push.** `settle` only increments a balance, it does not transfer. The transfer happens on a `withdraw` call.
- **`action_id` is the heart of replay protection.** Even if the validator submits the same proof twice, the second one is rejected.
- **Basis points, not decimals.** The three shares must sum to exactly 10000; `open_campaign` verifies this.

## Validator and proof format

The validator is the only authority the escrow recognizes. It holds no funds, it only signs. Stealing its key cannot drain the escrow, because payouts can only follow the ratios written in the contract and only in the `per_action` amount.

### The signed message

```
message = SHA256(
    campaign_id (u64, big-endian)
  || player      (32 bytes)
  || publisher   (32 bytes)
  || action_id   (32 bytes)
)
signature = Ed25519-Sign(validator_secret, message)
```

`action_id` is the hash of a unique action identifier in the validator's own event log. The same player completing a second task in the same campaign produces a different `action_id`, so legitimate repeat payouts are not blocked.

### Why this format

The message binds campaign, player, publisher, and action together. If any one of the four changes, the signature is invalid. A stolen proof cannot be moved to another player or another campaign.

The amount is not part of the message. The contract derives it from `per_action` and `splits` itself. That way the validator cannot alter the amount even if it wanted to.

### Alignment point: the risk tier

The validator also decides which tier a player is in. This is not written on chain; the conversion lock is enforced off chain. The reason: the tier rule is a frequently changing business rule, and embedding it in the contract would require a redeployment on every change.

This is a deliberate trade-off. The lock is not enforced on chain, which means the platform could technically delay a player's conversion unfairly. In exchange, the clawback window and the ratios are enforced on chain.

### API endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/action/complete` | POST | Records the task, signs the proof, calls `settle` |
| `/player/tier` | GET | Returns the player's tier and remaining window |
| `/player/convert` | POST | Runs the REWARD → TUSDC conversion if the tier allows |
| `/fraud/flag` | POST | Flags an account, triggers the clawback and refund chain |

## Clawback and risk tiers

### The clawback chain

When the operator flags an account, three transactions run in order:

1. The issuer account pulls the player's REWARD balance back with a `CLAWBACK` operation.
2. The reclaimed REWARD is burned; the matching TUSDC was already sitting in escrow.
3. A `refund_clawback` call increases the campaign's `remaining`, and `action_id` stays marked as spent.

The third step is where the decision shows: the reclaimed amount is not refunded to the advertiser, it is redistributed within the same campaign.

### Window and tiers

Tiers are stored in the validator's database.

| Tier | Condition | Conversion | Window |
| --- | --- | --- | --- |
| Trusted | Account age 7+ days **and** 5+ completed tasks | Instant | None |
| New | One of the two not met | After the window | 24 hours |
| Suspicious | Flagged by an operator | After the window | 24 hours, extendable |

In the demo the window is 60 seconds. The value is read from configuration, not hardcoded.

### How the lock is enforced

The player's REWARD sits in their own account and is technically transferable. The lock is enforced by `/player/convert` refusing the conversion when the tier does not qualify.

This does not stop a player from sending REWARD to someone else on chain. In a real system the fix would be the issuer using the `AUTH_REQUIRED` flag to authorize trustlines: authorization is withheld for the duration of the window, so the player sees the balance but cannot move it.

`AUTH_REQUIRED` is left out of the hackathon scope because it adds an authorization transaction per new player and contributes nothing visually to the demo. This should be stated openly in the presentation, since an attentive judge may ask.

## Sponsored accounts and the fee-free player flow

A single transaction handles everything at player signup. It is assembled and paid for by the sponsor.

### The signup transaction

```
FeeBumpTransaction (fee: sponsor)
  └─ Transaction (source: sponsor)
       1. BEGIN_SPONSORING_FUTURE_RESERVES  (sponsored: player)
       2. CREATE_ACCOUNT                    (player, starting 0 XLM)
       3. CHANGE_TRUST                      (REWARD, source: player)
       4. CHANGE_TRUST                      (TUSDC,  source: player)
       5. END_SPONSORING_FUTURE_RESERVES    (source: player)
```

Signatures: sponsor **and** player. Because the player's key is generated in the backend at signup, the backend provides the second signature too. The player signs nothing.

Result: the player account has a zero XLM balance, its reserves are paid by the sponsor, and two trustlines are ready.

### Key custody

The player's secret key is stored encrypted in the backend. This is a custodial model and it is intentional.

The reasoning: the target audience is ordinary players using a rewards app. Handing them seed phrase responsibility produces nothing but user loss in this segment. A user who wants to can withdraw to their own address; custody is the starting state, not a cage.

In the hackathon demo, keys are held in memory or in a simple file. Production requires a KMS; this should be said openly.

### Who pays fees

Every transaction the player triggers is wrapped in a fee-bump paid by the sponsor account. Since the player account holds no XLM, it could not submit a transaction any other way.

| Transaction | Fee paid by | Notes |
| --- | --- | --- |
| Signup | Sponsor | Reserves are also on the sponsor |
| Receiving a reward | Platform | The platform submits the `settle` call |
| REWARD → TUSDC | Sponsor | Fee-bump |
| Clawback | Issuer | No player approval required |

## Interface panels

Four panels sit side by side on one page. Switching pages breaks the demo flow and scatters the judges' attention.

| Panel | Shows | Actions |
| --- | --- | --- |
| Advertiser | Escrow balance, ratio table, spent / remaining | Open campaign, close campaign |
| Player (two accounts) | REWARD balance, tier, remaining window | Complete task, convert to TUSDC |
| Publisher | Accrued claim | Withdraw |
| Operator | Player list and risk signals | Flag as fraudulent |

### Transaction proof must be visible

After every action a shortened transaction hash appears at the bottom of the panel, linking to Stellar Expert. This is the visual counterpart of the project's "auditable" claim. If the hash is not visible, the claim is just words.

A shared transaction log sits at the bottom of the page: time, action, actor, hash. By the end of the demo the whole flow is visible in one list.

### State management

Panels read from the chain and keep no local state. Relevant balances are refetched after every action.

This is slow but honest. Keeping local state with optimistic updates invites the question "is this actually happening on chain?" during the demo. Balances coming from the chain are the claim itself.

### Consistency in language

These words never appear in the interface: wallet, seed, private key, gas, transaction fee, blockchain. The player panel must look like a rewards app.

Technical language is fine in the operator and advertiser panels; those parties already see the infrastructure.

## Setup, testing, and the fallback route

### Network and tooling

| Piece | Value |
| --- | --- |
| Network | Stellar testnet |
| Account funding | Friendbot |
| Classic access | Horizon testnet |
| Contract access | Soroban RPC testnet |
| CLI | `stellar` (formerly `soroban`) |
| Contract language | Rust, `soroban-sdk` |
| Backend | Node.js, `@stellar/stellar-sdk` |

For a Soroban contract to hold a classic asset, that asset's Stellar Asset Contract must be deployed. For TUSDC this step is part of the setup script.

### Setup order

1. Generate accounts and fund them with friendbot
2. Set issuer flags: `AUTH_REVOCABLE` + `AUTH_CLAWBACK_ENABLED`
3. Read back and verify that the flags are set
4. Deploy the SAC for TUSDC
5. Create advertiser and publisher trustlines, mint TUSDC to the advertiser
6. Build and deploy the escrow contract
7. Generate the validator keypair

Step 3 must not be skipped. A flag-ordering mistake only surfaces when clawback is attempted, and at that point everything has to be rebuilt from scratch.

### Test plan

| Test | Expected |
| --- | --- |
| Same `action_id` twice | The second is rejected |
| Proof signed with the wrong key | Rejected |
| Payout larger than the remaining budget | Rejected |
| Shares not summing to 10000 | `open_campaign` rejects it |
| `remaining` after clawback | Increases by the reclaimed amount |
| `settle` after closing | Rejected |
| Early conversion on a new account | Rejected |
| Transaction from a sponsored account with 0 XLM | Passes via fee-bump |

### The classic fallback route

If the Soroban escrow is not running end to end by hour 14, the plan changes. The fallback:

- A 2-of-3 multisig classic account instead of the escrow: advertiser and validator sign together
- Share distribution as three `PAYMENT` operations in one transaction
- `CLAIMABLE_BALANCE` for publisher withdrawal, claimed whenever the publisher wants
- Campaign refund as a manually signed payment

What is lost: `action_id` replay protection and ratio enforcement move off chain to the validator. What is kept: clawback, sponsored accounts, threshold-free payouts, and auditable money movement — meaning all three of the main claims still stand.

The existence of this fallback is the project's single biggest risk reducer. If the decision point is postponed, there will be no time to build the fallback either.
