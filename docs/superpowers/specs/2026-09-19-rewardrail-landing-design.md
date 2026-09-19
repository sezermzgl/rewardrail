# RewardRail Landing Page Design

**Date:** 2026-09-19  
**Status:** Approved design, pending implementation plan

## Purpose

RewardRail needs a public landing page that presents the project as a real B2B product, not as a hackathon prototype or a consumer crypto application.

The primary audience is rewarded-advertising platforms and offerwall operators that need to pay players and publishers, reconcile campaign spend, and manage post-conversion fraud. Advertisers and publishers are important supporting audiences, but the platform operator is the buyer.

The page succeeds when a potential customer can understand the product's three differentiators within seconds and is motivated to inspect the interactive product demonstration:

1. Threshold-free player payouts.
2. Auditable campaign spend and settlement.
3. Reversible rewards during a defined fraud window.

The primary conversion action is **View live demo**.

## Positioning

RewardRail is a programmable payout and settlement layer for rewarded advertising. It locks campaign budgets in escrow, turns verified actions into multi-party distributions, and allows fraudulent rewards to be clawed back during a defined risk window.

The landing page must lead with the business outcome rather than the underlying chain. Stellar is the infrastructure proof: it explains how RewardRail achieves low-cost settlement, sponsored accounts, auditability, and asset clawback. It is not the headline product category.

Recommended hero message:

> **Every verified action pays everyone. Instantly.**  
> Lock campaign budgets, split every conversion, and reverse fraudulent rewards—with every movement verifiable on-chain.

The interface must avoid presenting the player experience as a wallet. Terms such as wallet, seed phrase, private key, gas, and blockchain must not appear in player-facing product previews.

## Design Direction

The selected direction is **Live Money Flow**: Bridge-like visual confidence combined with the explanatory clarity of Stripe Connect. The page centers on a living product visualization that shows advertiser funds entering escrow, a verified action arriving, and value splitting among the player, publisher, and platform.

The page also incorporates a concise before-and-after comparison from a more category-led rewarded-advertising narrative. This grounds the infrastructure story in recognizable customer problems without making the whole site feel like an industry explainer.

### Reference principles

- **Bridge:** bold editorial hero treatment and movement of money as the central visual motif.
- **Stripe Connect:** clear multi-party payment explanation and product-led page structure.
- **HIFI:** programmable routing, escrow, and conditional transfer language.
- **Rain:** premium, credible fintech presentation without crypto-first styling.
- **Stellar:** technical proof, network performance, and ecosystem credibility.
- **AdQuest and RevU:** rewarded-advertising vocabulary and customer framing.
- **Adparagon:** operator, verification, and fraud-monitoring interface patterns.

These references guide structure and tone only. RewardRail will have an original visual system and original interface scenes.

## Information Architecture

The landing page is a single-page narrative. Navigation anchors let visitors jump to the main product sections without interrupting the story.

### 1. Navigation

- RewardRail wordmark.
- Anchors for Product, How it works, and Security.
- Persistent primary action: View live demo.
- Compact mobile menu with the same destinations and CTA.

### 2. Hero

- Outcome-led headline and short product definition.
- Primary CTA: View live demo.
- Secondary text link: See how it works.
- Interactive money-flow scene showing:
  - advertiser campaign budget;
  - escrow balance;
  - verified action signal;
  - player, publisher, and platform allocations;
  - a visible shortened transaction hash.

The hero must communicate the product before a visitor scrolls or reads technical detail.

### 3. Proof strip

A compact credibility row communicates:

- Built on Stellar.
- Settlement in seconds.
- Campaign funds held in escrow.
- Rewards reversible within the risk window.

Only verifiable product or network claims may appear. The page must not use invented customer logos, transaction volume, testimonials, or adoption metrics.

### 4. Old rail versus RewardRail

A before-and-after comparison connects familiar operational problems to concrete outcomes:

| Existing rewarded-ad rail | RewardRail |
| --- | --- |
| $10–15 payout threshold | Per-action, threshold-free payout |
| Monthly publisher reconciliation | Claim visible after every verified action |
| Advertiser trusts a platform report | Spend independently auditable on-chain |
| Post-payout fraud becomes a loss | Reward reversible during the risk window |
| Separate payout integration per market | One programmable settlement layer |

The comparison should be visually concise and must not overstate production capabilities that remain outside the project scope.

### 5. How it works

Four sequential steps form the central product explanation:

1. **Fund the campaign:** the advertiser locks the campaign budget and distribution ratios.
2. **Verify the action:** the platform validator approves a completed task.
3. **Split automatically:** the action releases the configured shares for the player, publisher, and platform.
4. **Reverse fraud when necessary:** a fraudulent reward can return to campaign escrow during the risk window.

### 6. Core value pillars

Three product-led sections pair customer value with a concrete interface detail:

- **Pay without thresholds:** even low-value rewards can settle without forcing users to accumulate a minimum balance.
- **Prove every dollar:** campaign budget, releases, accrued claims, and refunds have a visible audit trail.
- **Recover fraudulent rewards:** clawback applies to the issued reward asset within a defined period; trusted users and converted funds remain untouched.

### 7. Actor views

An interactive tabbed product scene presents the same transaction from four perspectives:

- **Advertiser:** locked budget, spent and remaining values, and the fixed ratio table.
- **Player:** reward balance, trust tier, availability state, and task completion.
- **Publisher:** accrued claim and withdrawal state.
- **Operator:** player risk signals, fraud flagging, and clawback result.

The transaction identity remains stable as tabs change so visitors understand that each actor is observing the same underlying event.

### 8. Infrastructure and trust

This section explains the mechanisms behind the promise without turning into documentation:

- campaign escrow;
- signed action proofs and replay protection;
- sponsored accounts and fee-bump transactions;
- protocol-level clawback for the REWARD asset;
- visible Stellar transaction proof.

Technical terminology is acceptable here because the section targets platform decision-makers and technical evaluators.

### 9. Final CTA

Headline: **See every dollar move.**

- Primary CTA: View live demo.
- Secondary CTA: Explore transactions.

During the landing-only delivery, View live demo scrolls to the interactive actor/product scene. Once the separate testnet demo route exists, the destination changes to `/demo`. No inactive or misleading CTA will be shipped.

### 10. Footer

Reserved links:

- Product.
- Documentation.
- Stellar Explorer.
- GitHub.

Only destinations that exist at implementation time will be interactive.

## Visual System

### Color

- Warm off-white or very light gray foundation.
- Near-black or deep navy primary text.
- Electric green primary accent for successful settlement and active flow.
- Blue secondary accent for infrastructure and verification.
- Restrained coral red for fraud and clawback states.

The design must avoid common Web3 visual shorthand: neon-purple gradients, floating coins, anonymous token symbols, galaxy backgrounds, and decorative grid overload.

### Typography

- Large, tightly composed display type for key outcomes.
- Highly legible sans-serif text for product explanation and interface elements.
- Tabular numerals for balances, shares, and transaction data.
- Clear type-scale contrast rather than excessive font-weight variation.

### Surfaces and composition

- Generous whitespace and a strong editorial grid.
- Product panels with restrained radii and borders; no toy-like cards.
- Interface elements serve the narrative rather than decorating empty space.
- Subtle depth and shadows may distinguish layers of the money flow, but glassmorphism is not the primary surface treatment.

## Motion System

Motion is functional: it explains state change, distribution, and reversal.

### Hero flow

The hero loops through a calm sequence:

1. Budget enters campaign escrow.
2. A verified-action signal arrives.
3. The configured amount leaves the available budget.
4. The value splits among player, publisher, and platform.
5. Balances update and a transaction hash appears.
6. The scene pauses before repeating.

The loop must be slow enough to inspect and must not demand interaction to understand.

### Scroll and component motion

- The comparison section transitions from delayed/batched states to per-action settlement as it enters the viewport.
- The How it works connector advances through its four steps in sequence.
- Actor tabs preserve the transaction context while their panels cross-fade or slide over short distances.
- Fraud reversal moves the affected reward back toward escrow in a controlled motion. It must not use alarms, screen shake, or aggressive flashing.
- Section entrances use subtle opacity and translation transitions.
- Decorative parallax is excluded unless testing proves it materially improves comprehension.

### Accessibility and performance

- `prefers-reduced-motion` disables continuous and scroll-driven motion while preserving every state as readable static content.
- Animations use transforms and opacity where possible.
- Mobile uses a simplified vertical flow and fewer simultaneous moving elements.
- Motion must not cause layout shifts or block interaction.
- All interactive controls remain usable with keyboard and touch input.

## Responsive Behavior

### Desktop

- Wide editorial grid.
- Hero copy and money-flow visualization may share a two-column composition.
- Actor views can show navigation and detailed panel content simultaneously.

### Tablet

- Hero remains two-column while space permits, then stacks without shrinking interface text below comfortable reading size.
- Dense comparison and product grids reduce column count.

### Mobile

- Hero becomes a vertical story: proposition, CTA, then a compact top-to-bottom money flow.
- Actor navigation becomes a horizontally scrollable tab list or an accessible select-like control.
- Tables become cards or horizontally scroll only when the relationship would otherwise be lost.
- Persistent motion is reduced and hover-only information is prohibited.

## Technical Architecture

The landing will live in the existing monorepo under `packages/web` as a standalone Next.js application.

### Stack

- Next.js with App Router.
- TypeScript.
- Tailwind CSS.
- Motion for React for orchestrated UI animation.
- Lucide for interface icons.
- SVG and CSS for original diagrams and money-flow visuals.

No external CMS, analytics platform, backend dependency, or stock-image service is required for the landing delivery.

### Proposed structure

```text
packages/web/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── landing/
│   │   ├── navbar.tsx
│   │   ├── hero.tsx
│   │   ├── proof-strip.tsx
│   │   ├── comparison.tsx
│   │   ├── how-it-works.tsx
│   │   ├── value-pillars.tsx
│   │   ├── actor-views.tsx
│   │   ├── infrastructure.tsx
│   │   ├── final-cta.tsx
│   │   └── footer.tsx
│   ├── money-flow/
│   │   ├── money-flow-scene.tsx
│   │   ├── flow-node.tsx
│   │   └── transaction-pulse.tsx
│   └── ui/
├── data/
│   └── landing.ts
├── public/
└── package.json
```

Components may be consolidated when a boundary adds no clarity, but the page must not become a single monolithic component. Content that is repeated or drives UI states belongs in `data/landing.ts`.

### State and data

- Landing content is static local data.
- Hero flow and actor tabs use local UI state only.
- No fake network request is made.
- Demonstration amounts and transaction identifiers are clearly sample data unless connected to testnet later.
- The animation state machine has deterministic states so reduced-motion and automated tests can render stable output.

### Failure handling

- The page remains fully understandable if JavaScript animation does not start.
- Unsupported animation features fall back to static SVG/CSS states.
- Links are emitted only for known destinations.
- If live transaction data is added later, loading, unavailable, and stale states must be designed before integration; they are outside this landing-only scope.

## Accessibility

- Semantic section headings and landmark elements.
- Keyboard-accessible navigation, actor tabs, and CTAs.
- Visible focus styles consistent with the brand palette.
- Sufficient text, border, and status-color contrast.
- Status is never communicated by color alone.
- Decorative motion and SVG elements are hidden from assistive technology; meaningful diagrams receive concise accessible labels.
- Touch targets meet a minimum comfortable size.
- Reduced-motion behavior is verified, not merely declared.

## Verification

Implementation is complete only after the following checks pass:

1. TypeScript type checking.
2. ESLint.
3. Production Next.js build.
4. Desktop, tablet, and mobile visual inspection.
5. Keyboard navigation and focus-state inspection.
6. Reduced-motion inspection.
7. No horizontal overflow at supported viewport sizes.
8. Browser console free of runtime and hydration errors.
9. Basic Lighthouse review for performance and accessibility.

Visual QA must inspect animation start, loop, tab switching, fraud reversal, and the static reduced-motion equivalents.

## Scope Boundaries

### Included

- Public single-page landing under `packages/web`.
- Original responsive interface visuals.
- Interactive money-flow and actor-view demonstrations.
- Motion, reduced-motion, accessibility, and production verification.
- CTA behavior that reaches an existing interactive scene.

### Excluded

- Production customer authentication.
- Real campaign creation from the landing.
- Live Soroban or Horizon integration.
- The complete four-panel testnet operator demo route.
- CMS, analytics, lead capture, or sales backend.
- Invented social proof or production metrics.

These exclusions keep the landing credible: it presents the product vision and demonstrable flow without implying unavailable production capabilities.

