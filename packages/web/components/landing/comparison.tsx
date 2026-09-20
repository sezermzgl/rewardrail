import { comparisonRows } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { RailArt } from "./rail-art";

export function Comparison() {
  return (
    <section className="rail-story" id="product">
      <RailArt />
      <div className="container">
        <Reveal>
          <p className="eyebrow eyebrow--muted-center">
            A rail built for the business model
          </p>
          <h2 className="rail-story__headline">
            From completed action to settled payout.
          </h2>
        </Reveal>

        <div className="rail-story__art--mobile" data-variant="1" aria-hidden="true" />

        <Reveal className="rail-pills rail-pills--problem" delay={0.08}>
          {comparisonRows.map((row) => (
            <span className="rail-pill" key={row.legacy}>
              {row.legacy}
            </span>
          ))}
        </Reveal>

        <div className="rail-story__art--mobile" data-variant="2" aria-hidden="true" />

        <Reveal>
          <h3 className="rail-story__headline rail-story__headline--solution">
            RewardRail settles the moment your validator says yes—and every share
            is visible to everyone at once.
          </h3>
        </Reveal>

        <div className="rail-story__art--mobile" data-variant="3" aria-hidden="true" />

        <Reveal className="rail-pills rail-pills--solution" delay={0.08}>
          {comparisonRows.map((row) => (
            <span className="rail-pill" key={row.rewardRail}>
              {row.rewardRail}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
