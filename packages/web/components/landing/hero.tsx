import { ArrowDown, ArrowUpRight, Check } from "lucide-react";
import { MoneyFlowScene } from "@/components/money-flow/money-flow-scene";
import { ButtonLink } from "@/components/ui/button-link";

export function Hero() {
  return (
    <section className="hero container" id="top">
      <div className="hero__copy">
        <p className="eyebrow hero__eyebrow">
          <span aria-hidden="true"><Check size={12} /></span>
          Settlement infrastructure for rewarded ads
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
          Built for platforms. Invisible to players. Powered by Stellar.
        </p>
      </div>
      <div className="hero__visual">
        <div className="hero__glow" aria-hidden="true" />
        <MoneyFlowScene />
      </div>
    </section>
  );
}
