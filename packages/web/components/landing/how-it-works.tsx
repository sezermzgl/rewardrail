import { processSteps } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";

const stepArt = [
  "/art/step-fund.svg",
  "/art/step-verify.svg",
  "/art/step-split.svg",
  "/art/step-recover.svg",
];

export function HowItWorks() {
  return (
    <section className="steps" id="how-it-works">
      <div className="container steps__grid">
        {processSteps.map((step, index) => (
          <Reveal className="step-card" delay={index * 0.08} key={step.number}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="step-card__icon"
              src={stepArt[index]}
              alt=""
              aria-hidden="true"
              width={120}
              height={108}
            />
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <span className="step-card__signal">{step.signal}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
