export type NavItem = { label: string; href: `#${string}` };
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
};
export type ActorView = {
  id: "advertiser" | "player" | "publisher" | "operator";
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  stats: ReadonlyArray<{ label: string; value: string; tone?: "positive" | "warning" }>;
  activity: string;
  transaction: string;
};
export type InfrastructureItem = {
  title: string;
  description: string;
  tag: string;
};
export type FooterLink = {
  label: string;
  enabled: boolean;
  href?: string;
};

export const navItems: ReadonlyArray<NavItem> = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
];

export const proofItems: ReadonlyArray<ProofItem> = [
  { value: "Stellar", label: "Settlement infrastructure" },
  { value: "Seconds", label: "From action to payout" },
  { value: "Escrowed", label: "Campaign budget" },
  { value: "Reversible", label: "Inside the risk window" },
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
    description: "Lock the campaign budget and fixed distribution rules in escrow.",
    signal: "$100.00 locked",
  },
  {
    number: "02",
    title: "Verify the action",
    description: "Your validator approves a completed install, signup, or purchase.",
    signal: "Action verified",
  },
  {
    number: "03",
    title: "Split automatically",
    description: "The configured shares become visible to every participant at once.",
    signal: "$0.40 distributed",
  },
  {
    number: "04",
    title: "Reverse fraud",
    description: "Recover the affected reward during its defined risk window.",
    signal: "Campaign restored",
  },
];

export const valuePillars: ReadonlyArray<ValuePillar> = [
  {
    id: "thresholds",
    eyebrow: "Threshold-free payouts",
    title: "Pay the moment value is created.",
    description:
      "Low-value rewards settle per action, so players do not wait weeks to reach an arbitrary minimum.",
    metric: "$0.40",
    metricLabel: "ready after one verified action",
  },
  {
    id: "audit",
    eyebrow: "Auditable campaign spend",
    title: "Make every dollar explain itself.",
    description:
      "Budget, distributions, publisher claims, and refunds share one permanent transaction trail.",
    metric: "8f3a...c921",
    metricLabel: "visible settlement proof",
  },
  {
    id: "recovery",
    eyebrow: "Reversible rewards",
    title: "Stop paying twice for fraud.",
    description:
      "Recover a fraudulent reward during the risk window without touching trusted or converted funds.",
    metric: "24h",
    metricLabel: "configurable new-account window",
  },
];

export const actorViews: ReadonlyArray<ActorView> = [
  {
    id: "advertiser",
    label: "Advertiser",
    eyebrow: "Campaign control",
    title: "Know where the budget went.",
    description: "See locked, spent, and remaining funds against immutable share rules.",
    stats: [
      { label: "Locked", value: "$100.00" },
      { label: "Spent", value: "$4.00" },
      { label: "Remaining", value: "$96.00", tone: "positive" },
    ],
    activity: "10 verified actions settled",
    transaction: "8f3a...c921",
  },
  {
    id: "player",
    label: "Player",
    eyebrow: "Reward balance",
    title: "Complete a task. See the reward.",
    description: "A familiar balance experience with no setup cost and no payout threshold.",
    stats: [
      { label: "Available", value: "$0.40", tone: "positive" },
      { label: "Status", value: "Trusted" },
      { label: "Wait", value: "None" },
    ],
    activity: "Task approved · reward available",
    transaction: "8f3a...c921",
  },
  {
    id: "publisher",
    label: "Publisher",
    eyebrow: "Accrued share",
    title: "Reconcile on your schedule.",
    description: "Watch each action increase the claim, then withdraw whenever operations require it.",
    stats: [
      { label: "Accrued", value: "$1.80", tone: "positive" },
      { label: "Actions", value: "10" },
      { label: "Minimum", value: "$0" },
    ],
    activity: "Share accrued from the same action",
    transaction: "8f3a...c921",
  },
  {
    id: "operator",
    label: "Operator",
    eyebrow: "Risk operations",
    title: "Respond after the payout event.",
    description: "Review signals and recover only the affected conditional reward.",
    stats: [
      { label: "Risk", value: "High", tone: "warning" },
      { label: "Window", value: "18h 42m" },
      { label: "Recoverable", value: "$0.40" },
    ],
    activity: "Emulator signal requires review",
    transaction: "8f3a...c921",
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
  { label: "Product", enabled: true, href: "#product" },
  { label: "Documentation", enabled: false },
  { label: "Stellar Explorer", enabled: false },
  { label: "GitHub", enabled: false },
];
