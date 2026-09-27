"use client";

import { toast } from "sonner";
import { setDataSource } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function DemoDataNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-xl border border-dashed border-border/60 p-6 text-center"
          : "rounded-xl border border-dashed border-border/60 p-8 text-center"
      }
    >
      <p className="text-sm font-medium">Invoices are demo data for now</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        The backend team hasn&apos;t shipped invoice endpoints yet. The full
        spec is with them in docs/api-requests.md.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          setDataSource("mock");
          toast.success("Switched to Demo data");
          window.location.reload();
        }}
      >
        Switch to Demo data
      </Button>
    </div>
  );
}
