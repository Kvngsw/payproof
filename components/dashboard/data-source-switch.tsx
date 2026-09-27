"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setDataSource, useDataSource, type DataSource } from "@/lib/api";

const OPTIONS: { value: DataSource; label: string }[] = [
  { value: "mock", label: "Demo data" },
  { value: "live", label: "Live API" },
];

export function DataSourceToggle({
  reload = false,
  className,
}: {
  reload?: boolean;
  className?: string;
}) {
  const source = useDataSource();

  function choose(next: DataSource) {
    if (next === source) return;
    setDataSource(next);
    toast.success(
      next === "live"
        ? "Switched to Live API"
        : "Switched to Demo data",
      { description: reload ? undefined : "Sign in again if asked." },
    );
    if (reload) window.location.reload();
  }

  return (
    <div
      role="group"
      aria-label="Data source"
      className={cn(
        "inline-grid grid-cols-2 gap-1 rounded-3xl bg-secondary p-1",
        className,
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={source === option.value}
          onClick={() => choose(option.value)}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-[color,background-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            source === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
