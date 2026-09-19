import { Comparison } from "@/components/landing/comparison";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Navbar } from "@/components/landing/navbar";
import { ProofStrip } from "@/components/landing/proof-strip";

export default function Page() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProofStrip />
        <Comparison />
        <HowItWorks />
      </main>
    </>
  );
}
