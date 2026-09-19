import { ArrowUpRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export function FinalCta() {
  return (
    <section className="final-cta">
      <div className="container final-cta__inner">
        <p className="eyebrow">Settlement you can inspect</p>
        <h2>See every dollar move.</h2>
        <p>
          Follow one verified action from campaign budget to every
          participant—and back when fraud demands it.
        </p>
        <div className="final-cta__actions">
          <ButtonLink href="#live-demo">
            View live demo <ArrowUpRight size={17} aria-hidden="true" />
          </ButtonLink>
          <span>
            <Check size={14} aria-hidden="true" /> No setup required
          </span>
        </div>
      </div>
    </section>
  );
}
