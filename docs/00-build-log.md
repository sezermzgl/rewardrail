# Build log

*What was built, in the order it was built, and why each step came when it did.*

RewardRail was written between 22:37 on 2026-09-19 and the small hours of
2026-09-20 — one sitting, 75 commits, two branches that met in the middle.
This file is the account of it. The pitch says what the project claims, the
spec says how it works, and this says what actually happened, which is a
different and occasionally more useful document.

The ordering principle throughout: **prove the riskiest assumption before
building anything that depends on it.** Two assumptions could have ended the
project outright — that clawback works at all, and that a frozen reward really
cannot be moved — so both were settled on testnet before a line of the escrow
was written.

---

## Phase 1 — prove the thing that could kill the project

**`6697d6a` · scripts: prove clawback on testnet, including the flag-ordering trap**

The whole fraud claim rests on CAP-35 clawback. Before designing around it,
`prove-clawback.js` ran it on testnet both ways: with the issuer flags set
before any trustline existed, and with them set afterwards. The second case
fails permanently, and there is no recovery — a trustline takes its clawback
status at creation and setting the flag later does not reach it.

Finding that on demo night would have meant rebuilding every account from
scratch. Finding it in the first fifteen minutes meant `bootstrap` could be
written to verify the flags before anything trusts the asset.

**`3295944` · scripts: testnet bootstrap, asset issuance and TUSDC SAC deploy**

Accounts, issuer flags with a read-back check, our own TUSDC, and its Stellar
Asset Contract — which a Soroban contract needs before it can hold a classic
asset at all. Idempotent from the start: rerunning reuses `keys.json` rather
than orphaning a configured issuer.

## Phase 2 — the contract

**`d0779be` · contracts: escrow with proof verification, claims, clawback refund and tests**

One contract carrying every campaign. `open_campaign` locks a budget and a
per-publisher split table that no function can change afterwards; `settle`
verifies an ed25519 proof and accrues three shares; `withdraw`,
`refund_clawback` and `close_campaign` move value back out.

The design decision that mattered here: **the amount is never taken from the
proof.** It is derived from `per_action` and the publisher's row, so a stolen
validator key can misdirect a payout but cannot change its size.

**`972fa19` · scripts: sponsored player signup with fee-bumped transactions**

One transaction opens a player account with a zero balance, creates two
trustlines and ends the sponsorship — reserves and fee both on the sponsor.
This is the "the player never sees crypto" claim, made concrete early so the
rest of the system could assume it.

**`c17b35f` · scripts: deploy escrow and run the full demo flow end to end**

The hour-14 decision point in the plan was: if this does not run from a
terminal, fall back to a classic multisig escrow. It ran, so the fallback was
never needed.

## Phase 3 — agreeing on the boundary before crossing it

**`75a759c` → `a94267e` · the contract interface document**

Rust and JavaScript had to agree byte for byte on the signed message, and the
trap is subtle: `soroban-sdk`'s `Address::to_xdr` serializes the *`Val`*
representation, so an address in the digest is the XDR of an ScVal wrapping an
ScAddress — not a bare ScAddress, and not the raw ed25519 key. Getting it
wrong produces a signature that verifies nowhere and an error that says
nothing.

Writing `docs/03-contract-interface.md` before the validator meant that
agreement was a document rather than an afternoon of debugging.

**`22395f6`, `eaf874d` · the SAC admin experiment**

The contract does not mint REWARD; the validator pays it classically. The
stated reason was that REWARD's SAC admin is its classic issuer.
`prove-sac-admin.js` measured whether that had to stay true — moving the admin
to another account, then checking that classic clawback and classic issuance
both survive. They do. So the atomic version is available, and the decision
not to take it during a hackathon is recorded as a choice rather than a limit.

## Phase 4 — the validator

**`d8011fb` · validator: proof signing, settle submission, risk tiers and clawback chain**

The service that signs proofs and decides tiers. It holds no campaign funds:
the escrow only pays what the contract computes.

**`6155b2b` · validator: pay conversions out of escrow instead of minting**

Conversion burns REWARD and takes the escrowed payout. Nothing is minted — the
money the advertiser locked is the money the player receives.

## Phase 5 — the escrow's second draft

**`ecaa0e0` · contracts: separate player reserves from claims, bound clawback refunds, extend replay TTL**

Three findings from a security pass, fixed together, and the escrow redeployed:

- **Reserve / claim split.** A claim is withdrawable by its owner. A player's
  payout is owed against a REWARD token they still hold, so letting them call
  `withdraw` would pay the escrowed value while they kept the reward — the
  same money twice. Player balances moved under `Reserve` and leave only
  through `redeem_player`, which only the platform can call and which can only
  pay the player it belongs to.
- **`refund_clawback` lost its `amount` parameter.** A caller-supplied figure
  let the platform inflate `remaining` past what the escrow actually held, and
  the first withdrawal to hit the shortfall would have been the one that
  failed. It now refunds exactly the player's reserve.
- **The replay guard got a TTL extension.** Without it the `Spent(action_id)`
  entry expired and a settled action became payable again.

A test asserts the invariant directly: the escrow's balance always equals
`remaining` plus every open claim and reserve.

## Phase 6 — the window is real, not advisory

**`5a5211d` · close the clawback window bypass: freeze reward trustlines for the window's duration**

The most serious hole found in the whole build. The clawback window was our
service's promise and nothing else: a player could forward the reward to a
second account and convert from there, and by the time fraud surfaced the
original account would be empty.

Paying and freezing now happen in **one transaction** — authorize, pay, revoke
— so there is no moment where the reward is both received and transferable.
`prove-auth-lock.js` runs exactly that attack on testnet: the transfer is
rejected with `op_src_not_authorized`, the second account receives nothing,
and clawback still reaches the frozen reward.

This is the answer to "the window is just your server's promise," and it is
the reason the answer is a transaction hash rather than an assurance.

## Phase 7 — the interfaces, on two branches at once

The landing page and the demo console were built in parallel and merged twice
(`c3fce72`, `12b5c74`), which is why the commit log interleaves.

**`129d9e9` → `a7fd065` · the demo console**

A chain read layer that goes through `simulateTransaction` — no signature, no
fee, one round trip — so panels can refetch after every action. Then four
panels and a shared transaction log on one screen, because switching pages
breaks the flow of a four-minute demo.

The panels keep no local state. Everything re-reads from the chain after every
action, which is slower and honest: a balance that came from the chain is the
auditability claim itself rather than a rendering of it.

**`3186141` → `acbbd96` · the landing**

Built once, then rebuilt on a bold illustrated layout, and the console
(`abff451`) brought onto the same palette so a visitor meets one product
rather than two.

**`7b652e7`, `8a566f4` · `/play`**

The player's own app: five playable games, an offerwall, a payout. The one
screen a real person would hold, and the one place the words wallet, seed,
gas, transaction fee and blockchain must never appear. A test scans the source
and holds that line.

## Phase 8 — the exit to real money

**`cf4bfe0` · SEP-10 and SEP-24 against the SDF reference anchor**

Endpoints discovered from `stellar.toml`, never hardcoded, and the SEP-10
challenge verified against the signing key the anchor publishes — skipping
that check would let any server answering on the right URL harvest signatures
from player accounts.

**`0c754bd`, `8d22067` · SEP-6 and the Turkish lira ramp**

The SDF anchor settles in SRT, which is not money. The Turkish ramp converts
USDC to lira, and it speaks SEP-6 rather than SEP-24 — programmatic, no hosted
page, and the wallet sends the asset itself with the anchor's memo. Both
standards are supported and the code picks by what the toml offers.

This is also where the payout asset changed. Assets we issue ourselves proved
the mechanism but have no exit, because no anchor recognises them, so the
escrow moved to Circle's testnet USDC.

**`b7075a9` · sign in by email**

A sponsored account opened live from an email address and nothing else.

## Phase 9 — funding the campaign in what the advertiser holds

**`dec9909` · soroswap: fund a campaign in XLM and route it to the payout asset**

The escrow settles in one asset; an advertiser holds whatever it holds.
Routing through Soroswap's router contract removes that mismatch. The
aggregator API is mainnet-only and key-gated, so the router is called directly
— the price comes from `router_get_amounts_out` rather than from our own
arithmetic over pool reserves, and `amount_out_min` bounds the whole thing.

## Phase 10 — making the console operable by a stranger

**`0931876` → `c2d1a46`**

Until this point the interesting actions could only be triggered by curl,
which proves the mechanism to nobody watching a demo. Flag-as-fraudulent,
publisher withdraw, campaign open and close all became buttons, each returning
its hash to the panel that asked.

**`db73cd0` · stop the log dropping half the demo's events**

The shared log now survives a reload and a validator restart, so the whole
flow is readable in one list at the end.

## Phase 11 — putting it on a public URL

**`2ab1c92` · guard the write endpoints and load secrets from the environment**

Every POST moves money or reverses it, and the service holds the issuer key.
`WRITE_SECRET` turns on a header check for writes; reads stay open, because
balances and campaign state are public on chain anyway and the panels should
work for anyone handed the link. It fails closed: `NODE_ENV=production` with
no secret refuses to start.

**`7716bf6` · proxy the validator server-side so its write key stays off the browser**

A rewrite cannot add a header, and a guard whose key ships in the bundle is
decoration. The panels call a same-origin `/api/validator/*` route that
attaches the key on the server. It also sidesteps CORS, which the validator
does not send.

**`5e0fd52`, `776592d` · deploy the validator as a container**

Not serverless, on purpose: player records, the tier clock and the event feed
live in memory, and an instance that comes and goes between requests would
lose them.

## Phase 12 — rehearsal

**`f46c7b2`, `16f020e` · one clean run, with the backup hashes**

The eight-step script run end to end on testnet and then **through the
deployed URL**, so the hashes are evidence that the published site works
rather than that the code does. Every hash was read back from Horizon to
confirm it resolved and succeeded. The run reconciles: 12 USDC in, two actions
releasing 4 each, 1.20 clawed back, 5.20 refunded — 12 = 8 − 1.20 + 5.20.

It also produced three corrections to the documentation, which is what a
rehearsal is for: the anchor has no KYC page under SEP-6, the clawback window
does not fit its slot in the script, and the live site does not track `main`.

---

## Phase 13 — the pass this file was written during

A later read of the whole project, looking for the gap between what the
documents claim and what the deployed site does. Six things had drifted.

**The landing had no link to the product.** All four "view live demo" buttons
scrolled to a mock console on the same page, illustrated with invented figures
and a transaction hash that resolved nowhere. A visitor could not reach
`/demo` or `/play` from the landing at all, and three footer links — the docs,
the explorer and the repository, all of which existed — rendered as disabled
text marked "Soon". The mock now carries the recorded run's own numbers with
each panel's hash linking to Stellar Expert, and every call to action goes to
something that runs.

**The player app had no sign-in.** It showed whichever account the validator
happened to list first, so every visitor shared one balance and one clawback
window. `/play` now signs in by email — the endpoint existed and the console
already used it — and remembers the account for that browser.

**The anchor step opened a blank tab.** `/play` assumed a withdrawal always
returns the anchor's hosted page. The Turkish ramp is SEP-6, which has none;
the response carries a reference instead. Both shapes are handled now, and the
demo console gained the bank-withdrawal step the script calls for at 3:00.

**The console showed every account ever created.** Eleven of them on the
deployed service, nine left behind by scripted rehearsals. The player panel
shows the walkthrough's accounts and counts the rest behind a toggle; the
operator's risk table sorts them to the top rather than hiding any.

**A frozen reward could read as spendable** — F6 in
`03-contract-interface.md`. The validator's clock lives in memory, so a
restart made `tierOf` report the window closed for a reward the ledger still
had frozen, and the panel offered a cash-out the burn would then refuse. The
trustline's authorization flag is now consulted as well, which is the ledger's
own answer and the one that survives a restart.

**The advertiser panel showed the wrong campaign's budget.** `useLive` keeps
its reader in a ref, so the effect could not see the campaign id change. The
console learns its campaign from the validator *after* the first read, so on
every load the budget belonged to campaign 0 while the header said 7 — for up
to a full poll interval, on the one panel whose whole job is to be checked.

---

## What a reader should take from the order

Three things, if the log is worth anything at all.

**The two assumptions that could have ended the project were tested first**,
before anything was built on top of them — and one of them, the flag-ordering
trap, would have been unrecoverable if found later.

**The escrow was rewritten once, on purpose.** The reserve/claim split and the
bounded refund came out of a deliberate security pass rather than a bug
report, and the redeploy cost less than the invariant it bought.

**Every correction in phases 12 and 13 came from running the thing**, not from
reading it. The rehearsal found three, and the pass through the deployed site
found six more. Nothing in the documentation was wrong in a way that reading
the documentation would have revealed.
