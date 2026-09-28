"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { rateOrder, type MockOrder } from "@/lib/api";
import { IconStar } from "@tabler/icons-react";

export function OrderRatingStars({
  order,
  onRated,
}: {
  order: MockOrder;
  onRated: (order: MockOrder) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const rated = order.rating ?? null;

  async function submit(stars: number) {
    if (rated !== null || busy) return;
    setBusy(true);
    try {
      const updated = await rateOrder(order.id, stars);
      onRated(updated);
      toast.success(`Rated ${stars} out of 5`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (rated !== null) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <span
          className="flex gap-1"
          role="img"
          aria-label={`You rated this order ${rated} out of 5 stars`}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <IconStar
              key={star}
              className={cn(
                "size-4",
                star <= rated ? "fill-primary text-primary" : "text-border",
              )}
            />
          ))}
        </span>
        <p className="text-sm text-muted-foreground">
          You rated this order {rated} out of 5
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div
        role="radiogroup"
        aria-label="Rate this order"
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={false}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            disabled={busy}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => submit(star)}
            className="rounded-md p-1.5 transition-opacity disabled:opacity-50"
          >
            <IconStar
              className={cn(
                "size-6 transition-colors",
                (hover ?? 0) >= star
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/30",
              )}
            />
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        How was your experience with this seller? One tap, 1–5 stars.
      </p>
    </div>
  );
}
