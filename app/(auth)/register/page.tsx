"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { IconShieldCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { DashedLine } from "@/components/auth/dashed-line";
import { cn } from "@/lib/utils";

type Role = "seller" | "buyer";

export default function RegisterPage() {
  const [role, setRole] = useState<Role>("seller");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/60 bg-secondary p-1">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
        <div className="flex flex-col items-start px-6 pb-5 pt-6">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <IconShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-heading text-xl font-extrabold tracking-tight text-balance">
            {role === "seller"
              ? "Create your seller account"
              : "Create your buyer account"}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            {role === "seller"
              ? "Get your reserved account and start taking payments that the bank can confirm."
              : "Pay from any bank, card, or USSD, and keep your money locked until delivery."}
          </p>
        </div>

        <DashedLine />

        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div
            role="group"
            aria-label="Account type"
            className="grid grid-cols-2 gap-1 rounded-3xl bg-secondary p-1"
          >
            {(["seller", "buyer"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={role === value}
                onClick={() => {
                  setRole(value);
                  setSubmitted(false);
                }}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-full text-sm font-medium transition-[color,background-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  role === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value === "seller" ? "I'm selling" : "I'm buying"}
              </button>
            ))}
          </div>

          <FieldGroup>
            {role === "seller" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="name">Full name</FieldLabel>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Ada Obi"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="business">Business name</FieldLabel>
                  <Input
                    id="business"
                    name="business"
                    autoComplete="organization"
                    placeholder="Ada's Kicks"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ada@example.com"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tobi@example.com"
                  required
                />
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  We send a one-time code to this address. No password needed
                  to view orders or confirm delivery.
                </p>
              </Field>
            )}
          </FieldGroup>

          {submitted && (
            <p
              role="status"
              className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-relaxed text-pretty"
            >
              Not wired yet. Account creation is not connected in this preview.
            </p>
          )}

          <Button type="submit" size="lg" className="w-full">
            {role === "seller"
              ? "Create seller account"
              : "Create buyer account"}
          </Button>
        </form>

        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
