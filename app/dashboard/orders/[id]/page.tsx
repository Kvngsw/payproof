"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOrder, type MockOrder } from "@/lib/api/mock";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { OrderActions } from "@/components/dashboard/order-actions";
import { StatusChip } from "@/components/status-chip";
import { Amount } from "@/components/amount";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import {
  IconArrowLeft,
  IconCheck,
  IconMapPin,
  IconTruck,
  IconAlertTriangle,
} from "@tabler/icons-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="border-b border-dashed border-border/60 pb-3">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

const HAPPY_PATH = [
  "Pending Payment",
  "Paid",
  "Awaiting Shipment",
  "Shipped",
  "Delivered",
  "Completed",
] as const;

const PENDING_DESCRIPTIONS: Record<string, string> = {
  "Pending Payment": "Buyer completes checkout.",
  Paid: "PayProof verifies the buyer's transfer.",
  "Awaiting Shipment": "Seller ships the order.",
  Shipped: "Courier delivers to the buyer.",
  Delivered: "Buyer confirms delivery.",
  Completed: "Payout released to the seller.",
};

type TimelineItemData = {
  title: string;
  date: string;
  body: string;
  reached: boolean;
};

function buildTimeline(order: MockOrder): TimelineItemData[] {
  const terminal =
    order.status === "Disputed" || order.status === "Cancelled"
      ? order.status
      : null;
  const terminalEvent = terminal
    ? order.events.find((e) => e.to === terminal) ?? null
    : null;
  const reachedStates = new Set(order.events.map((e) => e.to));
  const items: TimelineItemData[] = [];

  for (const state of HAPPY_PATH) {
    const reached =
      state === "Pending Payment"
        ? order.events.length > 0 || order.status !== "Pending Payment"
        : reachedStates.has(state);
    const event = order.events.find((e) => e.to === state) ?? null;
    items.push({
      title: state,
      date: event ? formatDateTime(event.at) : "Pending",
      body: event
        ? `${event.actor}${event.note ? ` · ${event.note}` : ""}`
        : PENDING_DESCRIPTIONS[state],
      reached,
    });
    if (terminal && terminalEvent && state === terminalEvent.from) break;
    if (terminal && !terminalEvent && !reached) break;
  }

  if (terminal) {
    const event = terminalEvent;
    items.push({
      title: terminal,
      date: event ? formatDateTime(event.at) : "Pending",
      body: event
        ? `${event.actor}${event.note ? ` · ${event.note}` : ""}`
        : PENDING_DESCRIPTIONS[terminal] ?? "",
      reached: true,
    });
  }

  return items;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useDashboardSession();
  const [order, setOrder] = useState<MockOrder | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    getOrder(params.id)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, params.id]);

  const loading = session.status === "loading" || (order === null && !failed);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-8 w-40 rounded-lg bg-muted" />
        <div className="h-12 w-72 rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-96 rounded-xl border border-border/60 bg-muted/40" />
          <div className="space-y-6">
            <div className="h-48 rounded-xl border border-border/60 bg-muted/40" />
            <div className="h-48 rounded-xl border border-border/60 bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  if (failed || !order) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
        <h1 className="font-heading text-lg font-bold">Order not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been removed, or it does not belong to you.
        </p>
        <Link
          href="/dashboard/orders"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconArrowLeft className="size-4" />
          Back to orders
        </Link>
      </div>
    );
  }

  const tracked = order.tracking?.status;
  const cachedFallback = order.payment?.verification_mode === "cached_fallback";
  const disputeEvent =
    order.status === "Disputed"
      ? order.events.find((e) => e.to === "Disputed")
      : null;
  const timelineItems = buildTimeline(order);
  const completedCount = timelineItems.filter((i) => i.reached).length;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Orders
      </Link>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          {order.product.name}
        </h1>
        <StatusChip state={order.status} />
        <span className="text-sm text-muted-foreground">
          Order #{order.id.slice(0, 8)} · {formatDateTime(order.updated_at)}
        </span>
        {order.fraud_flag?.triggered && (
          <span className="caption inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-destructive/10 px-2.5 py-[5px] text-destructive">
            <IconAlertTriangle className="size-3" />
            {order.fraud_flag.label}
          </span>
        )}
      </header>

      <OrderActions order={order} onUpdated={setOrder} />

      {order.status === "Disputed" && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Disputed</p>
            <p className="mt-0.5 text-xs">
              {disputeEvent?.note ?? "Buyer reported an issue."} Payout is
              frozen until the dispute is resolved.
            </p>
          </div>
        </div>
      )}

      {cachedFallback && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Verification delayed: using cached confirmation.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Order details">
            <dl className="grid gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Buyer
                </dt>
                <dd className="pt-1 text-sm font-medium">
                  {order.buyer_email ?? "—"}
                </dd>
              </div>
              <div className="flex items-start gap-3">
                <IconMapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Delivery address
                  </dt>
                  <dd className="pt-0.5 text-sm font-medium">
                    {order.delivery_address}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IconTruck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Tracking
                  </dt>
                  <dd className="pt-0.5 text-sm font-medium">
                    {tracked ?? "Not shipped yet"}
                    {order.tracking?.number && ` · ${order.tracking.number}`}
                    {tracked && order.tracking?.source === "manual" && (
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {order.tracking.label}
                      </span>
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          <div className="[zoom:1.3]">
            <Timeline value={completedCount} className="w-full">
              {timelineItems.map((item, i) => (
                <TimelineItem key={`${i}-${item.title}`} step={i + 1}>
                  <TimelineSeparator />
                  <TimelineIndicator className="group-data-completed/timeline-item:border-primary group-data-completed/timeline-item:bg-primary">
                    {item.reached && (
                      <IconCheck className="size-2.5 text-primary-foreground" />
                    )}
                  </TimelineIndicator>
                  <TimelineContent>
                    <TimelineHeader>
                      <TimelineDate>{item.date}</TimelineDate>
                      <TimelineTitle>{item.title}</TimelineTitle>
                    </TimelineHeader>
                    <p>{item.body}</p>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </div>
        </div>

        <div className="space-y-6">
          <Card title="Payment & payout">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Product</dt>
                <dd className="font-medium tabular-nums">
                  <Amount value={order.amounts.product_kobo / 100} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Dispatch fee</dt>
                <dd className="font-medium tabular-nums">
                  <Amount value={order.amounts.dispatch_fee_kobo / 100} />
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-border/60 pt-3">
                <dt className="font-medium">Total</dt>
                <dd className="text-base font-semibold tabular-nums">
                  <Amount value={order.amounts.total_kobo / 100} />
                </dd>
              </div>

              <div className="border-t border-dashed border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="font-medium">
                    {order.payment?.paid_at ? "Paid" : "Not paid yet"}
                  </dd>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-xs">
                    {order.payment?.reference}
                  </dd>
                </div>
                {order.payment?.paid_at && (
                  <div className="mt-2 flex items-center justify-between">
                    <dt className="text-muted-foreground">Paid at</dt>
                    <dd className="text-xs">
                      {formatDateTime(order.payment.paid_at)}
                    </dd>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Payout</dt>
                  <dd className="font-medium capitalize">
                    {order.payout?.status === "paid" && (
                      <span className="text-primary">
                        {order.payout.status}
                      </span>
                    )}
                    {order.payout?.status === "frozen" && (
                      <span className="text-destructive">
                        {order.payout.status}
                      </span>
                    )}
                    {(!order.payout?.status ||
                      order.payout.status === "none" ||
                      order.payout.status === "pending") && (
                      <span className="text-muted-foreground">
                        {order.payout?.status === "pending"
                          ? "pending"
                          : "not started"}
                      </span>
                    )}
                  </dd>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Seller receives the product amount; dispatch fee goes to the
                  logistics partner.
                </p>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
