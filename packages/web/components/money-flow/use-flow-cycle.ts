"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import {
  nextFlowPhase,
  phaseDurations,
  type FlowPhase,
} from "./flow-model";

export function useFlowCycle(): FlowPhase {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<FlowPhase>("funding");

  useEffect(() => {
    if (reduceMotion) return;

    const timeout = window.setTimeout(
      () => setPhase((current) => nextFlowPhase(current)),
      phaseDurations[phase],
    );

    return () => window.clearTimeout(timeout);
  }, [phase, reduceMotion]);

  return reduceMotion ? "settled" : phase;
}
