import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { routes } from "@/data/landing";

/**
 * Both buttons leave for something that runs.
 *
 * They used to scroll to a mock console further down the page, which meant a
 * visitor who came to see the product was shown a picture of it instead. The
 * console and the player app are deployed; the first thing the page offers
 * should be one of them.
 */
export function Hero() {
  return (
    <section className="hero-block" id="top">
      <div className="hero container">
        <div className="hero__copy">
          <p className="eyebrow">
            Settlement infrastructure for rewarded ads — powered by Stellar
          </p>
          <h1>
            Every verified action pays everyone. <em>Instantly.</em>
          </h1>
          <p className="hero__lede">
            Lock campaign budgets, split every conversion, and recover fraudulent
            rewards—with every movement independently verifiable.
          </p>
          <div className="hero__actions">
            <ButtonLink href={routes.console}>
              Open the live console <ArrowUpRight size={17} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={routes.player} variant="secondary">
              Try the player app <Gamepad2 size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
          <p className="hero__note">
            Running on Stellar testnet. <a href="#how-it-works">See how it works</a>.
          </p>
        </div>
        <div className="hero__visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="hero__scene"
            src="/art/hero-scene.svg"
            alt=""
            aria-hidden="true"
            width={820}
            height={660}
          />
        </div>
      </div>
    </section>
  );
}
