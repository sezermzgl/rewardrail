import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { escrowLink, routes } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";

export function FinalCta() {
  return (
    <section className="final-cta">
      <Reveal className="container final-cta__inner">
        <p className="eyebrow">Settlement you can inspect</p>
        <h2>See every dollar move.</h2>
        <p>
          Follow one verified action from campaign budget to every
          participant—and back when fraud demands it.
        </p>
        <div className="final-cta__actions">
          <ButtonLink href={routes.console}>
            Open the live console <ArrowUpRight size={17} aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href={routes.player} variant="secondary">
            Try the player app <Gamepad2 size={16} aria-hidden="true" />
          </ButtonLink>
        </div>
        <p className="final-cta__contract mono">
          Escrow{" "}
          <a href={escrowLink.url} target="_blank" rel="noreferrer">
            {escrowLink.short}
          </a>{" "}
          on Stellar testnet
        </p>
      </Reveal>
    </section>
  );
}
