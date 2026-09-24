import { cn } from "@/lib/utils";

export function DashedLine({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-px w-full overflow-visible opacity-70", className)}
      aria-hidden="true"
    >
      <line
        x1="0"
        y1="0"
        x2="100%"
        y2="0"
        stroke="var(--muted-foreground)"
        strokeWidth="1"
        strokeDasharray="6 4"
        strokeOpacity="0.3"
      />
    </svg>
  );
}
