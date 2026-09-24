import { cn } from "@/lib/utils";

const STYLES: Record<string, { chip: string; dot: string }> = {
  "Pending Payment": {
    chip: "bg-muted text-muted-foreground",
    dot: "border border-muted-foreground/50",
  },
  Paid: {
    chip: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  "Awaiting Shipment": {
    chip: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  Shipped: {
    chip: "border border-primary/30 text-primary",
    dot: "bg-primary",
  },
  Delivered: {
    chip: "bg-primary/15 text-primary",
    dot: "bg-primary",
  },
  Completed: {
    chip: "bg-primary text-primary-foreground",
    dot: "bg-primary-foreground",
  },
  Disputed: {
    chip: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function StatusChip({
  state,
  className,
}: {
  state: string;
  className?: string;
}) {
  const s = STYLES[state] ?? STYLES["Pending Payment"]!;
  return (
    <span
      className={cn(
        "caption inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px]",
        s.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      {state}
    </span>
  );
}
