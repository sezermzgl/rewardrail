import { ArrowDownLeft, RotateCcw, ScanSearch } from "lucide-react";
import { valuePillars } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";

const icons = { thresholds: ArrowDownLeft, audit: ScanSearch, recovery: RotateCcw };

export function ValuePillars() {
  return (
    <section className="section pillars-section">
      <div className="container">
        <div className="pillars-intro">
          <p className="eyebrow">Built around the hard parts</p>
          <h2>Payment infrastructure that fits the unit economics.</h2>
        </div>
        <div className="pillars-grid">
          {valuePillars.map((pillar, index) => {
            const Icon = icons[pillar.id];
            return (
              <Reveal className={`pillar-card pillar-card--${pillar.id}`} delay={index * 0.08} key={pillar.id}>
                <div className="pillar-card__icon"><Icon size={20} aria-hidden="true" /></div>
                <p className="eyebrow">{pillar.eyebrow}</p>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
                <div className="pillar-card__metric">
                  <strong>{pillar.metric}</strong>
                  <span>{pillar.metricLabel}</span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
