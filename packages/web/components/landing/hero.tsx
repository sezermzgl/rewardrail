"use client";

import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ButtonLink } from "@/components/ui/button-link";
import { routes } from "@/data/landing";

/**
 * Both buttons leave for something that runs.
 *
 * They used to scroll to a mock console further down the page, which meant a
 * visitor who came to see the product was shown a picture of it instead. The
 * console and the player app are deployed; the first thing the page offers
 * should be one of them.
 *
 * The entrance is on load rather than on scroll, because the hero is already
 * in view — the copy arrives a beat before the illustration, so the sentence
 * is the first thing read rather than something competing with a phone.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();

  // Motion's own reduced-motion handling still moves the element; this drops
  // the entrance entirely, which is what the preference actually asks for.
  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <section className="hero-block" id="top">
      <div className="hero container">
        <div className="hero__copy">
          <motion.p className="eyebrow" {...rise(0.05)}>
            Settlement infrastructure for rewarded ads — powered by Stellar
          </motion.p>
          <motion.h1 {...rise(0.14)}>
            Every verified action pays everyone. <em>Instantly.</em>
          </motion.h1>
          <motion.p className="hero__lede" {...rise(0.24)}>
            Lock campaign budgets, split every conversion, and recover fraudulent
            rewards—with every movement independently verifiable.
          </motion.p>
          <motion.div className="hero__actions" {...rise(0.32)}>
            <ButtonLink href={routes.console}>
              Open the console <ArrowUpRight size={17} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={routes.player} variant="secondary">
              Try the player app <Gamepad2 size={16} aria-hidden="true" />
            </ButtonLink>
          </motion.div>
          <motion.p className="hero__note" {...rise(0.4)}>
            Running on Stellar testnet. <a href="#how-it-works">See how it works</a>.
          </motion.p>
        </div>
        <motion.div
          className="hero__visual"
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, scale: 0.94 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.8, delay: 0.18, ease: EASE },
              })}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero__scene"
            src="/art/hero-scene.svg"
            alt=""
            aria-hidden="true"
            width={820}
            height={660}
          />
        </motion.div>
      </div>
    </section>
  );
}
