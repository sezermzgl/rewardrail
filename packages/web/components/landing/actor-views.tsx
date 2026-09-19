"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Check, ShieldAlert } from "lucide-react";
import { actorViews } from "@/data/landing";
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
    <section className="section actor-section" id="live-demo">
      <div className="container">
        <Reveal>
          <SectionHeading
            eyebrow="One settlement, four clear views"
            title="Everyone sees the same truth."
            description="Move through the transaction as each participant sees it. The underlying event—and its proof—never changes."
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
                <small>{active.label} console</small>
              </div>
              <div className="actor-panel__stats">
                {active.stats.map((stat) => (
                  <div key={stat.label} data-tone={stat.tone ?? "default"}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
              <div className="actor-panel__transaction">
                <span>Latest settlement</span>
                <code>{active.transaction}</code>
                <ArrowUpRight size={15} aria-hidden="true" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
