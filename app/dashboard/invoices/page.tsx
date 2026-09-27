"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelInvoice,
  invoiceLink,
  listInvoices,
  type MockInvoice,
} from "@/lib/api/mock";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { useDataSource } from "@/lib/api";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { Amount } from "@/components/amount";
import {
  IconPlus,
  IconCopy,
  IconCheck,
  IconDots,
  IconX,
} from "@tabler/icons-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CopyLinkButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(invoiceLink(id));
      setCopied(true);
      toast.success("Invoice link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Copy invoice link"
      onClick={copy}
    >
      {copied ? (
        <IconCheck className="size-4 text-primary" />
      ) : (
        <IconCopy className="size-4" />
      )}
    </Button>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const session = useDashboardSession();
  const source = useDataSource();
  const [invoices, setInvoices] = useState<MockInvoice[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listInvoices()
      .then((data) => {
        if (!cancelled) setInvoices(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  async function handleCancel(invoice: MockInvoice) {
    try {
      const updated = await cancelInvoice(invoice.id);
      setInvoices((prev) =>
        prev ? prev.map((i) => (i.id === updated.id ? updated : i)) : prev,
      );
      toast.success(`Invoice #${invoice.id} cancelled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const loading = session.status === "loading" || (invoices === null && !failed);

  if (source === "live") {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Invoices
          </h1>
        </header>
        <DemoDataNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a payment request. Once it&apos;s paid, it becomes an order.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/invoices/new")}>
          <IconPlus className="size-4" />
          New invoice
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load your invoices.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setFailed(false);
              setInvoices(null);
              listInvoices().then(setInvoices).catch(() => setFailed(true));
            }}
          >
            Try again
          </Button>
        </div>
      ) : invoices && invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <h2 className="font-heading text-lg font-bold">No invoices yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first invoice, share the link with your customer, and
            get paid.
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/dashboard/invoices/new")}
          >
            <IconPlus className="size-4" />
            New invoice
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Bill to</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Product
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).map((invoice) => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium">
                    #{invoice.id}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{invoice.customer.name}</p>
                    {invoice.customer.contact && (
                      <p className="hidden max-w-40 truncate text-xs text-muted-foreground sm:block">
                        {invoice.customer.contact}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-2.5">
                      <ProductThumb
                        url={invoice.items[0]?.image_url ?? ""}
                        name={invoice.items[0]?.name ?? ""}
                        className="size-8 shrink-0 rounded-lg"
                      />
                      <span className="max-w-40 truncate text-sm text-muted-foreground">
                        {invoice.items[0]?.name ?? "—"}
                        {invoice.items.length > 1 &&
                          ` +${invoice.items.length - 1}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <Amount value={invoice.total_kobo / 100} />
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusChip status={invoice.status} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {formatDate(invoice.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CopyLinkButton id={invoice.id} />
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for invoice ${invoice.id}`}
                            />
                          }
                        >
                          <IconDots className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              router.push(`/dashboard/invoices/${invoice.id}`)
                            }
                          >
                            Open
                          </DropdownMenuItem>
                          {invoice.status === "pending" && (
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => handleCancel(invoice)}
                            >
                              <IconX className="size-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Need products first?{" "}
        <Link
          href="/dashboard/inventory"
          className="font-medium text-primary hover:underline"
        >
          Manage inventory
        </Link>
      </p>
    </div>
  );
}
