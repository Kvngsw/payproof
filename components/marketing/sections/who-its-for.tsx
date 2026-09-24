import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Reveal } from "@/components/marketing/reveal"

const AUDIENCES = [
  {
    key: "seller",
    label: "For sellers",
    title: "Sell in the chat you already use.",
    points: [
      "A reserved account that takes every way your customer pays.",
      "Payment confirmed at the source, not by screenshots.",
      "A dispatch fee that's protected like the product itself.",
      "A reputation badge built from real, completed orders.",
    ],
    cta: { label: "Get your reserved account", href: "/register" },
  },
  {
    key: "buyer",
    label: "For buyers",
    title: "Pay once. Get what you paid for.",
    points: [
      "Pay by transfer, USSD, card, or any bank you already use.",
      "Your money and the dispatch fee stay locked in escrow.",
      "Freeze the payout with one tap if nothing arrives.",
      "Confirm delivery, and the money moves. That's it.",
    ],
  },
] as const

export function WhoItsFor() {
  return (
    <Reveal
      as="section"
      id="who"
      className="border-t border-border/60 py-20 md:py-28"
      audienceSplit
    >
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="display-xl">Built for both sides of the chat.</h2>
          <p className="mx-auto mt-4 max-w-[46ch] leading-relaxed text-muted-foreground text-pretty">
            One of you is trying to get paid. The other is trying not to get
            scammed. PayProof ends the argument.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {AUDIENCES.map((audience) => (
            <div
              key={audience.key}
              data-audience={audience.key}
              className="rounded-xl bg-secondary p-1"
            >
              <div className="flex flex-col rounded-lg border border-border/60 h-full bg-card p-6 sm:p-8">
                <span className="caption text-primary">{audience.label}</span>
                <h3 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-balance">
                  {audience.title}
                </h3>
                <ul className="mt-5 flex-1 space-y-3">
                  {audience.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground sm:text-base"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-1 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      >
                        <path d="M5 12l5 5l9 -11" />
                      </svg>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                {"cta" in audience && audience.cta && (
                  <div className="mt-7">
                    <Link
                      href={audience.cta.href}
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      {audience.cta.label}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}
