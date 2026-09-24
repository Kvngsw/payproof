"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { IconShieldCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { DashedLine } from "@/components/auth/dashed-line";

export default function SigninPage() {
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
            Welcome back
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Sign in to check orders, payouts, and delivery status.
          </p>
        </div>

        <DashedLine />

        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                required
              />
            </Field>
          </FieldGroup>

          {submitted && (
            <p
              role="status"
              className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-relaxed text-pretty"
            >
              Not wired yet. Sign in is not connected in this preview.
            </p>
          )}

          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
