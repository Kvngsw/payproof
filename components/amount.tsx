import { cn } from "@/lib/utils";

export function Amount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      ₦{value.toLocaleString("en-NG")}
    </span>
  );
}
