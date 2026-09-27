"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconShieldCheck } from "@tabler/icons-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { DashedLine } from "@/components/auth/dashed-line";
import { DataSourceToggle } from "@/components/dashboard/data-source-switch";
import { cn } from "@/lib/utils";
import { registerSeller, useDataSource } from "@/lib/api";
import { setPendingAuth } from "@/lib/auth-pending";
import { toast } from "sonner";

const STEP_LABELS = ["Account", "Business", "Payout"] as const;

export default function SignupSellerPage() {
  const router = useRouter();
  const source = useDataSource();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const totalSteps = source === "live" ? 3 : 2;

  function collect(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const next = { ...draft };
    for (const [key, value] of formData.entries()) next[key] = String(value);
    return next;
  }

  async function submit(data: Record<string, string>) {
    setLoading(true);
    try {
      await registerSeller({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        business_name: data.business,
        ...(source === "live"
          ? {
              bvn: data.bvn ?? "",
              settlement: {
                bankCode: data.bank_code ?? "",
                accountNumber: data.account_number ?? "",
              },
            }
          : {}),
      });
      setPendingAuth({
        email: data.email,
        purpose: "register",
        next: "/dashboard",
      });
      router.push("/otp");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  function onAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = collect(event);
    if (data.password !== data.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setDraft(data);
    setStep(2);
  }

  function onBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = collect(event);
    setDraft(data);
    if (source === "live") {
      setStep(3);
    } else {
      void submit(data);
    }
  }

  function onPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(collect(event));
  }

  const stepLabel = STEP_LABELS[Math.min(step, STEP_LABELS.length) - 1];

  return (
    <>
      <div className="flex flex-col items-start px-6 pb-4 pt-6">
        <div className="flex w-full items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "-ml-2",
              )}
            >
              <IconArrowLeft aria-hidden="true" />
              Back
            </button>
          ) : (
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "-ml-2",
              )}
            >
              <IconArrowLeft aria-hidden="true" />
              Choose account type
            </Link>
          )}
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            Step {step} of {totalSteps}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span className="flex size-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <IconShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-balance">
              Create your seller account
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
              {step === 1
                ? "Get your reserved account and start taking payments that the bank can confirm."
                : step === 2
                ? "Tell buyers who you are — this shows up on invoices and orders."
                : "Where your money lands. Used to create your reserved payout account."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-medium text-primary">{stepLabel}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <DashedLine />

      {step === 1 ? (
        <form onSubmit={onAccount} className="flex flex-col gap-5 px-6 py-6">
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
                defaultValue={draft.name}
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
                defaultValue={draft.email}
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

          <Button type="submit" size="lg" className="w-full">
            Continue
          </Button>
        </form>
      ) : step === 2 ? (
        <form onSubmit={onBusiness} className="flex flex-col gap-5 px-6 py-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="business">Business name</FieldLabel>
              <Input
                id="business"
                name="business"
                autoComplete="organization"
                placeholder="Ada's Kicks"
                defaultValue={draft.business}
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
                defaultValue={draft.phone}
                required
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating..." : source === "live" ? "Continue" : "Create seller account"}
          </Button>
        </form>
      ) : (
        <form onSubmit={onPayout} className="flex flex-col gap-5 px-6 py-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bvn">BVN</FieldLabel>
              <Input
                id="bvn"
                name="bvn"
                inputMode="numeric"
                autoComplete="off"
                placeholder="11-digit bank verification number"
                pattern="\d{11}"
                maxLength={11}
                defaultValue={draft.bvn}
                required
              />
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                Used to create your reserved payout account. Never shown again
                after signup.
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="bank_code">Settlement bank code</FieldLabel>
              <Input
                id="bank_code"
                name="bank_code"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 035"
                maxLength={10}
                defaultValue={draft.bank_code}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="account_number">
                Settlement account number
              </FieldLabel>
              <Input
                id="account_number"
                name="account_number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="10-digit account number"
                pattern="\d{10}"
                maxLength={10}
                defaultValue={draft.account_number}
                required
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create seller account"}
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </div>
      )}
    </>
  );
}
