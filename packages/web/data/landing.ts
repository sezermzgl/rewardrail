/**
 * The landing page's content.
 *
 * Every figure below comes from one recorded testnet run — campaign 8 of the
 * deployed escrow, rehearsed through the public URL and written up in
 * `docs/04-demo-rehearsal.md`. Nothing here is a number somebody picked
 * because it looked good, and every hash resolves in Stellar Expert. A page
 * that claims auditability and then illustrates itself with invented
 * screenshots argues against its own case.
 */
import { config, explorerContract, explorerTx } from "@/lib/chain/config";

export type NavItem = { label: string; href: string };
export type ProofItem = { value: string; label: string };
export type ComparisonRow = { legacy: string; rewardRail: string };
export type ProcessStep = {
  number: string;
  title: string;
  description: string;
  signal: string;
};
export type ValuePillar = {
  id: "thresholds" | "audit" | "recovery";
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  /** Present when the metric is a transaction somebody can go and check. */
  proof?: ProofLink;
};
/** A transaction from the recorded run, as the page links to it. */
export type ProofLink = { label: string; short: string; url: string };
export type ActorView = {
  id: "advertiser" | "player" | "publisher" | "operator";
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  stats: ReadonlyArray<{ label: string; value: string; tone?: "positive" | "warning" }>;
  activity: string;
  proof: ProofLink;
};
export type InfrastructureItem = {
  title: string;
  description: string;
  tag: string;
};
export type FooterLink = {
  label: string;
  href: string;
  /** Opens off-site, so it gets the rel/target treatment. */
  external?: boolean;
};

/** Where the two working product surfaces live. */
export const routes = {
  console: "/demo",
  player: "/play",
} as const;

export const repoUrl = "https://github.com/sezermzgl/rewardrail";
export const docsUrl = `${repoUrl}/tree/main/docs`;

const shorten = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

/** A hash from the recorded run, turned into something clickable. */
function proof(label: string, hash: string): ProofLink {
  return { label, short: shorten(hash), url: explorerTx(hash) };
}

/**
 * The run the whole page is built on: campaign 8, 12 USDC at 4.00 per action,
 * two settled actions, one reward reversed, the remainder refunded at close.
 * 12 = 8 − 1.20 + 5.20, and each leg is a link below.
 */
const run = {
  open: proof("Campaign opened", "02aa98ead2b23e11cc8d1cef60a9d571688ffa1e5308fd10ad98795a378812b6"),
  reward: proof("Reward paid", "3759c66a7efe2ea56b8bf82d459f966858a8a7bd60dba63de44fdb319e542fa2"),
  withdraw: proof("Publisher withdrawal", "1febf69ed3b4625b3922a238c74244055c73afab7111454e2180c827bd037441"),
  clawback: proof("Reward reversed", "9b0b4bb01e070952a6f50d5ecafa33db4a4a9b83445283b117136bff45697cbe"),
  close: proof("Budget refunded", "d7b07aedcb5071c41d4709ec932d8e95a8db01cefa85374ce4e8b26fbf58f049"),
} as const;

export const escrowLink = {
  id: config.escrowId,
  short: `${config.escrowId.slice(0, 6)}…${config.escrowId.slice(-6)}`,
  url: explorerContract(config.escrowId),
};

export const navItems: ReadonlyArray<NavItem> = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Proof", href: "#live-demo" },
  { label: "Security", href: "#security" },
];

/**
 * Short values on purpose: the band lays them out in one row, and a value
 * that wraps to a second line pulls its neighbours out of alignment. The
 * label carries the sentence.
 */
export const proofItems: ReadonlyArray<ProofItem> = [
  { value: "Live", label: "Deployed on Stellar testnet" },
  { value: "4.00", label: "USDC released per verified action" },
  { value: "60s", label: "Reversal window, held by the ledger" },
  { value: "13", label: "Transactions in one recorded run" },
];

export const comparisonRows: ReadonlyArray<ComparisonRow> = [
  { legacy: "$10–15 payout threshold", rewardRail: "Per-action payout" },
  { legacy: "Monthly reconciliation", rewardRail: "Live publisher claim" },
  { legacy: "Platform-reported spend", rewardRail: "Independent audit trail" },
  { legacy: "Fraud written off", rewardRail: "Reward recovered in-window" },
  { legacy: "A rail for every market", rewardRail: "One settlement layer" },
];

export const processSteps: ReadonlyArray<ProcessStep> = [
  {
    number: "01",
    title: "Fund the campaign",
    description:
      "The advertiser locks the budget and a fixed split table in a Soroban escrow. No function changes the table afterwards.",
    signal: "12.00 USDC locked",
  },
  {
    number: "02",
    title: "Verify the action",
    description:
      "Your own validator signs a proof for a completed install, signup or purchase. The chain never has to know whether the player really played.",
    signal: "Proof signed and settled",
  },
  {
    number: "03",
    title: "Split automatically",
    description:
      "One settle releases 4.00 and accrues all three shares at once — player, publisher and platform — at ratios the contract enforces.",
    signal: "1.20 · 1.80 · 1.00",
  },
  {
    number: "04",
    title: "Reverse fraud",
    description:
      "Inside the window the reward is frozen on the ledger, so a flagged payout is clawed back and returned to the campaign budget.",
    signal: "1.20 USDC reversed",
  },
];

export const valuePillars: ReadonlyArray<ValuePillar> = [
  {
    id: "thresholds",
    eyebrow: "Threshold-free payouts",
    title: "Pay the moment value is created.",
    description:
      "A Stellar fee is around 0.00001 XLM, so a 1.20 reward can be paid on its own. Players do not wait weeks to clear an arbitrary minimum.",
    metric: "1.20 USDC",
    metricLabel: "paid after one verified action",
    proof: run.reward,
  },
  {
    id: "audit",
    eyebrow: "Auditable campaign spend",
    title: "Make every dollar explain itself.",
    description:
      "Budget, releases, publisher claims and the refund at close all land in one permanent trail the advertiser reads for itself.",
    metric: "5.20 USDC",
    metricLabel: "unspent budget returned by the contract",
    proof: run.close,
  },
  {
    id: "recovery",
    eyebrow: "Reversible rewards",
    title: "Stop paying twice for fraud.",
    description:
      "The reward is frozen on the ledger for the window, not merely flagged — so a fraudulent payout comes back, and a converted one never does.",
    metric: "60s",
    metricLabel: "window in the demo, 24h by default",
    proof: run.clawback,
  },
];

export const actorViews: ReadonlyArray<ActorView> = [
  {
    id: "advertiser",
    label: "Advertiser",
    eyebrow: "Campaign control",
    title: "Know where the budget went.",
    description:
      "The budget sits in a contract neither the platform nor the advertiser can move at will, against a split table that is fixed for the campaign's life.",
    stats: [
      { label: "Locked", value: "12.00" },
      { label: "Released", value: "8.00" },
      { label: "Refunded at close", value: "5.20", tone: "positive" },
    ],
    activity: "2 verified actions settled, remainder returned",
    proof: run.open,
  },
  {
    id: "player",
    label: "Player",
    eyebrow: "Reward balance",
    title: "Complete a task. See the reward.",
    description:
      "The account is opened from an email address and there is nothing for the player to set up, fund or look after. No fee, and no threshold to clear.",
    stats: [
      { label: "Earned", value: "1.20", tone: "positive" },
      { label: "Wait", value: "None" },
      { label: "Setup", value: "Email only" },
    ],
    activity: "Task approved · reward paid and frozen for the window",
    proof: run.reward,
  },
  {
    id: "publisher",
    label: "Publisher",
    eyebrow: "Accrued share",
    title: "Reconcile on your schedule.",
    description:
      "The share accrues in escrow on every settled action and is pulled out in one transaction whenever operations require it.",
    stats: [
      { label: "Accrued", value: "3.60", tone: "positive" },
      { label: "Actions", value: "2" },
      { label: "Minimum", value: "None" },
    ],
    activity: "45% of each action, withdrawn on demand",
    proof: run.withdraw,
  },
  {
    id: "operator",
    label: "Operator",
    eyebrow: "Risk operations",
    title: "Respond after the payout event.",
    description:
      "Flagging claws the reward back and refunds the campaign by exactly that amount. A player who already converted keeps their money — that is the window, not a hole in it.",
    stats: [
      { label: "Reversed", value: "1.20", tone: "warning" },
      { label: "Window", value: "60s" },
      { label: "Untouched", value: "1.20" },
    ],
    activity: "One account flagged · the honest payout stands",
    proof: run.clawback,
  },
];

export const infrastructureItems: ReadonlyArray<InfrastructureItem> = [
  {
    title: "Campaign escrow",
    description: "Budget leaves escrow only against an authorized action proof and fixed split rules.",
    tag: "Controlled funds",
  },
  {
    title: "Replay-protected proofs",
    description: "Each action identity settles once, even when a request is retried.",
    tag: "Signed verification",
  },
  {
    title: "Invisible account setup",
    description: "Sponsored reserves and fee-bump transactions keep network mechanics out of the player flow.",
    tag: "Zero setup cost",
  },
  {
    title: "Protocol-level recovery",
    description: "Conditional REWARD balances can return to campaign escrow during the defined risk window.",
    tag: "Scoped clawback",
  },
];

export const footerLinks: ReadonlyArray<FooterLink> = [
  { label: "Live console", href: routes.console },
  { label: "Player app", href: routes.player },
  { label: "Documentation", href: docsUrl, external: true },
  { label: "Escrow contract", href: escrowLink.url, external: true },
  { label: "GitHub", href: repoUrl, external: true },
];
