import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { VisualPlaceholder } from "@/components/marketing/visual-placeholder";
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/marketing/reveal";

type Audience = "both" | "seller" | "buyer";

type Feature = {
  headline: string;
  body: string;
  cta?: { label: string; href: string };
  visualLabel: string;
  visualSrc: string;
  audience: Audience;
};

const FEATURES: Feature[] = [
  {
    headline: "One payment in. Zero stories out.",
    body: "Tobi pays once: ₦45,000 for the sneakers and ₦3,500 for the rider. PayProof locks the full ₦48,500 until the box is in his hands. Fake receipts can\u2019t move it. A vanishing seller can\u2019t touch it. When Tobi confirms delivery, Ada gets her price and the rider gets his fee.",
    cta: { label: "Get your reserved account", href: "/register" },
    visualLabel: "Escrow split",
    visualSrc: "/one-payment-in.svg",
    audience: "both",
  },
  {
    headline: "However they pay. One account.",
    body: "Bank transfer, USSD, card, ATM, or any bank they use. They pay from your link, and the money lands in your one reserved account. No POS to carry, no \u201cwhich bank?\u201d texts, no new account number every sale.",
    visualLabel: "Any payment method",
    visualSrc: "/however-they-pay.svg",
    audience: "both",
  },
  {
    headline: "Stop asking \u201chave you seen the alert?\u201d",
    body: "Every payment lands in your own reserved account, and it is confirmed to PayProof directly. No screenshots to squint at, no fake debit alerts, no \u201cnetwork delay\u201d stories. Paid means paid.",
    visualLabel: "PAID receipt",
    visualSrc: "/alert.svg",
    audience: "seller",
  },
  {
    headline: "If the package never lands, the money never moves.",
    body: "One tap on \u201cReport issue\u201d and the order freezes. The payout locks exactly where it is. No quiet withdrawals, no stories. Every state change stays on the record, so both sides are protected.",
    visualLabel: "Disputed timeline",
    visualSrc: "/the-money-never-moves.svg",
    audience: "buyer",
  },
  {
    headline: "New buyers trust you before the first chat.",
    body: "Every completed order builds your score. A real count from real sales, shown on your storefront. No bought reviews, no faked badges. When a stranger lands on Ada\u2019s page, \u201c>90% completed\u201d does the convincing.",
    cta: { label: "Open your storefront", href: "/register" },
    visualLabel: "Storefront + badge",
    visualSrc: "/new-buyers-trust-you.svg",
    audience: "seller",
  },
];

function FeatureBlock({ feature, flip }: { feature: Feature; flip: boolean }) {
  return (
    <Reveal
      as="article"
      audience={feature.audience}
      className="grid items-center gap-10 md:grid-cols-2 md:gap-12"
    >
      <div className={cn(flip && "md:order-2")}>
        <h2 className="max-w-[16ch] font-heading text-3xl font-extrabold tracking-tight text-balance md:text-[2.5rem] md:leading-[1.1]">
          {feature.headline}
        </h2>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-muted-foreground text-pretty">
          {feature.body}
        </p>
        {feature.cta && (
          <div className="mt-7">
            <Link
              href={feature.cta.href}
              className={buttonVariants({ variant: "secondary" })}
            >
              {feature.cta.label}
            </Link>
          </div>
        )}
      </div>
      <div className={cn(flip && "md:order-1")}>
        <VisualPlaceholder
          label={feature.visualLabel}
          src={feature.visualSrc}
          className="aspect-[4/3] w-full"
        />
      </div>
    </Reveal>
  );
}

export function Features() {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
      {FEATURES.map((feature, i) => (
        <div
          key={feature.headline}
          className="border-t border-border/60 py-20 md:py-28"
        >
          <FeatureBlock feature={feature} flip={i % 2 === 1} />
        </div>
      ))}
    </section>
  );
}
