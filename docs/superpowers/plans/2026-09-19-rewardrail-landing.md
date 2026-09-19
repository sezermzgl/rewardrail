# RewardRail Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-quality, responsive RewardRail B2B landing page with an animated money-flow hero, product proof, actor views, and a working View live demo journey.

**Architecture:** Create a standalone Next.js App Router application in the existing `packages/web` workspace. Keep marketing content in typed local data, isolate deterministic animation state from presentation, and compose focused landing sections from reusable primitives. Tests cover content integrity, navigation, tab behavior, deterministic flow state, reduced motion, and link safety before visual browser QA.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Motion for React, Lucide React, Vitest, React Testing Library, jsdom

**Spec:** `docs/superpowers/specs/2026-09-19-rewardrail-landing-design.md`

## Global Constraints

- All product implementation stays under `packages/web`; do not modify `packages/scripts`, `packages/contracts`, or `packages/validator`.
- Use App Router, TypeScript, Tailwind CSS, Motion for React, Lucide, and original CSS/SVG product visuals.
- The primary CTA label is exactly `View live demo` and must resolve to an existing interactive scene.
- Never invent customer logos, testimonials, transaction volume, or adoption metrics.
- Player-facing UI must not use the terms wallet, seed phrase, private key, gas, or blockchain.
- The page must remain understandable without animation and with `prefers-reduced-motion` enabled.
- Motion should rely on transforms and opacity, avoid layout shift, and simplify on mobile.
- Do not add a CMS, analytics, backend service, stock-image dependency, or live chain integration.
- Existing user or agent changes outside `packages/web` and this plan remain untouched.

## Review Focus

- A reduced-motion visitor sees a complete settled flow with no endless or hidden intermediate state; pin this in Task 3.
- Keyboard users can operate the actor tabs and reach every CTA with visible focus; pin tab semantics in Task 5 and inspect focus in Task 6.
- Unknown or unavailable footer destinations never render as dead clickable links; pin this in Task 2.
- Player-facing copy never leaks prohibited crypto-custody terms; pin this in Task 2.
- Mobile widths do not overflow when transaction hashes, tabs, or money nodes are present; pin structural class behavior in Task 5 and visually verify in Task 6.

---

## File Map

### Application shell and configuration

- `packages/web/package.json`: workspace scripts and runtime/test dependencies.
- `packages/web/tsconfig.json`: strict TypeScript and Next.js aliases.
- `packages/web/next.config.ts`: Next.js configuration.
- `packages/web/postcss.config.mjs`: Tailwind PostCSS plugin.
- `packages/web/eslint.config.mjs`: Next.js ESLint configuration.
- `packages/web/vitest.config.ts`: jsdom test configuration.
- `packages/web/vitest.setup.ts`: Testing Library matchers and browser API shims.
- `packages/web/app/layout.tsx`: metadata, fonts, and document shell.
- `packages/web/app/globals.css`: tokens, resets, utilities, focus, and reduced-motion fallbacks.
- `packages/web/app/page.tsx`: ordered landing-page composition only.

### Typed content and shared UI

- `packages/web/data/landing.ts`: navigation, proof, comparison, steps, pillars, actors, infrastructure, and footer content.
- `packages/web/components/ui/button-link.tsx`: consistent internal/external CTA rendering.
- `packages/web/components/ui/section-heading.tsx`: eyebrow, heading, and description pattern.
- `packages/web/components/ui/reveal.tsx`: reduced-motion-aware viewport reveal wrapper.

### Money-flow feature

- `packages/web/components/money-flow/flow-model.ts`: deterministic phases and next-state function.
- `packages/web/components/money-flow/use-flow-cycle.ts`: timed phase cycling with reduced-motion handling.
- `packages/web/components/money-flow/flow-node.tsx`: accessible visual node.
- `packages/web/components/money-flow/money-flow-scene.tsx`: composed animated transaction scene.

### Landing sections

- `packages/web/components/landing/navbar.tsx`
- `packages/web/components/landing/hero.tsx`
- `packages/web/components/landing/proof-strip.tsx`
- `packages/web/components/landing/comparison.tsx`
- `packages/web/components/landing/how-it-works.tsx`
- `packages/web/components/landing/value-pillars.tsx`
- `packages/web/components/landing/actor-views.tsx`
- `packages/web/components/landing/infrastructure.tsx`
- `packages/web/components/landing/final-cta.tsx`
- `packages/web/components/landing/footer.tsx`

### Tests

- `packages/web/data/landing.test.ts`
- `packages/web/components/money-flow/flow-model.test.ts`
- `packages/web/components/money-flow/money-flow-scene.test.tsx`
- `packages/web/components/landing/actor-views.test.tsx`
- `packages/web/app/page.test.tsx`

---

### Task 1: Scaffold the Tested Web Workspace

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/next-env.d.ts`
- Create: `packages/web/next.config.ts`
- Create: `packages/web/postcss.config.mjs`
- Create: `packages/web/eslint.config.mjs`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/vitest.setup.ts`
- Create: `packages/web/app/layout.tsx`
- Create: `packages/web/app/globals.css`
- Create: `packages/web/app/page.tsx`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: root npm workspace configuration and Node.js 20+.
- Produces: `npm run dev -w @rewardrail/web`, `npm run test -w @rewardrail/web`, `npm run lint -w @rewardrail/web`, `npm run typecheck -w @rewardrail/web`, and `npm run build -w @rewardrail/web`.

- [ ] **Step 1: Create the workspace manifest and install dependencies**

Use this manifest, then run `npm install` from the repository root so the lockfile is updated by npm rather than edited manually:

```json
{
  "name": "@rewardrail/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lucide-react": "latest",
    "motion": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "jsdom": "latest",
    "tailwindcss": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Add strict TypeScript, Next.js, PostCSS, ESLint, and Vitest configuration**

Configure `@/*` to map to `packages/web/*`, `strict: true`, jsdom test environment, `vitest.setup.ts`, and the Tailwind PostCSS plugin. In setup, import `@testing-library/jest-dom/vitest` and stub `window.matchMedia` with listener methods so Motion and reduced-motion tests run consistently.

- [ ] **Step 3: Write the failing shell test**

Create `packages/web/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the RewardRail product proposition", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { name: /every verified action/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /view live demo/i })).toHaveAttribute("href", "#live-demo");
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test -w @rewardrail/web -- app/page.test.tsx`  
Expected: FAIL because the final page proposition is not implemented.

- [ ] **Step 5: Add the minimal application shell**

Add metadata in `layout.tsx`, import `globals.css`, and render an initial `<main>` containing the exact hero heading and `href="#live-demo"` CTA so the test passes. Define color/font/radius tokens and global focus-visible styles in `globals.css` without building final sections yet.

- [ ] **Step 6: Verify the scaffold**

Run:

```bash
npm run test -w @rewardrail/web -- app/page.test.tsx
npm run typecheck -w @rewardrail/web
npm run lint -w @rewardrail/web
```

Expected: all commands pass.

- [ ] **Step 7: Commit the scaffold**

```bash
git add package-lock.json packages/web
git commit -m "feat(web): scaffold RewardRail landing workspace"
```

### Task 2: Define Typed Content and Safe UI Primitives

**Files:**
- Create: `packages/web/data/landing.ts`
- Create: `packages/web/data/landing.test.ts`
- Create: `packages/web/components/ui/button-link.tsx`
- Create: `packages/web/components/ui/section-heading.tsx`
- Create: `packages/web/components/ui/reveal.tsx`

**Interfaces:**
- Consumes: React, Motion's `useReducedMotion`, and global design tokens.
- Produces: typed exports `navItems`, `proofItems`, `comparisonRows`, `processSteps`, `valuePillars`, `actorViews`, `infrastructureItems`, and `footerLinks`; UI components `ButtonLink`, `SectionHeading`, and `Reveal`.

- [ ] **Step 1: Write content-integrity tests**

```ts
import { actorViews, footerLinks, navItems } from "./landing";

const prohibited = /wallet|seed phrase|private key|\bgas\b|blockchain/i;

test("player-facing content avoids custody jargon", () => {
  const player = actorViews.find((item) => item.id === "player");
  expect(JSON.stringify(player)).not.toMatch(prohibited);
});

test("all enabled navigation destinations exist on this page", () => {
  expect(navItems.every((item) => item.href.startsWith("#"))).toBe(true);
});

test("footer only enables known destinations", () => {
  expect(footerLinks.filter((item) => item.enabled).every((item) => Boolean(item.href))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w @rewardrail/web -- data/landing.test.ts`  
Expected: FAIL because typed content exports do not exist.

- [ ] **Step 3: Implement the typed content model**

Define explicit types for link items, comparison rows, process steps, value pillars, actor views, and infrastructure items. Include all approved copy from the spec, use sample values such as `$100.00`, `$0.40`, and `8f3a...c921`, and mark unavailable footer destinations `enabled: false` without `href`.

- [ ] **Step 4: Implement primitives**

`ButtonLink` accepts `{ href, children, variant?: "primary" | "secondary"; className?: string }`. `SectionHeading` accepts `{ eyebrow, title, description?, align?: "left" | "center" }`. `Reveal` accepts `PropsWithChildren<{ className?: string; delay?: number }>` and returns static content when reduced motion is preferred.

- [ ] **Step 5: Verify content and types**

Run:

```bash
npm run test -w @rewardrail/web -- data/landing.test.ts
npm run typecheck -w @rewardrail/web
```

Expected: PASS.

- [ ] **Step 6: Commit typed content**

```bash
git add packages/web/data packages/web/components/ui
git commit -m "feat(web): add typed landing content and primitives"
```

### Task 3: Build the Deterministic Money-Flow Scene

**Files:**
- Create: `packages/web/components/money-flow/flow-model.ts`
- Create: `packages/web/components/money-flow/flow-model.test.ts`
- Create: `packages/web/components/money-flow/use-flow-cycle.ts`
- Create: `packages/web/components/money-flow/flow-node.tsx`
- Create: `packages/web/components/money-flow/money-flow-scene.tsx`
- Create: `packages/web/components/money-flow/money-flow-scene.test.tsx`

**Interfaces:**
- Consumes: Motion, Lucide icons, React state/effects, `window.matchMedia`.
- Produces: `type FlowPhase = "funding" | "verifying" | "splitting" | "settled"`, `nextFlowPhase(phase): FlowPhase`, `useFlowCycle(): FlowPhase`, and `<MoneyFlowScene compact?: boolean />`.

- [ ] **Step 1: Write failing state-machine tests**

```ts
import { nextFlowPhase } from "./flow-model";

test("cycles through the complete settlement story", () => {
  expect(nextFlowPhase("funding")).toBe("verifying");
  expect(nextFlowPhase("verifying")).toBe("splitting");
  expect(nextFlowPhase("splitting")).toBe("settled");
  expect(nextFlowPhase("settled")).toBe("funding");
});
```

- [ ] **Step 2: Run the model test and confirm failure**

Run: `npm run test -w @rewardrail/web -- components/money-flow/flow-model.test.ts`  
Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the phase model and timed hook**

Use a fixed phase order and a timeout map `{ funding: 1400, verifying: 1100, splitting: 1600, settled: 2400 }`. `useFlowCycle` returns `"settled"` immediately when `useReducedMotion()` is true; otherwise it advances with a cleaned-up timeout.

- [ ] **Step 4: Write failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { MoneyFlowScene } from "./money-flow-scene";

test("labels the full transaction without relying on animation", () => {
  render(<MoneyFlowScene />);
  expect(screen.getByLabelText(/campaign settlement flow/i)).toBeInTheDocument();
  expect(screen.getByText("Campaign escrow")).toBeInTheDocument();
  expect(screen.getByText("Player")).toBeInTheDocument();
  expect(screen.getByText("Publisher")).toBeInTheDocument();
  expect(screen.getByText("Platform")).toBeInTheDocument();
  expect(screen.getByText(/8f3a...c921/i)).toBeInTheDocument();
});
```

- [ ] **Step 5: Implement the scene**

Create a responsive CSS-grid/SVG composition. Render all nodes in the DOM at every phase, use phase data attributes and Motion opacity/transform changes to emphasize active states, label the figure, show allocation values, and display the sample hash in the settled region. Do not animate layout properties.

- [ ] **Step 6: Verify flow behavior**

Run:

```bash
npm run test -w @rewardrail/web -- components/money-flow
npm run typecheck -w @rewardrail/web
```

Expected: PASS, including the reduced-motion settled state.

- [ ] **Step 7: Commit the money-flow scene**

```bash
git add packages/web/components/money-flow
git commit -m "feat(web): visualize live multi-party settlement"
```

### Task 4: Compose Navigation, Hero, Proof, Comparison, and Process

**Files:**
- Create: `packages/web/components/landing/navbar.tsx`
- Create: `packages/web/components/landing/hero.tsx`
- Create: `packages/web/components/landing/proof-strip.tsx`
- Create: `packages/web/components/landing/comparison.tsx`
- Create: `packages/web/components/landing/how-it-works.tsx`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/page.test.tsx`

**Interfaces:**
- Consumes: typed content, `ButtonLink`, `SectionHeading`, `Reveal`, and `MoneyFlowScene`.
- Produces: page anchors `#product` and `#how-it-works`, responsive navigation, hero, proof strip, comparison, and four-step process.

- [ ] **Step 1: Expand the failing page test**

```tsx
test("exposes the primary product story and valid anchors", () => {
  render(<Page />);
  expect(screen.getByRole("navigation", { name: /primary/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /from completed action to settled payout/i })).toBeInTheDocument();
  expect(screen.getByText(/\$10–15 payout threshold/i)).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /view live demo/i })[0]).toHaveAttribute("href", "#live-demo");
});
```

- [ ] **Step 2: Run the page test and confirm failure**

Run: `npm run test -w @rewardrail/web -- app/page.test.tsx`  
Expected: FAIL because sections and navigation are absent.

- [ ] **Step 3: Implement the first page half**

Build a sticky translucent navbar with a CSS-only details/summary mobile menu, a two-column hero containing `MoneyFlowScene`, a four-item proof strip, an accessible comparison structure, and a numbered process connector. Keep all section content sourced from `data/landing.ts`.

- [ ] **Step 4: Add responsive and motion behavior**

Use grid breakpoints for hero and comparison, `Reveal` for section entry, and a transform-based process progress accent. Ensure the semantic reading order matches the visual order.

- [ ] **Step 5: Verify the composed first half**

Run:

```bash
npm run test -w @rewardrail/web -- app/page.test.tsx
npm run lint -w @rewardrail/web
npm run typecheck -w @rewardrail/web
```

Expected: PASS.

- [ ] **Step 6: Commit the product narrative**

```bash
git add packages/web/app packages/web/components/landing
git commit -m "feat(web): add landing hero and product narrative"
```

### Task 5: Build Value Pillars, Actor Demo, Trust, CTA, and Footer

**Files:**
- Create: `packages/web/components/landing/value-pillars.tsx`
- Create: `packages/web/components/landing/actor-views.tsx`
- Create: `packages/web/components/landing/actor-views.test.tsx`
- Create: `packages/web/components/landing/infrastructure.tsx`
- Create: `packages/web/components/landing/final-cta.tsx`
- Create: `packages/web/components/landing/footer.tsx`
- Modify: `packages/web/app/page.tsx`
- Modify: `packages/web/app/page.test.tsx`

**Interfaces:**
- Consumes: typed content and shared UI primitives.
- Produces: `#live-demo`, `#security`, accessible four-actor tabs, final CTA, and link-safe footer.

- [ ] **Step 1: Write failing actor-tab tests**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActorViews } from "./actor-views";

test("switches actor context while preserving the transaction", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  const playerTab = screen.getByRole("tab", { name: "Player" });
  await user.click(playerTab);
  expect(playerTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("8f3a...c921");
});

test("supports keyboard tab navigation", async () => {
  const user = userEvent.setup();
  render(<ActorViews />);
  screen.getByRole("tab", { name: "Advertiser" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Player" })).toHaveFocus();
});
```

- [ ] **Step 2: Run the actor test and confirm failure**

Run: `npm run test -w @rewardrail/web -- components/landing/actor-views.test.tsx`  
Expected: FAIL because `ActorViews` does not exist.

- [ ] **Step 3: Implement accessible actor views**

Use roving `tabIndex`, `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and one `role="tabpanel"`. Handle ArrowLeft, ArrowRight, Home, and End. Preserve the sample transaction hash in every view, use `min-w-0`, `overflow-wrap:anywhere`, and an overflow-safe tab strip.

- [ ] **Step 4: Implement the remaining sections**

Build three value pillars with product miniatures, a technical trust grid under `#security`, a final CTA that links back to `#live-demo`, and a footer that renders disabled destinations as text rather than anchors. Compose them into `page.tsx` in the approved order.

- [ ] **Step 5: Expand the complete-page test**

Assert that the page contains all three value headings, `#live-demo`, `#security`, the four actor tabs, the final `See every dollar move.` heading, and no anchor with an empty `href`.

- [ ] **Step 6: Run all automated checks**

Run:

```bash
npm run test -w @rewardrail/web
npm run lint -w @rewardrail/web
npm run typecheck -w @rewardrail/web
npm run build -w @rewardrail/web
```

Expected: all checks pass.

- [ ] **Step 7: Commit the full landing page**

```bash
git add packages/web
git commit -m "feat(web): complete interactive RewardRail landing"
```

### Task 6: Browser QA, Motion Polish, and Final Verification

**Files:**
- Modify: relevant `packages/web/app/globals.css`
- Modify: relevant files under `packages/web/components/`
- Modify: tests only when QA reveals an untested regression
- Modify: `packages/web/README.md`

**Interfaces:**
- Consumes: the complete built landing page.
- Produces: verified responsive behavior, polished motion, documented run commands, and no known visual/runtime errors.

- [ ] **Step 1: Start the production-like local server**

Run:

```bash
npm run build -w @rewardrail/web
npm run start -w @rewardrail/web
```

Expected: Next.js serves the built application locally without runtime errors.

- [ ] **Step 2: Inspect desktop layout and animation**

At approximately 1440×900, verify navbar stickiness, complete above-fold proposition, readable money nodes, calm loop timing, visible hash, sequential process motion, actor switching, fraud reversal, and final CTA. Check the browser console for hydration or runtime errors.

- [ ] **Step 3: Inspect tablet and mobile layouts**

At approximately 768×1024 and 390×844, verify stacked hero order, vertical money flow, usable mobile menu, no clipped hashes, no horizontal page overflow, reachable tabs, 44px touch targets, and no hover-only content.

- [ ] **Step 4: Inspect accessibility modes**

Enable reduced motion and confirm the flow renders settled, section content is visible, and no continuous animation runs. Navigate by keyboard through the navbar, CTA links, and actor tabs; confirm focus is always visible and arrow-key behavior matches the tests.

- [ ] **Step 5: Fix each observed issue and add regression coverage**

For behavioral issues, first add a failing Vitest/Testing Library assertion, run it to confirm failure, make the smallest implementation change, and rerun it. For pure layout issues, record the affected viewport in the commit message and adjust only the owning component or global token.

- [ ] **Step 6: Replace the web README stub**

Document purpose, prerequisites, and exact commands:

```markdown
# @rewardrail/web

RewardRail's responsive product landing page and interactive settlement preview.

## Run locally

From the repository root:

    npm install
    npm run dev -w @rewardrail/web

## Verify

    npm run test -w @rewardrail/web
    npm run lint -w @rewardrail/web
    npm run typecheck -w @rewardrail/web
    npm run build -w @rewardrail/web
```

- [ ] **Step 7: Run final verification**

Run:

```bash
npm run test -w @rewardrail/web
npm run lint -w @rewardrail/web
npm run typecheck -w @rewardrail/web
npm run build -w @rewardrail/web
git diff --check
```

Expected: all commands exit successfully and `git diff --check` prints nothing.

- [ ] **Step 8: Commit verified polish**

```bash
git add packages/web
git commit -m "fix(web): polish responsive landing experience"
```

