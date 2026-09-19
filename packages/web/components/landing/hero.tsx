import { ArrowDown, ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

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
            <ButtonLink href="#live-demo">
              View live demo <ArrowUpRight size={17} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="secondary">
              See how it works <ArrowDown size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
          <p className="hero__note">
            Built for platforms. Invisible to players.
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
