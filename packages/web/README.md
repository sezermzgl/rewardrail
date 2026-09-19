# @rewardrail/web

Next.js App Router application with two product surfaces:

| Route | What it is |
| --- | --- |
| `/` | Responsive RewardRail product landing and interactive settlement preview. |
| `/demo` | Four-panel Stellar testnet demo for advertiser, player, publisher, and operator. |

## Run locally

From the repository root:

    npm install
    npm run dev -w @rewardrail/web

Open `http://localhost:3000` for the landing or `http://localhost:3000/demo` for the live demo.

## Verify

    npm run test -w @rewardrail/web
    npm run lint -w @rewardrail/web
    npm run typecheck -w @rewardrail/web
    npm run build -w @rewardrail/web

## Demo architecture

The four panels share a transaction log. Advertiser and publisher data read from the escrow contract through Soroban RPC; player and operator data read risk and tier information from the validator. Shared refresh coordination lives under `lib/demo`, while chain configuration lives under `lib/chain`.

Contract ids default to `packages/scripts/deployed.json`. They can be overridden with `NEXT_PUBLIC_ESCROW_CONTRACT_ID`, `NEXT_PUBLIC_TUSDC_SAC_ID`, `NEXT_PUBLIC_VALIDATOR_URL`, and `NEXT_PUBLIC_CAMPAIGN_ID`.
