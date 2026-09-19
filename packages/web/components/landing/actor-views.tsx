"use client";

/**
 * One settled action, as each of the four parties sees it.
 *
 * The figures are not illustrative. They are campaign 8 of the deployed
 * escrow — 12 USDC at 4.00 per action, two settles, one reward reversed,
 * 5.20 refunded at close — and the hash under each panel opens that leg in
 * Stellar Expert. The section used to carry invented numbers and a hash that
 * resolved nowhere, which is a strange way to illustrate an audit trail.
 *
 * It also used to be where every "view live demo" button landed. The real
 * console and player app are linked at the foot of the section instead.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Check, Gamepad2, ShieldAlert } from "lucide-react";
import { actorViews, routes } from "@/data/landing";
import { ButtonLink } from "@/components/ui/button-link";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

export function ActorViews() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = actorViews[activeIndex];

  function select(index: number) {
    setActiveIndex(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      select((index + 1) % actorViews.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      select((index - 1 + actorViews.length) % actorViews.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(actorViews.length - 1);
    }
  }

  return (
    <section className="actor-section" id="live-demo">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="One recorded run, four views"
            title="Everyone sees the same truth."
            description="Campaign 8 on Stellar testnet: 12.00 USDC locked, two actions settled, one reward reversed, 5.20 refunded at close. Every figure below links to the transaction that produced it."
            align="center"
          />
        </Reveal>
        <Reveal className="actor-demo" delay={0.08}>
          <div className="actor-tabs" role="tablist" aria-label="Transaction participants">
            {actorViews.map((actor, index) => (
              <button
                key={actor.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                id={`tab-${actor.id}`}
                type="button"
                role="tab"
                aria-label={actor.label}
                aria-selected={index === activeIndex}
                aria-controls={`panel-${actor.id}`}
                tabIndex={index === activeIndex ? 0 : -1}
                onClick={() => select(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {actor.label}
              </button>
            ))}
          </div>

          <div
            className="actor-panel"
            role="tabpanel"
            id={`panel-${active.id}`}
            aria-labelledby={`tab-${active.id}`}
            key={active.id}
          >
            <div className="actor-panel__copy">
              <p className="eyebrow">{active.eyebrow}</p>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
              <span className="actor-panel__activity">
                {active.id === "operator" ? <ShieldAlert size={16} /> : <Check size={16} />}
                {active.activity}
              </span>
            </div>
            <div className="actor-panel__dashboard">
              <div className="actor-panel__chrome">
                <span><i /><i /><i /></span>
                <small>{active.label} console · USDC</small>
              </div>
              <div className="actor-panel__stats">
                {active.stats.map((stat) => (
                  <div key={stat.label} data-tone={stat.tone ?? "default"}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
              {active.id === "operator" ? (
                <div
                  className="reversal-flow"
                  aria-label="Fraudulent reward returning to campaign escrow"
                >
                  <span>Flagged reward</span>
                  <i aria-hidden="true"><b /></i>
                  <span>Campaign escrow</span>
                </div>
              ) : null}
              <a
                className="actor-panel__transaction"
                href={active.proof.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>{active.proof.label}</span>
                <code>{active.proof.short}</code>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal className="actor-section__cta" delay={0.12}>
          <p>
            The same four panels, live and clickable, against the campaign
            running right now.
          </p>
          <div>
            <ButtonLink href={routes.console}>
              Open the live console <ArrowUpRight size={17} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={routes.player} variant="secondary" className="on-light">
              Try the player app <Gamepad2 size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
