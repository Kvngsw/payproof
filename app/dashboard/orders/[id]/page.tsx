"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOrder, type MockOrder } from "@/lib/api";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { OrderActions } from "@/components/dashboard/order-actions";
import { BuyerOrderActions } from "@/components/dashboard/buyer-order-actions";
import { OrderAssistant } from "@/components/dashboard/order-assistant";
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function Row({
  label,
  strong,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/60 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          strong
            ? "text-right text-base font-semibold"
            : "text-right text-sm font-medium"
        }
      >
        {children}
      </dd>
    </div>
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

const POLL_INTERVAL_MS = 5_000;
const LIVE_STATUSES = new Set([
  "Pending Payment",
  "Paid",
  "Awaiting Shipment",
  "Shipped",
  "Delivered",
]);

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const session = useDashboardSession();
  const [order, setOrder] = useState<MockOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const isBuyer = session.status === "authed" && session.data.role === "buyer";

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

  // Buyer view stays fresh while the order is still moving (board FE-11)
  useEffect(() => {
    if (!isBuyer || !order || !LIVE_STATUSES.has(order.status)) return;
    const timer = setInterval(() => {
      getOrder(params.id)
        .then((data) => setOrder(data))
        .catch(() => {
          /* transient poll failure — next tick retries */
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isBuyer, order, params.id]);

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

      {isBuyer ? (
        <BuyerOrderActions order={order} onUpdated={setOrder} />
      ) : (
        <OrderActions order={order} onUpdated={setOrder} />
      )}

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
          <section>
            <SectionHeading>Order details</SectionHeading>
            <dl className="mt-2">
              <Row label={isBuyer ? "Seller" : "Buyer"}>
                {isBuyer
                  ? order.seller.business_name || "—"
                  : (order.buyer_email ?? "—")}
              </Row>
              <Row label="Delivery address">{order.delivery_address}</Row>
              <Row label="Tracking">
                {tracked ? (
                  <>
                    {tracked}
                    {order.tracking?.number &&
                      ` · ${order.tracking.number}`}
                    {order.tracking?.source === "manual" && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {order.tracking.label}
                      </span>
                    )}
                  </>
                ) : (
                  "Not shipped yet"
                )}
              </Row>
            </dl>
          </section>

          <section>
            <SectionHeading>Timeline</SectionHeading>
            <div className="mt-4 [zoom:1.1]">
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
                    <p className="capitalize">{item.body}</p>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionHeading>Payment &amp; payout</SectionHeading>
            <dl className="mt-2">
              <Row label="Product">
                <span className="tabular-nums">
                  <Amount value={order.amounts.product_kobo / 100} />
                </span>
              </Row>
              <Row label="Dispatch fee">
                <span className="tabular-nums">
                  <Amount value={order.amounts.dispatch_fee_kobo / 100} />
                </span>
              </Row>
              <Row label="Total" strong>
                <span className="tabular-nums">
                  <Amount value={order.amounts.total_kobo / 100} />
                </span>
              </Row>
              <Row label="Payment">
                {order.payment?.paid_at ? "Paid" : "Not paid yet"}
              </Row>
              <Row label="Reference">
                <span className="font-mono text-xs">
                  {order.payment?.reference}
                </span>
              </Row>
              {order.payment?.paid_at && (
                <Row label="Paid at">
                  <span className="font-normal">
                    {formatDateTime(order.payment.paid_at)}
                  </span>
                </Row>
              )}
              <Row label="Payout">
                <span className="capitalize">
                  {order.payout?.status === "paid" && (
                    <span className="text-primary">{order.payout.status}</span>
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
                </span>
              </Row>
            </dl>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Seller receives the product amount; dispatch fee goes to the
              logistics partner.
            </p>
          </section>
        </div>
      </div>

      {isBuyer && <OrderAssistant orderId={order.id} />}
    </div>
  );
}
