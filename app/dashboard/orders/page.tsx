"use client";

import { useEffect, useState } from "react";
import { listOrders, type MockOrder } from "@/lib/api";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { IconReceiptOff } from "@tabler/icons-react";

function TableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border/60 bg-card"
      aria-hidden="true"
    >
      <div className="h-12 border-b bg-muted/30" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-8 border-b px-3 last:border-b-0"
        >
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-5 flex-1 animate-pulse rounded bg-muted" />
          <div className="hidden h-5 w-32 animate-pulse rounded bg-muted lg:block" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="hidden h-5 w-20 animate-pulse rounded bg-muted lg:block" />
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const session = useDashboardSession();
  const [orders, setOrders] = useState<MockOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listOrders()
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  const loading = session.status === "loading" || (orders === null && !failed);
  const isBuyer = session.status === "authed" && session.data.role === "buyer";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Orders
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {isBuyer
              ? "Everything you've bought, from checkout to delivery."
              : "Payments, shipments, and payouts in one place."}
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-8">
          <TableSkeleton />
        </div>
      )}

      {!loading && failed && (
        <div className="mt-8 rounded-xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Could not load orders. Please try again.
          </p>
        </div>
      )}

      {!loading && !failed && orders && orders.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border/60 p-10 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-border/60 bg-muted">
            <IconReceiptOff className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold">
            No orders yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {isBuyer
              ? "Orders you pay for will show up here."
              : "When buyers pay into your reserved account, their orders will show up here."}
          </p>
        </div>
      )}

      {!loading && !failed && orders && orders.length > 0 && (
        <div className="mt-8">
          <OrdersTable orders={orders} variant={isBuyer ? "buyer" : "seller"} />
        </div>
      )}
    </div>
  );
}
