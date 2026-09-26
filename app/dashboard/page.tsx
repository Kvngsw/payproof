"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSellerDashboard, type SellerDashboard } from "@/lib/api/mock";
import { StatsStrip } from "@/components/dashboard/stats-strip";
import {
  IconCopy,
  IconCheck,
  IconBuildingBank,
  IconMail,
  IconPhone,
  IconCalendar,
} from "@tabler/icons-react";
import { useDashboardSession } from "@/components/dashboard/session-context";

function ReservedAccountCard({
  account,
}: {
  account: { account_number: string; bank_name: string; account_name: string };
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(account.account_number);
      setCopied(true);
      toast.success("Account number copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the number manually.");
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-dashed border-border/60 pb-3">
        <IconBuildingBank className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">
          Reserved account
        </h2>
      </div>

      <p className="pt-5 text-xs uppercase tracking-wide text-muted-foreground">
        Account number
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
          {account.account_number}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copy}
          aria-label="Copy account number"
        >
          {copied ? (
            <IconCheck className="size-4 text-primary" />
          ) : (
            <IconCopy className="size-4" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-dashed border-border/60 pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Bank
          </dt>
          <dd className="pt-1 text-sm font-medium">{account.bank_name}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Account name
          </dt>
          <dd className="pt-1 text-sm font-medium">{account.account_name}</dd>
        </div>
      </dl>

      <p className="mt-5 rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Buyers pay into this account. PayProof verifies the transfer before
        telling you it is paid.
      </p>
    </section>
  );
}

function SellerDetailsCard({
  profile,
}: {
  profile: {
    name?: string;
    email: string;
    phone?: string;
    business_name?: string;
    created_at?: string;
  };
}) {
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
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-dashed border-border/60 pb-3">
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
  );
}

export default function DashboardPage() {
  const session = useDashboardSession();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    getSellerDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch(() => {
        if (!cancelled) setStatsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  if (session.status === "loading") {
    return (
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-10 w-64 rounded-lg bg-muted" />
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

  const { profile, reserved_account } = session.data;
  const greeting = profile.name?.split(/\s+/)[0] ?? profile.business_name ?? "there";

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
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
            Here is your reserved account and seller profile.
          </p>
        </div>
      </header>

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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {reserved_account ? (
          <ReservedAccountCard account={reserved_account} />
        ) : (
          <section className="rounded-xl border border-dashed border-border/60 bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Your reserved account is being set up. Buyers will pay into a
              dedicated account verified by PayProof.
            </p>
          </section>
        )}
        <SellerDetailsCard profile={profile} />
      </div>
    </div>
  );
}
