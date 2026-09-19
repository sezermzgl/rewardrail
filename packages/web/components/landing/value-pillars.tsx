import { ArrowDownLeft, ArrowUpRight, RotateCcw, ScanSearch } from "lucide-react";
import { valuePillars } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const icons = { thresholds: ArrowDownLeft, audit: ScanSearch, recovery: RotateCcw };

export function ValuePillars() {
  return (
    <section className="pillars">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="Built around the hard parts"
            title="Payment infrastructure that fits the unit economics."
            align="center"
          />
        </Reveal>
        <div className="pillars__grid">
          {valuePillars.map((pillar, index) => {
            const Icon = icons[pillar.id];
            return (
              <Reveal
                className={`pillar-card pillar-card--${pillar.id}`}
                delay={index * 0.08}
                key={pillar.id}
              >
                <div className="pillar-card__icon">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <p className="eyebrow">{pillar.eyebrow}</p>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
                <div className="pillar-card__metric">
                  <strong>{pillar.metric}</strong>
                  <span>{pillar.metricLabel}</span>
                </div>
                {/* The claim above, as a transaction somebody can open. */}
                {pillar.proof ? (
                  <a
                    className="pillar-card__proof mono"
                    href={pillar.proof.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {pillar.proof.short}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                ) : null}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
