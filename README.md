# RewardRail

A Stellar-based payout and settlement layer for rewarded advertising.

Built for the Stellar hackathon. Testnet only.

## The problem

In rewarded advertising, an advertiser pays for an install, the player earns points for completing a task, and the publisher takes a share. The model needs micro-amount, instant, cross-border payouts — but the rail underneath it is batched, delayed, and separate per country.

The consequences are well known:

- Players wait for a $10–15 threshold, because a $0.40 PayPal transfer loses money on fees
- Publishers reconcile monthly and trust the platform's numbers
- Advertisers cannot independently verify the invoice they receive
- Fraud found after a payout is written off, because the money is gone

## The approach

The advertiser's budget is locked in an on-chain escrow. Every verified action releases part of it and splits it three ways in a single transaction. The player's share arrives as a clawback-enabled reward token, so fraud discovered after payout can still be reversed within a defined window.

Three claims, all demonstrable on testnet:

| Claim | Mechanism |
| --- | --- |
| Threshold-free micropayments | Stellar transaction fee ~0.00001 XLM |
| Auditable ad spend | Soroban escrow, every release recorded on chain |
| Reversible rewards | Clawback (CAP-35) within a risk-based window |

Players never see a wallet, a seed phrase, or a fee. Accounts are opened with sponsored reserves and transactions are paid via fee-bump.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/01-pitch.md](docs/01-pitch.md) | Problem, solution, demo script, scope, risks, judge questions |
| [docs/02-technical-spec.md](docs/02-technical-spec.md) | Components, contract interface, proof format, setup, tests |

Read the pitch first. The technical spec assumes its terminology.

## Repository layout

This is a monorepo. Packages are added as they are built.

```
.
├── docs/           Pitch and technical specification
├── packages/
│   ├── contracts/  Soroban escrow contract (Rust)
│   ├── validator/  Proof-signing backend (Node.js)
│   ├── web/        Four-panel demo interface (Next.js)
│   └── scripts/    Testnet setup and verification scripts
└── package.json    Workspace root
```

## Status

| Area | State |
| --- | --- |
| Design decisions | Settled — see the Decisions section in the pitch |
| Contracts | Not started |
| Validator | Not started |
| Web | Not started |
| Scripts | Not started |

Two questions remain open: which testnet anchor the demo uses (or whether fiat exit is simulated), and whether a campaign closes on time or on budget exhaustion. Neither blocks implementation.

## Getting started

Nothing to run yet. The first milestone is the setup script in `packages/scripts`: generate accounts, set issuer flags, issue REWARD, send it to an account, and claw it back.

One ordering constraint matters from the very first commit: `AUTH_CLAWBACK_ENABLED` must be set on the issuer **before** any trustline is created. Trustlines are marked clawback-enabled based on the issuer's flags at creation time, and setting the flag later does not cover existing ones.

## License

Not yet chosen.
