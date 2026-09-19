export type FlowPhase = "funding" | "verifying" | "splitting" | "settled";

const phases: ReadonlyArray<FlowPhase> = [
  "funding",
  "verifying",
  "splitting",
  "settled",
];

export const phaseDurations: Record<FlowPhase, number> = {
  funding: 1400,
  verifying: 1100,
  splitting: 1600,
  settled: 2400,
};

export function nextFlowPhase(phase: FlowPhase): FlowPhase {
  const current = phases.indexOf(phase);
  return phases[(current + 1) % phases.length];
}
