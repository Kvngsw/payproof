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
import { cn } from "@/lib/utils";
import { loginSeller, requestOtp, verifyOtp } from "@/lib/api/mock";
import { toast } from "sonner";

type Role = "seller" | "buyer";

export default function SigninPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("seller");
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
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        await loginSeller({ email, password });
        toast.success("Signed in successfully!");
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
          await verifyOtp(buyerEmail, otpCode);
          toast.success("Signed in successfully!");
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
            Welcome back
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Sign in to check orders, payouts, and delivery status.
          </p>
        </div>

        <DashedLine />

        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-6 py-6">
          <div
            role="group"
            aria-label="Sign in type"
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
                {value === "seller" ? "Seller sign in" : "Buyer sign in"}
              </button>
            ))}
          </div>

          <FieldGroup>
            {role === "seller" ? (
              <>
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
                  We will send a one-time code to your email.
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="code">One-time code</FieldLabel>
                <Input
                  id="code"
                  name="code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                />
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
              ? "Sign in"
              : !otpSent
              ? "Send one-time code"
              : "Verify and sign in"}
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
