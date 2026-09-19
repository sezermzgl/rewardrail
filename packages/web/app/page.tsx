import { ActorViews } from "@/components/landing/actor-views";
import { Comparison } from "@/components/landing/comparison";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Infrastructure } from "@/components/landing/infrastructure";
import { Navbar } from "@/components/landing/navbar";
import { ProofStrip } from "@/components/landing/proof-strip";
import { ValuePillars } from "@/components/landing/value-pillars";

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProofStrip />
        <Comparison />
        <HowItWorks />
        <ValuePillars />
        <ActorViews />
        <Infrastructure />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
