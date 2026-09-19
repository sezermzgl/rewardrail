import { Braces, Fingerprint, LockKeyhole, Undo2 } from "lucide-react";
import { infrastructureItems } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const icons = [LockKeyhole, Fingerprint, Braces, Undo2];

export function Infrastructure() {
  return (
    <section className="section infrastructure" id="security">
      <div className="container infrastructure__layout">
        <Reveal>
          <SectionHeading
            eyebrow="Trust by architecture"
            title="The decision stays yours. The money leaves a trail."
            description="RewardRail separates action verification from value transfer, giving platforms operational control without opaque settlement."
          />
          <div className="stellar-badge"><span aria-hidden="true">✦</span> Built on Stellar testnet</div>
        </Reveal>
        <div className="infrastructure__grid">
          {infrastructureItems.map((item, index) => {
            const Icon = icons[index];
            return (
              <Reveal className="infrastructure-card" delay={index * 0.06} key={item.title}>
                <Icon size={20} aria-hidden="true" />
                <span>{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
