"use client";

import { motion } from "motion/react";
import {
  Building2,
  Check,
  CircleDollarSign,
  Layers3,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FlowNode } from "./flow-node";
import { useFlowCycle } from "./use-flow-cycle";

type MoneyFlowSceneProps = { compact?: boolean };

const phaseCopy = {
  funding: "Budget secured",
  verifying: "Action verified",
  splitting: "Splitting $0.40",
  settled: "Settlement complete",
} as const;

export function MoneyFlowScene({ compact = false }: MoneyFlowSceneProps) {
  const phase = useFlowCycle();
  const isSettled = phase === "settled";
  const isSplitting = phase === "splitting" || isSettled;

  return (
    <figure
      className={`money-flow ${compact ? "money-flow--compact" : ""}`}
      data-phase={phase}
      aria-label="Campaign settlement flow from advertiser escrow to player, publisher, and platform"
    >
      <div className="money-flow__topline">
        <span className="money-flow__live">
          <i aria-hidden="true" /> Live campaign
        </span>
        <span>RR-2048</span>
      </div>

      <div className="money-flow__source">
        <FlowNode
          icon={Building2}
          label="Advertiser budget"
          value="$100.00"
          detail="Funded"
          active={phase === "funding"}
        />
        <motion.div
          className="money-flow__rail money-flow__rail--in"
          animate={{ opacity: phase === "funding" ? 1 : 0.45 }}
        >
          <span aria-hidden="true" />
        </motion.div>
        <FlowNode
          icon={ShieldCheck}
          label="Campaign escrow"
          value={isSplitting ? "$99.60" : "$100.00"}
          detail="Secured"
          active={phase === "verifying" || phase === "splitting"}
          tone="blue"
        />
      </div>

      <motion.div
        className="money-flow__status"
        key={phase}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="money-flow__status-icon" aria-hidden="true">
          {isSettled ? <Check size={14} /> : <CircleDollarSign size={14} />}
        </span>
        {phaseCopy[phase]}
      </motion.div>

      <div className="money-flow__branches" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="money-flow__destinations">
        <FlowNode
          icon={UserRound}
          label="Player"
          value="$0.12"
          detail="Available now"
          active={isSplitting}
          tone="green"
        />
        <FlowNode
          icon={Layers3}
          label="Publisher"
          value="$0.18"
          detail="Claim accrued"
          active={isSplitting}
        />
        <FlowNode
          icon={CircleDollarSign}
          label="Platform"
          value="$0.10"
          detail="Fee settled"
          active={isSplitting}
        />
      </div>

      <div className="money-flow__transaction">
        <span>Transaction proof</span>
        <code>8f3a...c921</code>
        <span className="money-flow__verified">
          <Check size={12} aria-hidden="true" /> Verified
        </span>
      </div>
    </figure>
  );
}
