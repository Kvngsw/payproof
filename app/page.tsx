import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/sections/hero";
import { Why } from "@/components/marketing/sections/why";
import { HowItWorks } from "@/components/marketing/sections/how-it-works";
import { Features } from "@/components/marketing/sections/features";
import { WhoItsFor } from "@/components/marketing/sections/who-its-for";
import { Faq } from "@/components/marketing/sections/faq";
import { ClosingCta } from "@/components/marketing/sections/closing-cta";

export default function Page() {
  return (
    <div className="min-h-svh">
      <Navbar />
      <main>
        <Hero />
        <Why />
        <HowItWorks />
        <Features />
        <WhoItsFor />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
