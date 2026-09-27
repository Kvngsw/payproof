"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelInvoice,
  getInvoice,
  invoiceLink,
  type MockInvoice,
} from "@/lib/api/mock";
import { useDashboardSession, useRequireSeller } from "@/components/dashboard/session-context";
import { useDataSource } from "@/lib/api";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceBarcode } from "@/components/dashboard/invoice-barcode";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { Amount } from "@/components/amount";
import {
  IconArrowLeft,
  IconCopy,
  IconCheck,
  IconSend,
} from "@tabler/icons-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function Row({
  label,
  strong,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/60 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          strong
            ? "text-right text-base font-semibold"
            : "text-right text-sm font-medium"
        }
      >
        {children}
      </dd>
    </div>
  );
}

export default function InvoiceDetailPage() {
  useRequireSeller();
  const params = useParams<{ id: string }>();
  const session = useDashboardSession();
  const source = useDataSource();
  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    getInvoice(params.id)
      .then((data) => {
        if (!cancelled) setInvoice(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, params.id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invoiceLink(params.id));
      setCopied(true);
      toast.success("Invoice link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setBusy(true);
    try {
      const updated = await cancelInvoice(invoice.id);
      setInvoice(updated);
      toast.success(`Invoice #${invoice.id} cancelled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const loading = session.status === "loading" || (invoice === null && !failed);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6" aria-hidden="true">
        <div className="h-8 w-40 rounded-lg bg-muted" />
        <div className="h-12 w-56 rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
          <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
        </div>
      </div>
    );
  }

  if (source === "live") {
    return (
      <div className="space-y-6">
        <DemoDataNotice />
      </div>
    );
  }

  if (failed || !invoice) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
        <h1 className="font-heading text-lg font-bold">Invoice not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been cancelled, or the link is wrong.
        </p>
        <Link
          href="/dashboard/invoices"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconArrowLeft className="size-4" />
          Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/invoices"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Invoices
      </Link>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          <span className="font-mono">#{invoice.id}</span>
        </h1>
        <InvoiceStatusChip status={invoice.status} />
        <span className="text-sm text-muted-foreground">
          Created {formatDateTime(invoice.created_at)}
        </span>
      </header>

      {invoice.status === "pending" && (
        <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium">Share this link</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Your customer opens it, fills in delivery details, and sends
                payment. The invoice then becomes an order.
              </p>
            </div>
            <Button onClick={copyLink}>
              {copied ? (
                <IconCheck className="size-4" />
              ) : (
                <IconCopy className="size-4" />
              )}
              Copy link
            </Button>
          </div>
          <p className="mt-4 truncate rounded-lg border border-dashed border-border/60 bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {invoiceLink(invoice.id)}
          </p>
          <div className="mt-4 flex justify-end border-t border-dashed border-border/60 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={busy}
            >
              {busy ? "Cancelling..." : "Cancel invoice"}
            </Button>
          </div>
        </section>
      )}

      {invoice.status === "paid" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <IconCheck className="size-4 shrink-0 text-primary" />
          <p>
            Paid {invoice.paid_at ? formatDateTime(invoice.paid_at) : ""}.
            {invoice.order_id ? (
              <>
                {" "}
                <Link
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  View the order
                </Link>
              </>
            ) : (
              " The order is being prepared."
            )}
          </p>
        </div>
      )}

      {invoice.status === "cancelled" && (
        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This invoice was cancelled. Create a new one if the customer still
          wants to pay.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading>Items</SectionHeading>
          <ul className="mt-2 border-t border-dashed border-border/60">
            {invoice.items.map((item) => (
              <li
                key={item.product_id}
                className="flex items-center justify-between gap-4 border-b border-dashed border-border/60 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <ProductThumb
                    url={item.image_url}
                    name={item.name}
                    className="size-8 shrink-0 rounded-lg"
                  />
                  <span className="truncate text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    × {item.quantity}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  <Amount
                    value={(item.quantity * item.unit_price_kobo) / 100}
                  />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <SectionHeading>Invoice details</SectionHeading>
          </div>
          <dl className="mt-2">
            <Row label="Bill to">
              {invoice.customer.name}
              {invoice.customer.contact && (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {invoice.customer.contact}
                </span>
              )}
            </Row>
            {invoice.note && (
              <Row label="Note">
                <span className="max-w-64 whitespace-normal font-normal">
                  {invoice.note}
                </span>
              </Row>
            )}
            <Row label="Status">
              <InvoiceStatusChip status={invoice.status} />
            </Row>
            <Row label="Created">
              <span className="font-normal">
                {formatDateTime(invoice.created_at)}
              </span>
            </Row>
          </dl>
        </section>

        <section>
          <SectionHeading>Amounts</SectionHeading>
          <dl className="mt-2">
            <Row label="Subtotal">
              <span className="tabular-nums">
                <Amount value={invoice.product_kobo / 100} />
              </span>
            </Row>
            <Row label="Total amount due" strong>
              <span className="tabular-nums">
                <Amount value={invoice.total_kobo / 100} />
              </span>
            </Row>
          </dl>
          <InvoiceBarcode code={invoice.id} className="mt-4" />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconSend className="size-3.5" />
            Amounts are locked in when the invoice is created.
          </p>
        </section>
      </div>
    </div>
  );
}
