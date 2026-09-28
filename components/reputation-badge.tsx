import { cn } from "@/lib/utils";
import { IconMedal } from "@tabler/icons-react";

export function ReputationBadge({
  badge,
  className,
}: {
  badge: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <IconMedal className="size-3.5" />
      {badge}
    </span>
  );
}
