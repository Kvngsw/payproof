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
import { registerSeller } from "@/lib/api";
import { setPendingAuth } from "@/lib/auth-pending";
import { toast } from "sonner";

export default function SignupSellerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const name = String(formData.get("name") ?? "");
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const confirm = String(formData.get("confirm") ?? "");

      if (password !== confirm) {
        toast.error("Passwords don't match");
        return;
      }

      const res = await registerSeller({ name, email, password });
      setPendingAuth({
        email,
        purpose: "register",
        next: "/dashboard",
        dev_code: res.dev_code,
      });
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
    <>
      <div className="flex flex-col items-start px-6 pb-5 pt-6">
        <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <IconShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-3 font-heading text-xl font-extrabold tracking-tight text-balance">
          Create your seller account
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
          Get your reserved account and start taking payments the bank can
          confirm. You&apos;ll set up your business and payout details right
          after signup.
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
          <Field>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              placeholder="Repeat your password"
              minLength={8}
              required
            />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create seller account"}
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
    </>
  );
}
