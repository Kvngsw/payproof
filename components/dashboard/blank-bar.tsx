import { cn } from "@/lib/utils";

export function BlankBar({ className }: { className?: string }) {
  return (
    <span
      className={cn("block h-3 rounded-sm bg-muted", className)}
      aria-hidden="true"
    />
  );
}
