"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getInvoice, type MockInvoice } from "@/lib/api";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { Amount } from "@/components/amount";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";

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

export default function PublicInvoicePage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;

  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInvoice(invoiceId)
      .then((data) => {
        if (!cancelled) {
          setInvoice(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFailed(err instanceof Error ? err.message : "Couldn't load this invoice.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6" aria-hidden="true">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
      </div>
    );
  }

  if (failed || !invoice) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <h1 className="font-heading text-xl font-bold">Invoice not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {failed ?? "This invoice may have been cancelled or the link is incorrect."}
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <IconArrowLeft className="size-4" />
          Back to PayProof
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        PayProof
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            <span className="font-mono">#{invoice.id}</span>
          </h1>
          <InvoiceStatusChip status={invoice.status} />
        </div>
        <span className="text-sm text-muted-foreground">
          Created {formatDateTime(invoice.created_at)}
        </span>
      </header>

      {invoice.status === "pending" && (
        <div className="rounded-2xl bg-secondary p-1">
          <div className="rounded-xl border border-border/60 bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This invoice is awaiting payment from <strong>{invoice.customer.name}</strong>.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/pay/${invoice.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Pay Now
                <IconExternalLink className="size-4" />
              </Link>
              <Link
                href={`/pay/${invoice.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-6 py-3 text-base font-medium hover:bg-muted transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      )}

      {invoice.status === "processing" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
          <span className="size-4 shrink-0" />
          <p>
            Payment in progress. Order confirmation is pending.
            {invoice.order_id && (
              <>
                {" "}
                <Link
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  View the order
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {invoice.status === "paid" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <span className="size-4 shrink-0 text-primary">✓</span>
          <p>
            Paid {invoice.paid_at ? formatDateTime(invoice.paid_at) : ""}.
            {invoice.order_id && (
              <>
                {" "}
                <Link
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  View the order
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {invoice.status === "cancelled" && (
        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This invoice was cancelled.
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
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">× {item.quantity}</span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  <Amount value={(item.quantity * item.unit_price_kobo) / 100} />
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
                <span className="max-w-64 whitespace-normal font-normal">{invoice.note}</span>
              </Row>
            )}
            <Row label="Status">
              <InvoiceStatusChip status={invoice.status} />
            </Row>
            <Row label="Created">
              <span className="font-normal">{formatDateTime(invoice.created_at)}</span>
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
            {invoice.total_kobo > invoice.product_kobo && (
              <Row label="Dispatch fee">
                <span className="tabular-nums">
                  <Amount
                    value={
                      (invoice.dispatch_fee_kobo ??
                        invoice.total_kobo - invoice.product_kobo) / 100
                    }
                  />
                </span>
              </Row>
            )}
            <Row label="Total amount due" strong>
              <span className="tabular-nums">
                <Amount value={invoice.total_kobo / 100} />
              </span>
            </Row>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconExternalLink className="size-3.5" />
            Amounts are locked in when the invoice is created.
          </p>
        </section>
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
        <p>This is a secure payment link from PayProof.</p>
        <p className="mt-1">Share this link with your customer to collect payment.</p>
      </div>
    </div>
  );
}