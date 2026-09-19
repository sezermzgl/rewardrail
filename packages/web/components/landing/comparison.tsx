import { ArrowRight, Check, X } from "lucide-react";
import { comparisonRows } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

export function Comparison() {
  return (
    <section className="section comparison" id="product">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="A rail built for the business model"
            title="From completed action to settled payout."
            description="Rewarded advertising creates value one action at a time. Its payment infrastructure should work the same way."
          />
        </Reveal>
        <Reveal className="comparison__table" delay={0.08}>
          <div className="comparison__head comparison__legacy">
            <span>Today&apos;s payout rail</span>
            <strong>Delayed by design</strong>
          </div>
          <div className="comparison__arrow" aria-hidden="true">
            <ArrowRight />
          </div>
          <div className="comparison__head comparison__rewardrail">
            <span>With RewardRail</span>
            <strong>Settled per action</strong>
          </div>
          {comparisonRows.map((row) => (
            <div className="comparison__row" key={row.legacy}>
              <div className="comparison__cell comparison__cell--legacy">
                <X size={16} aria-hidden="true" />
                <span>{row.legacy}</span>
              </div>
              <div className="comparison__line" aria-hidden="true" />
              <div className="comparison__cell comparison__cell--new">
                <Check size={16} aria-hidden="true" />
                <span>{row.rewardRail}</span>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
