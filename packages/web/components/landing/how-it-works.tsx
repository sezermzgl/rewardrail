import { CheckCircle2 } from "lucide-react";
import { processSteps } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

export function HowItWorks() {
  return (
    <section className="section how-it-works" id="how-it-works">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="One action. One provable settlement."
            description="Verification stays with your platform. The movement of money becomes automatic, transparent, and recoverable."
            align="center"
          />
        </Reveal>
        <div className="process-grid">
          <div className="process-grid__track" aria-hidden="true"><i /></div>
          {processSteps.map((step, index) => (
            <Reveal className="process-card" delay={index * 0.08} key={step.number}>
              <span className="process-card__number">{step.number}</span>
              <div className="process-card__dot" aria-hidden="true" />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span className="process-card__signal">
                <CheckCircle2 size={14} aria-hidden="true" /> {step.signal}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
