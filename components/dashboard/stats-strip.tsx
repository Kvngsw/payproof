import type { ReactNode } from "react";
import { Amount } from "@/components/amount";
import {
  IconReceipt,
  IconWallet,
  IconCircleCheck,
  type Icon,
} from "@tabler/icons-react";
import type { CountsByStatus } from "@/lib/api";

const STATUS_ORDER: { key: string; label: string }[] = [
  { key: "Awaiting Shipment", label: "awaiting" },
  { key: "Paid", label: "paid" },
  { key: "Shipped", label: "shipped" },
  { key: "Delivered", label: "delivered" },
  { key: "Completed", label: "completed" },
  { key: "Disputed", label: "disputed" },
  { key: "Cancelled", label: "cancelled" },
  { key: "Pending Payment", label: "unpaid" },
];

function StatCard({
  icon: StatIcon,
  title,
  value,
  subline,
}: {
  icon: Icon;
  title: string;
  value: ReactNode;
  subline: string;
}) {
  return (
    <div className="py-4 pl-4 pr-3">
      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-md border border-border/60">
          <StatIcon className="size-4 text-foreground" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
      </div>
      <p className="py-4 text-3xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      <p className="text-sm lowercase text-muted-foreground">{subline}</p>
    </div>
  );
}

export function StatsStrip({
  counts,
  payouts,
}: {
  counts: CountsByStatus;
  payouts: { pending_kobo: number; paid_kobo: number; frozen_kobo: number };
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const nonzero = STATUS_ORDER.filter((s) => (counts[s.key] ?? 0) > 0).slice(
    0,
    3,
  );
  const ordersSubline =
    total === 0
      ? "no orders yet"
      : nonzero.map((s) => `${counts[s.key]} ${s.label}`).join(" · ");

  const denom =
    (counts["Completed"] ?? 0) +
    (counts["Cancelled"] ?? 0) +
    (counts["Disputed"] ?? 0);
  const completed = counts["Completed"] ?? 0;
  const rate = denom > 0 ? Math.round((completed / denom) * 100) : null;

  const payoutParts: string[] = [];
  if (payouts.paid_kobo > 0) payoutParts.push("paid ₦" + (payouts.paid_kobo / 100).toLocaleString("en-NG"));
  if (payouts.frozen_kobo > 0) payoutParts.push("frozen ₦" + (payouts.frozen_kobo / 100).toLocaleString("en-NG"));
  const payoutsSubline =
    payoutParts.length > 0 ? payoutParts.join(" · ") : "no payouts yet";

  return (
    <div className="w-full rounded-xl border border-border/60 bg-secondary p-1">
      <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border/60 bg-background divide-y divide-dashed divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <StatCard
          icon={IconReceipt}
          title="Orders"
          value={total}
          subline={ordersSubline}
        />
        <StatCard
          icon={IconWallet}
          title="Pending payout"
          value={<Amount value={payouts.pending_kobo / 100} />}
          subline={payoutsSubline}
        />
        <StatCard
          icon={IconCircleCheck}
          title="Completion rate"
          value={rate === null ? "—" : `${rate}%`}
          subline={
            rate === null
              ? "no history yet"
              : `${completed} of ${denom} orders`
          }
        />
      </div>
    </div>
  );
}
