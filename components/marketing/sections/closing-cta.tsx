import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/marketing/reveal";

export function ClosingCta() {
  return (
    <Reveal as="section" className="border-t border-border/60 py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#0c2914_0%,#123a1d_5%,#1a5730_50%)]">
          {/* lime glow, bottom-left */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-primary/70 blur-3xl"
          />

          <div className="relative grid items-center overflow-clip gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div className="p-8 sm:p-12 lg:p-14">
              <h2 className="display-xl max-w-[14ch] text-white">
                Give every sale a paper trail.
              </h2>
              <p className="mt-4 max-w-[42ch] leading-relaxed text-white/70 text-pretty">
                Free during the pilot. Works with the chat app you already
                use. You just change the account number you share.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className={buttonVariants({
                    variant: "outline"
                  })}
                >
                  Get your reserved account
                  <IconArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative h-full min-h-[380px]">
                <div
                  className={cn(
                    "absolute top-16 bottom-0 left-0 right-0 flex items-center justify-center",
                     "rounded-tl-2xl bg-black p-1 pb-0 pr-0",
                  )}
                >
                  <div className="bg-chart-1 w-full h-full rounded-tl-xl"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
