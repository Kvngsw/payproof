"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconShieldCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { DashedLine } from "@/components/auth/dashed-line";
import { DataSourceToggle } from "@/components/dashboard/data-source-switch";
import { login } from "@/lib/api";
import { setPendingAuth, safeNext } from "@/lib/auth-pending";
import { toast } from "sonner";

export default function SigninPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const params = new URLSearchParams(window.location.search);
      const next = safeNext(params.get("next") ?? undefined);

      const res = await login({ email, password });
      setPendingAuth({ email, purpose: "login", next, dev_code: res.dev_code });
      if (!res.dev_code) {
        toast.success("Code sent to your email!");
      }
      router.push("/otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Data source
            </span>
            <DataSourceToggle />
          </div>

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
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                We&apos;ll email you a one-time code to finish signing in.
              </p>
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Processing..." : "Continue"}
          </Button>
        </form>

        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          New to PayProof?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
