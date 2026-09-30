export function InvoiceStatusChip({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="caption inline-flex whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-[5px] text-primary">
        Paid
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="caption inline-flex whitespace-nowrap rounded-full bg-muted px-2.5 py-[5px] text-muted-foreground">
        Cancelled
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="caption inline-flex whitespace-nowrap rounded-full bg-sky-500/10 px-2.5 py-[5px] text-sky-600 dark:text-sky-400">
        Payment started
      </span>
    );
  }
  return (
    <span className="caption inline-flex whitespace-nowrap rounded-full bg-amber-500/10 px-2.5 py-[5px] text-amber-600 dark:text-amber-400">
      Pending
    </span>
  );
}
