"use client";

import { useRouter } from "next/navigation";
import { StatusChip } from "@/components/status-chip";
import { Amount } from "@/components/amount";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { MockOrder } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAYOUT_STYLES: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "text-primary" },
  pending: { label: "Pending", className: "text-muted-foreground" },
  frozen: { label: "Frozen", className: "text-destructive" },
  partial: { label: "Partial", className: "text-foreground" },
  failed: { label: "Failed", className: "text-destructive" },
};

function PayoutCell({ status }: { status: string }) {
  if (!status || status === "none") {
    return <span className="text-muted-foreground">—</span>;
  }
  const style = PAYOUT_STYLES[status] ?? {
    label: status,
    className: "text-muted-foreground",
  };
  return <span className={style.className}>{style.label}</span>;
}

export function OrdersTable({
  orders,
  variant = "seller",
}: {
  orders: MockOrder[];
  variant?: "seller" | "buyer";
}) {
  const router = useRouter();

  function open(order: MockOrder) {
    router.push(`/dashboard/orders/${order.id}`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Status</TableHead>
            <TableHead>Product</TableHead>
            {variant === "seller" && (
              <TableHead className="hidden lg:table-cell">Buyer</TableHead>
            )}
            <TableHead className="text-right">Total</TableHead>
            {variant === "seller" && <TableHead>Payout</TableHead>}
            <TableHead className="hidden lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer"
              tabIndex={0}
              onClick={() => open(order)}
              onKeyDown={(e) => {
                if (e.key === "Enter") open(order);
              }}
            >
              <TableCell>
                <StatusChip state={order.status} />
              </TableCell>
              <TableCell className="max-w-56 p-3">
                <div className="truncate font-medium">
                  {order.product.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Order #{order.id.slice(0, 8)}</span>
                  {order.fraud_flag?.triggered && (
                    <span className="caption inline-flex items-center whitespace-nowrap rounded-full bg-destructive/10 px-2 py-px text-destructive">
                      {order.fraud_flag.label}
                    </span>
                  )}
                </div>
              </TableCell>
              {variant === "seller" && (
                <TableCell className="hidden max-w-44 truncate text-muted-foreground lg:table-cell">
                  {order.buyer_email}
                </TableCell>
              )}
              <TableCell className="text-right font-medium tabular-nums">
                <Amount value={order.amounts.total_kobo / 100} />
              </TableCell>
              {variant === "seller" && (
                <TableCell>
                  <PayoutCell status={order.payout?.status} />
                </TableCell>
              )}
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatDate(order.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
