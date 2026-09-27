"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconPackage,
  IconShieldCheck,
  IconShoppingCart,
} from "@tabler/icons-react";
import { DashedLine } from "@/components/auth/dashed-line";

const CHOICES = [
  {
    href: "/signup/buyer",
    icon: IconShoppingCart,
    title: "I'm buying",
    copy: "Pay for orders from any bank, and confirm delivery before money moves.",
  },
  {
    href: "/signup/seller",
    icon: IconPackage,
    title: "I'm selling",
    copy: "Create invoices, ship orders, and get paid to your reserved account.",
  },
] as const;

export default function SignupChooserPage() {
  return (
    <>
      <div className="flex flex-col items-start px-6 pb-5 pt-6">
        <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <IconShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-3 font-heading text-xl font-extrabold tracking-tight text-balance">
          Join PayProof
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          Pick how you&apos;ll use PayProof. It takes a minute.
        </p>
      </div>

      <DashedLine />

      <div className="flex flex-col gap-3 px-6 py-6">
        {CHOICES.map((choice) => (
          <Link
            key={choice.href}
            href={choice.href}
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-4 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border/60 bg-background text-primary">
              <choice.icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {choice.title}
                <IconArrowRight
                  className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground text-pretty">
                {choice.copy}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </div>
    </>
  );
}
