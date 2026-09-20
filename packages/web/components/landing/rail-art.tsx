"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * The green rail behind the problem and solution pills, drifting as the
 * section passes.
 *
 * A rail that holds perfectly still while everything in front of it scrolls
 * reads as wallpaper. Moving it a little slower than the page makes it sit
 * behind the pills rather than beside them — which is the whole point of the
 * composition, and the reason the pills are positioned to ride it.
 *
 * The drift is small on purpose: 90px across a section that is more than a
 * screen tall. Enough to feel, not enough to pull the pills off the line.
 */
export function RailArt() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-45, 45]);

  return (
    <div ref={ref} className="rail-story__art-host" aria-hidden="true">
      <motion.div
        className="rail-story__art"
        style={reduceMotion ? undefined : { y }}
      />
    </div>
  );
}
