import { Braces, Fingerprint, LockKeyhole, Undo2 } from "lucide-react";
import { infrastructureItems } from "@/data/landing";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

const icons = [LockKeyhole, Fingerprint, Braces, Undo2];

export function Infrastructure() {
  return (
    <section className="closing" id="security">
      <div className="closing__inner">
        <div className="container">
          <Reveal>
            <SectionHeading
              eyebrow="Trust by architecture"
              title="The decision stays yours. The money leaves a trail."
              align="center"
            />
          </Reveal>
          <Reveal className="closing__card" delay={0.08}>
            <div>
              <h3>Verification stays with your platform.</h3>
              <p>
                RewardRail separates action verification from value transfer,
                giving platforms operational control without opaque settlement.
              </p>
              <div className="stellar-badge">
                <span aria-hidden="true">✦</span> Built on Stellar testnet
              </div>
            </div>
            <div className="closing__list">
              {infrastructureItems.map((item, index) => {
                const Icon = icons[index];
                return (
                  <div className="closing__item" key={item.title}>
                    <Icon size={20} aria-hidden="true" />
                    <span>{item.tag}</span>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
