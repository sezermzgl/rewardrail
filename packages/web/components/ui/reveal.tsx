"use client";

import { motion, useReducedMotion } from "motion/react";
import type { PropsWithChildren } from "react";

type RevealProps = PropsWithChildren<{ className?: string; delay?: number }>;

/**
 * Fade and lift a block as it scrolls into view.
 *
 * This used to pass `initial={false}`, which meant the element started at its
 * final values and the `whileInView` target had nothing to animate from — the
 * page shipped with a reveal that revealed nothing. The initial state is real
 * now, and the no-JS case is covered by the `[data-reveal]` rule in the
 * layout's `<noscript>` rather than by never animating at all.
 *
 * `once: true` so a section settles the first time it is reached and does not
 * flicker on the way back up, and `amount: 0.18` so it starts as the block
 * appears rather than once it is nearly past.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
