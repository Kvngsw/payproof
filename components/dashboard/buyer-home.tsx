"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Amount } from "@/components/amount";
import { StatusChip } from "@/components/status-chip";
import {
  listOrders,
  type MockOrder,
} from "@/lib/api";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { IconArrowRight, IconReceiptOff } from "@tabler/icons-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function RecentOrders({ orders }: { orders: MockOrder[] | null }) {
  if (orders === null) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-full border border-border/60 bg-muted">
          <IconReceiptOff className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          No orders yet. Orders you pay for will show up here.
        </p>
      </div>
    );
  }

  return (
    <dl>
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/dashboard/orders/${order.id}`}
          className="flex items-center gap-4 border-b border-dashed border-border/60 py-3 transition-colors last:border-b-0 hover:text-foreground"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {order.product.name}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              #{order.id.slice(0, 8)} · {formatDate(order.created_at)}
            </span>
          </span>
          <span className="hidden shrink-0 text-sm font-medium tabular-nums sm:block">
            <Amount value={order.amounts.total_kobo / 100} />
          </span>
          <span className="shrink-0">
            <StatusChip state={order.status} />
          </span>
        </Link>
      ))}
    </dl>
  );
}

export function BuyerHome() {
  const router = useRouter();
  const session = useDashboardSession();
  const [orders, setOrders] = useState<MockOrder[] | null>(null);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listOrders()
      .then((data) => {
        if (!cancelled) setOrders(data.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  if (session.status !== "authed") return null;

  const { profile } = session.data;
  const greeting = profile.name?.split(/\s+/)[0] ?? profile.email.split("@")[0] ?? "there";
  const initials = (profile.name ?? profile.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-border/60 bg-muted text-base font-semibold">
            {initials}
          </span>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
              Hello, {greeting}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Your orders and payments, all in one place.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
          View orders
          <IconArrowRight className="size-4" />
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-dashed border-border/60 pb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent orders
            </h2>
            <Link
              href="/dashboard/orders"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="pt-2">
            <RecentOrders orders={orders} />
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="border-b border-dashed border-border/60 pb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Your details
            </h2>
          </div>
          <dl className="grid gap-4 pt-5">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Email
              </dt>
              <dd className="pt-1 break-all text-sm font-medium">
                {profile.email}
              </dd>
            </div>
            {memberSince && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Member since
                </dt>
                <dd className="pt-1 text-sm font-medium">{memberSince}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="rounded-xl border border-dashed border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">
              Have an invoice?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the code your seller shared to pay and track it as an
              order.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/redeem")}
          >
            Pay invoice
            <IconArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
