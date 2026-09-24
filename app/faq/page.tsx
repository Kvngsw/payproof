import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { FAQS } from "@/lib/faq-data";

export const metadata = {
  title: "FAQ | PayProof",
  description:
    "Answers about reserved accounts, bank-confirmed payments, escrow, disputes, and payouts.",
};

export default function FaqPage() {
  return (
    <div className="min-h-svh">
      <Navbar />
      <main className="pt-28 sm:pt-32">
        <section className="pb-20 md:pb-28">
          <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="display-2xl">Frequently asked questions</h1>
              <p className="mx-auto mt-4 max-w-[52ch] leading-relaxed text-muted-foreground text-pretty">
                Everything about how PayProof verifies payments, holds the
                dispatch fee, and releases payouts.
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-3xl">
              <FaqAccordion items={FAQS} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
