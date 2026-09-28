"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconShieldCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { DashedLine } from "@/components/auth/dashed-line";
import { verifyAuthOtp, requestOtp } from "@/lib/api";
import {
  readPendingAuth,
  clearPendingAuth,
  safeNext,
  type PendingAuth,
} from "@/lib/auth-pending";
import { toast } from "sonner";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export default function OtpPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAuth | null>(null);
  const [ready, setReady] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [codeError, setCodeError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    // Deferred so state isn't set synchronously inside the effect; sessionStorage
    // is only available client-side, so SSR renders the null branch.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let ctx = readPendingAuth();
      if (!ctx) {
        const params = new URLSearchParams(window.location.search);
        const email = params.get("email");
        if (email) {
          ctx = {
            email,
            purpose: "login",
            next: safeNext(params.get("next") ?? undefined),
          };
        }
      }
      if (!ctx) {
        router.replace("/signin");
        return;
      }
      setPending(ctx);
      setDevCode(ctx.dev_code ?? null);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    if (!/^\d{6}$/.test(otpCode)) {
      setCodeError("Enter the 6-digit code");
      return;
    }
    setCodeError(undefined);
    setLoading(true);
    try {
      await verifyAuthOtp(pending.email, otpCode);
      clearPendingAuth();
      toast.success("Signed in!");
      router.push(safeNext(pending.next));
    } catch (err) {
      const status = err instanceof Error ? (err as { status?: number }).status : undefined;
      if (err instanceof Error && (status === 400 || status === 401)) {
        setCodeError(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!pending || resending || cooldown > 0) return;
    setResending(true);
    try {
      const res = await requestOtp(pending.email);
      setDevCode(res.dev_code ?? null);
      setOtpCode("");
      setCodeError(undefined);
      setCooldown(60);
      toast.success("New code sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setResending(false);
    }
  }

  function useDifferentEmail() {
    clearPendingAuth();
    router.replace("/signin");
  }

  if (!ready || !pending) {
    return null;
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/60 bg-secondary p-1">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
        <div className="flex flex-col items-start px-6 pb-5 pt-6">
          <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <IconShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-heading text-xl font-extrabold tracking-tight text-balance">
            Check your email
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-foreground">
              {maskEmail(pending.email)}
            </span>
            .
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">
            Nothing in your inbox? Check your spam or junk folder — codes
            expire after 10 minutes.
          </p>
        </div>

        <DashedLine />

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 px-6 py-6">
          <FieldGroup>
            <div className="flex flex-col items-center gap-3">
              <InputOTP
                id="code"
                value={otpCode}
                onChange={(next) => {
                  setOtpCode(next);
                  if (codeError) setCodeError(undefined);
                }}
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                aria-invalid={codeError ? true : undefined}
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldError>{codeError}</FieldError>
              {devCode && (
                <div className="w-full rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-xs text-foreground">
                  <span className="font-bold text-primary">DEV MODE:</span>{" "}
                  Your OTP code is{" "}
                  <span className="font-mono font-bold">{devCode}</span>
                </div>
              )}
            </div>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Verifying..." : "Verify and continue"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              disabled={resending || cooldown > 0}
              className="font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-50"
            >
              {resending
                ? "Sending..."
                : cooldown > 0
                  ? `Resend in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`
                  : "Resend code"}
            </button>
            <button
              type="button"
              onClick={useDifferentEmail}
              className="text-muted-foreground hover:text-foreground"
            >
              Use a different email
            </button>
          </div>
        </form>

        <div className="border-t border-border/60 px-6 py-4 text-center text-sm text-muted-foreground">
          Need an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
