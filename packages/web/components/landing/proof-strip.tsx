import { proofItems } from "@/data/landing";

export function ProofStrip() {
  return (
    <section className="proof-strip" aria-label="Product proof">
      <div className="container proof-strip__grid">
        {proofItems.map((item, index) => (
          <div className="proof-item" key={item.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
