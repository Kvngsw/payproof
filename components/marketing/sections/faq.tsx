import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { LANDING_FAQS } from "@/lib/faq-data";

export function Faq() {
  return (
    <Reveal
      as="section"
      id="faq"
      className="border-t border-border/60 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="display-xl">The questions that come up first.</h2>
          <p className="mx-auto mt-4 max-w-[52ch] leading-relaxed text-muted-foreground text-pretty">
            Straight answers about payments, the fee, and when the money
            actually moves.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <FaqAccordion items={LANDING_FAQS} />
          <div className="mt-8 text-center">
            <Link href="/faq" className={buttonVariants({ variant: "outline" })}>
              See all questions
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
