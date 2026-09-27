"use client";

import { useState } from "react";
import { toast } from "sonner";
import { shipOrder, updateTracking, type MockOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconTruck, IconCheck } from "@tabler/icons-react";

const TRACKING_STATUSES = [
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

const HINTS: Record<string, string> = {
  "Pending Payment": "Waiting for the buyer to pay.",
  Paid: "Payment confirmed. Awaiting shipment.",
  Delivered: "Waiting for the buyer to confirm delivery.",
  Completed: "Completed. Nothing else to do here.",
  Disputed: "Buyer reported an issue. Payout frozen.",
  Cancelled: "Order cancelled. Nothing else to do here.",
};

export function OrderActions({
  order,
  onUpdated,
}: {
  order: MockOrder;
  onUpdated: (order: MockOrder) => void;
}) {
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipNumber, setShipNumber] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [trackNumber, setTrackNumber] = useState(order.tracking?.number ?? "");
  const [busy, setBusy] = useState(false);

  async function handleShip(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await shipOrder(order.id, {
        tracking_number: shipNumber.trim() || undefined,
        carrier: shipCarrier.trim() || undefined,
      });
      toast.success("Order marked as shipped");
      setShowShipForm(false);
      setShipNumber("");
      setShipCarrier("");
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleTracking(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStatus) return;
    setBusy(true);
    try {
      const updated = await updateTracking(order.id, {
        tracking_status: nextStatus,
        tracking_number: trackNumber.trim() || undefined,
      });
      toast.success(
        nextStatus === "Delivered"
          ? "Order marked as delivered"
          : `Tracking updated to ${nextStatus}`,
      );
      setNextStatus("");
      onUpdated(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (order.status === "Awaiting Shipment") {
    return (
      <div className="flex flex-col items-start gap-3 sm:ml-auto sm:items-end">
        <Button onClick={() => setShowShipForm((v) => !v)}>
          <IconTruck className="size-4" />
          Mark as Shipped
        </Button>

        {showShipForm && (
          <form
            onSubmit={handleShip}
            className="w-full max-w-sm space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:ml-auto"
          >
            <div className="space-y-1.5">
              <Label htmlFor="ship-number">Tracking number (optional)</Label>
              <Input
                id="ship-number"
                placeholder="e.g. PKG-4471-XK"
                value={shipNumber}
                onChange={(e) => setShipNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ship-carrier">Carrier (optional)</Label>
              <Input
                id="ship-carrier"
                placeholder="e.g. GIG Logistics"
                value={shipCarrier}
                onChange={(e) => setShipCarrier(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowShipForm(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving..." : "Confirm shipment"}
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (order.status === "Shipped") {
    const current = order.tracking?.status ?? null;
    const currentIndex = current
      ? TRACKING_STATUSES.indexOf(current)
      : -1;
    const forward = TRACKING_STATUSES.slice(
      currentIndex + 1 > 0 ? currentIndex + 1 : 0,
    );

    return (
      <form
        onSubmit={handleTracking}
        className="w-full space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 sm:ml-auto sm:max-w-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="track-status">Tracking status</Label>
          <select
            id="track-status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            required
            className="h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
          >
            <option value="">Move to...</option>
            {forward.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="track-number">Tracking number</Label>
          <Input
            id="track-number"
            placeholder="e.g. PKG-4471-XK"
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            Current: {current ?? "—"}
          </span>
          <Button type="submit" size="sm" disabled={busy || !nextStatus}>
            {busy ? "Saving..." : "Update tracking"}
          </Button>
        </div>
      </form>
    );
  }

  const hint = HINTS[order.status];
  if (!hint) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {order.status === "Completed" ? (
        <IconCheck className="size-4 text-primary" />
      ) : null}
      {hint}
    </p>
  );
}
