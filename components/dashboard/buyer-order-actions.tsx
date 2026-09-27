"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  cancelOrder,
  confirmDelivery,
  reportIssue,
  verifyPayment,
  type MockOrder,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  IconCreditCard,
  IconCheck,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";

const HINTS: Record<string, string> = {
  "Pending Payment": "Pay to confirm this order, or cancel it while it is unpaid.",
  Paid: "Payment confirmed. Waiting for the seller to ship.",
  "Awaiting Shipment": "Waiting for the seller to ship your order.",
  Shipped: "Your order is on its way.",
  Completed: "Completed. Nothing else to do here.",
  Disputed: "You reported a problem. This order is on hold until it is resolved.",
  Cancelled: "This order was cancelled. Nothing else to do here.",
};

export function BuyerOrderActions({
  order,
  onUpdated,
}: {
  order: MockOrder;
  onUpdated: (order: MockOrder) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState("");

  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;

  async function run(action: () => Promise<MockOrder>, success: string) {
    setBusy(true);
    try {
      const updated = await action();
      toast.success(success);
      onUpdated(updated);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    setBusy(true);
    try {
      const updated = await verifyPayment(order.id);
      onUpdated(updated);
      if (updated.status !== "Pending Payment") {
        toast.success("Payment confirmed");
      } else {
        toast.info("Payment not confirmed yet — try again in a moment.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!confirmingCancel) {
      setConfirmingCancel(true);
      return;
    }
    setConfirmingCancel(false);
    await run(() => cancelOrder(order.id), "Order cancelled");
  }

  async function handleConfirmDelivery(e: React.FormEvent) {
    e.preventDefault();
    await run(() => confirmDelivery(order.id), "Delivery confirmed");
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonValid) return;
    const ok = await run(
      () => reportIssue(order.id, reason.trim()),
      "Problem reported",
    );
    if (ok) {
      setReason("");
      setShowReport(false);
    }
  }

  const cancellable = order.status === "Pending Payment";
  const shippable = order.status === "Shipped" || order.status === "Delivered";
  const reportable = shippable; // disputes open only after shipping (parity V-rules)

  if (!cancellable && !shippable) {
    const hint = HINTS[order.status];
    if (!hint) return null;
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground sm:ml-auto">
        {order.status === "Completed" ? (
          <IconCheck className="size-4 text-primary" />
        ) : null}
        {hint}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 sm:ml-auto sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {order.status === "Pending Payment" && (
          <>
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={busy}
            >
              <IconCreditCard className="size-4" />
              {busy ? "Checking..." : "Check payment"}
            </Button>
            <Button
              variant={confirmingCancel ? "destructive" : "ghost"}
              onClick={handleCancel}
              disabled={busy}
            >
              <IconX className="size-4" />
              {confirmingCancel ? "Tap again to cancel order" : "Cancel order"}
            </Button>
          </>
        )}

        {shippable && (
          <Button onClick={handleConfirmDelivery} disabled={busy}>
            <IconCheck className="size-4" />
            {busy
              ? "Saving..."
              : order.status === "Shipped"
                ? "Confirm received"
                : "Confirm delivery"}
          </Button>
        )}

        {reportable && (
          <Button
            variant="outline"
            onClick={() => setShowReport((v) => !v)}
            disabled={busy}
          >
            <IconAlertTriangle className="size-4" />
            Report a problem
          </Button>
        )}
      </div>

      {showReport && (
        <form
          onSubmit={handleReport}
          className="w-full max-w-sm space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:ml-auto"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="report-reason"
              className="text-sm font-medium leading-none"
            >
              What went wrong?
            </label>
            <textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. The item arrived damaged, the box was crushed."
              className="flex w-full resize-none rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-base outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {reason.trim().length}/500 — at least 10 characters.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowReport(false);
                setReason("");
              }}
              disabled={busy}
            >
              Keep order
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={busy || !reasonValid}
            >
              {busy ? "Sending..." : "Report problem"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
