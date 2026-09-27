"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconShieldCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PasswordInput } from "@/components/auth/password-input";
import { DashedLine } from "@/components/auth/dashed-line";
import { DataSourceToggle } from "@/components/dashboard/data-source-switch";
import { cn } from "@/lib/utils";
import { registerSeller, requestOtp, verifyOtp, useDataSource } from "@/lib/api";
import { toast } from "sonner";

type Role = "seller" | "buyer";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("seller");
  const source = useDataSource();
  const [loading, setLoading] = useState(false);

  // Buyer OTP flow state
  const [buyerEmail, setBuyerEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devCodeBanner, setDevCodeBanner] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(event.currentTarget);

      if (role === "seller") {
        const name = formData.get("name") as string;
        const business_name = formData.get("business") as string;
        const email = formData.get("email") as string;
        const phone = formData.get("phone") as string;
        const password = formData.get("password") as string;

        await registerSeller({
          name,
          email,
          password,
          phone,
          business_name,
          ...(source === "live"
            ? {
                bvn: (formData.get("bvn") as string) ?? "",
                settlement: {
                  bankCode: (formData.get("bank_code") as string) ?? "",
                  accountNumber: (formData.get("account_number") as string) ?? "",
                },
              }
            : {}),
        });
        toast.success("Seller account created successfully!");
        router.push("/dashboard");
      } else {
        if (!otpSent) {
          const email = formData.get("email") as string;
          setBuyerEmail(email);
          const res = await requestOtp(email);
          setOtpSent(true);
          if (res.dev_code) {
            setDevCodeBanner(res.dev_code);
            toast.success(`OTP sent! Dev code: ${res.dev_code}`);
          } else {
            toast.success("OTP sent to your email!");
          }
        } else {
          if (!/^\d{6}$/.test(otpCode)) {
            toast.error("Enter the 6-digit code");
            return;
          }
          await verifyOtp(buyerEmail, otpCode);
          toast.success("Buyer verified successfully!");
          router.push("/dashboard");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
                  setOtpSent(false);
                  setOtpCode("");
                  setDevCodeBanner(null);
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

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Data source
            </span>
            <DataSourceToggle />
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
                {source === "live" && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        Payout details
                      </span>
                      <span className="h-px flex-1 bg-border/60" />
                    </div>
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
                        required
                      />
                      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                        Used to create your reserved payout account. Never
                        shown again after signup.
                      </p>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="bank_code">
                        Settlement bank code
                      </FieldLabel>
                      <Input
                        id="bank_code"
                        name="bank_code"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="e.g. 035"
                        maxLength={10}
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
                        required
                      />
                    </Field>
                  </>
                )}
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
            ) : !otpSent ? (
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
            ) : (
              <Field>
                <FieldLabel htmlFor="code">One-time code</FieldLabel>
                <InputOTP
                  id="code"
                  name="code"
                  value={otpCode}
                  onChange={setOtpCode}
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                {devCodeBanner && (
                  <div className="mt-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                    <span className="font-bold text-primary">DEV MODE:</span> Your OTP code is{" "}
                    <span className="font-mono font-bold">{devCodeBanner}</span>
                  </div>
                )}
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                  Enter the code sent to {buyerEmail}.
                </p>
              </Field>
            )}
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading
              ? "Processing..."
              : role === "seller"
              ? "Create seller account"
              : !otpSent
              ? "Send one-time code"
              : "Verify and sign in"}
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
