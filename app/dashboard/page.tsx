"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getSellerDashboard,
  listInvoices,
  updateProfile,
  type SellerDashboard,
  type MockInvoice,
} from "@/lib/api";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { Amount } from "@/components/amount";
import {
  IconPlus,
  IconPackage,
  IconMail,
  IconPhone,
  IconCalendar,
  IconBuildingBank,
} from "@tabler/icons-react";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { useDataSource } from "@/lib/api";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import { BuyerHome } from "@/components/dashboard/buyer-home";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  first,
  hasErrors,
  pattern,
  required,
  type FieldErrors,
} from "@/lib/form";
import { toast } from "sonner";

type ProfileLike = {
  name?: string;
  email: string;
  phone?: string;
  business_name?: string;
  bvn?: string;
  settlement?: { bankCode: string; accountNumber: string } | null;
  created_at?: string;
};

function PayoutLine({
  account,
}: {
  account?: { account_number: string; bank_name: string; account_name: string };
}) {
  if (!account) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Buyers pay into {account.account_name} · {account.account_number} ·{" "}
      {account.bank_name}.
    </p>
  );
}

function RecentInvoices({ invoices }: { invoices: MockInvoice[] | null }) {
  if (invoices === null) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No invoices yet. Create one and share the link with your customer.
        </p>
        <Link
          href="/dashboard/invoices/new"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconPlus className="size-4" />
          New invoice
        </Link>
      </div>
    );
  }

  return (
    <dl>
      {invoices.map((invoice) => (
        <Link
          key={invoice.id}
          href={`/dashboard/invoices/${invoice.id}`}
          className="flex items-center gap-4 border-b border-dashed border-border/60 py-3 transition-colors last:border-b-0 hover:text-foreground"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {invoice.customer.name}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              #{invoice.id} · {invoice.items[0]?.name ?? "—"}
              {invoice.items.length > 1 && ` +${invoice.items.length - 1}`}
            </span>
          </span>
          <span className="hidden shrink-0 text-sm font-medium tabular-nums sm:block">
            <Amount value={invoice.total_kobo / 100} />
          </span>
          <span className="shrink-0">
            <InvoiceStatusChip status={invoice.status} />
          </span>
        </Link>
      ))}
    </dl>
  );
}

function SellerDetailsCard({ profile }: { profile: ProfileLike }) {
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
      })
    : null;

  const rows = [
    { icon: IconMail, label: "Email", value: profile.email },
    ...(profile.phone
      ? [{ icon: IconPhone, label: "Phone", value: profile.phone }]
      : []),
    ...(profile.settlement?.accountNumber
      ? [
          {
            icon: IconBuildingBank,
            label: "Payout account",
            value: `${profile.settlement.accountNumber} · bank ${profile.settlement.bankCode}`,
          },
        ]
      : []),
    ...(memberSince
      ? [
          {
            icon: IconCalendar,
            label: "Member since",
            value: memberSince,
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-2xl bg-secondary p-1">
      <section className="h-full rounded-xl border border-border/60 bg-card p-6">
        <div className="border-b border-dashed border-border/60 pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Seller details
          </h2>
        </div>
        <dl className="grid gap-4 pt-5">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {profile.business_name ? "Business name" : "Name"}
            </dt>
            <dd className="pt-1 text-sm font-medium">
              {profile.business_name ?? profile.name ?? "Not set"}
            </dd>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <row.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="pt-0.5 break-all text-sm font-medium">
                  {row.value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function ProfileSetupCard({ profile }: { profile: ProfileLike }) {
  const source = useDataSource();
  const { refresh } = useDashboardSession();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(key: string) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  const complete = Boolean(
    profile.business_name?.trim() &&
      profile.phone?.trim() &&
      profile.bvn &&
      profile.settlement?.bankCode &&
      profile.settlement?.accountNumber,
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const business_name = String(form.get("business_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const bvn = String(form.get("bvn") ?? "").trim();
    const bankCode = String(form.get("bank_code") ?? "").trim();
    const accountNumber = String(form.get("account_number") ?? "").trim();

    const nextErrors: FieldErrors = {
      business_name: required(business_name, "Business name"),
      phone: required(phone, "Phone number"),
      bvn: first(
        required(bvn, "BVN"),
        pattern(bvn, /^\d{11}$/, "BVN must be exactly 11 digits"),
      ),
      bank_code: first(
        required(bankCode, "Bank code"),
        pattern(bankCode, /^\d+$/, "Bank code must be digits"),
      ),
      account_number: first(
        required(accountNumber, "Account number"),
        pattern(accountNumber, /^\d{10}$/, "Account number must be exactly 10 digits"),
      ),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    try {
      await updateProfile({
        business_name,
        phone,
        bvn,
        settlement: { bankCode, accountNumber },
      });
      refresh();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your profile",
      );
    } finally {
      setBusy(false);
    }
  }

  if (complete) return null;

  if (source === "live") {
    return (
      <div className="rounded-2xl bg-secondary p-1">
        <section className="rounded-xl border border-border/60 bg-card p-6">
          <div className="border-b border-dashed border-border/60 pb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Finish your profile
            </h2>
          </div>
          <p className="pt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
            Business, BVN and settlement details are saved after signup via the
            profile update API (backend ask §1.4 A7 — not shipped yet). Switch to{" "}
            <span className="font-medium text-foreground">Demo data</span> to try
            the setup flow now.
          </p>
          {!profile.business_name && (
            <p className="pt-2 text-sm text-muted-foreground">
              Business name: not set yet.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-secondary p-1">
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <div className="border-b border-dashed border-border/60 pb-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Finish your profile
          </h2>
        </div>
        <p className="pt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
          Your business name shows on invoices and names your reserved account
          where buyers pay in. BVN and settlement details tell us where payouts
          land.
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 pt-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="setup-business">Business name</FieldLabel>
              <Input
                id="setup-business"
                name="business_name"
                autoComplete="organization"
                placeholder="Ada's Kicks"
                defaultValue={profile.business_name ?? ""}
                required
                aria-invalid={errors.business_name ? true : undefined}
                onChange={() => clearError("business_name")}
              />
              <FieldError>{errors.business_name}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-phone">Phone number</FieldLabel>
              <Input
                id="setup-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+234 800 000 0000"
                defaultValue={profile.phone ?? ""}
                required
                aria-invalid={errors.phone ? true : undefined}
                onChange={() => clearError("phone")}
              />
              <FieldError>{errors.phone}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="setup-bvn">BVN</FieldLabel>
              <Input
                id="setup-bvn"
                name="bvn"
                inputMode="numeric"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                placeholder="11-digit bank verification number"
                pattern="\d{11}"
                maxLength={11}
                defaultValue={profile.bvn ?? ""}
                required
                aria-invalid={errors.bvn ? true : undefined}
                onChange={() => clearError("bvn")}
              />
              <FieldError>{errors.bvn}</FieldError>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                Used to verify your payout account. Never shown again after
                saving.
              </p>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="setup-bank-code">Bank code</FieldLabel>
                <Input
                  id="setup-bank-code"
                  name="bank_code"
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="e.g. 035"
                  maxLength={10}
                  defaultValue={profile.settlement?.bankCode ?? ""}
                  required
                  aria-invalid={errors.bank_code ? true : undefined}
                  onChange={() => clearError("bank_code")}
                />
                <FieldError>{errors.bank_code}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="setup-account">Account number</FieldLabel>
                <Input
                  id="setup-account"
                  name="account_number"
                  inputMode="numeric"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="10-digit account number"
                  pattern="\d{10}"
                  maxLength={10}
                  defaultValue={profile.settlement?.accountNumber ?? ""}
                  required
                  aria-invalid={errors.account_number ? true : undefined}
                  onChange={() => clearError("account_number")}
                />
                <FieldError>{errors.account_number}</FieldError>
              </Field>
            </div>
          </FieldGroup>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Saving..." : "Save profile"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const session = useDashboardSession();
  const source = useDataSource();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);
  const [invoices, setInvoices] = useState<MockInvoice[] | null>(null);
  const role = session.status === "authed" ? session.data.role : null;

  useEffect(() => {
    if (role !== "seller") return;
    let cancelled = false;
    getSellerDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch(() => {
        if (!cancelled) setStatsFailed(true);
      });
    listInvoices()
      .then((data) => {
        if (!cancelled) setInvoices(data.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Invoice share links are buyer-facing; a seller opening one gets a hint.
  useEffect(() => {
    if (role !== "seller") return;
    const raw =
      new URLSearchParams(window.location.search).get("invoice") ?? "";
    if (raw.trim()) {
      toast.info(
        "Invoice links are for buyers — sign in with a buyer account to pay it.",
      );
    }
  }, [role]);

  if (session.status === "loading") {
    return (
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-10 w-64 rounded-lg bg-muted" />
        <div className="h-12 w-72 rounded-lg bg-muted" />
        <div className="h-36 rounded-xl border border-border/60 bg-muted/40" />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
          <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
        </div>
      </div>
    );
  }

  if (session.status === "error") {
    return null;
  }

  if (role === "buyer") {
    return <BuyerHome />;
  }

  const { profile, reserved_account } = session.data;
  const greeting = profile.name?.split(/\s+/)[0] ?? profile.business_name ?? "there";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-border/60 bg-muted text-base font-semibold">
            {(profile.name ?? profile.business_name ?? profile.email)
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
              Hello, {greeting}!
            </h1>
            <p className="text-sm text-muted-foreground">
              What&apos;s happening with your invoices and orders.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {source === "mock" && (
            <Button onClick={() => router.push("/dashboard/invoices/new")}>
              <IconPlus className="size-4" />
              New invoice
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/inventory")}
          >
            <IconPackage className="size-4" />
            Add product
          </Button>
        </div>
      </header>

      <ProfileSetupCard profile={profile} />

      <div className="space-y-3">
        {dashboard ? (
          <StatsStrip
            counts={dashboard.counts_by_status}
            payouts={dashboard.payouts}
          />
        ) : statsFailed ? (
          <p className="text-sm text-muted-foreground">Stats unavailable.</p>
        ) : (
          <div
            className="h-36 animate-pulse rounded-xl border border-border/60 bg-muted/40"
            aria-hidden="true"
          />
        )}
        <PayoutLine account={reserved_account} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-secondary p-1">
          <section className="h-full rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between border-b border-dashed border-border/60 pb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent invoices
              </h2>
              <Link
                href="/dashboard/invoices"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="pt-2">
              {source === "live" ? (
                <DemoDataNotice compact />
              ) : (
                <RecentInvoices invoices={invoices} />
              )}
            </div>
          </section>
        </div>
        <SellerDetailsCard profile={profile} />
      </div>
    </div>
  );
}
