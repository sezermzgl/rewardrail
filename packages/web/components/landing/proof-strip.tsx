import { proofItems } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";

export function ProofStrip() {
  return (
    <section className="statband" aria-label="Product proof">
      <div className="container">
        <Reveal className="statband__card">
          <p className="statband__label">
            Proven on testnet
            <br />
            Settled on chain
          </p>
          {proofItems.map((item) => (
            <div className="statband__item" key={item.label}>
              <strong>{item.value}</strong>
              <small>{item.label}</small>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
