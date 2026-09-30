"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { payInvoice, getInvoice, type MockInvoice } from "@/lib/api";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { Amount } from "@/components/amount";
import { IconArrowLeft, IconCheck, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

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

export default function InvoicePayPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const invoiceId = params.invoiceId;

  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formData, setFormData] = useState({ delivery_address: "", phone: "" });
  const [errors, setErrors] = useState<{ delivery_address?: string; phone?: string }>({});

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

  function validateForm() {
    const newErrors: typeof errors = {};
    if (!formData.delivery_address.trim() || formData.delivery_address.trim().length < 10) {
      newErrors.delivery_address = "Delivery address must be at least 10 characters";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    if (!invoice) return;

    setBusy(true);
    try {
      const result = await payInvoice(invoiceId, {
        delivery_address: formData.delivery_address.trim(),
        phone: formData.phone.trim(),
      });

      toast.success("Payment initiated");

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else if (result.order_id) {
        router.push(`/dashboard/orders/${result.order_id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

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
        <IconAlertCircle className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-xl font-bold">Invoice not found</h1>
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
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          <span className="font-mono">#{invoice.id}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusChip status={invoice.status} />
          <span className="text-sm text-muted-foreground">
            Created {formatDateTime(invoice.created_at)}
          </span>
        </div>
      </header>

      {invoice.status === "pending" && (
        <div className="rounded-2xl bg-secondary p-1">
          <section className="rounded-xl border border-border/60 bg-card p-6">
            <h2 className="font-heading text-lg font-bold">Complete your payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fill in your delivery details to proceed to payment.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="delivery-address">Delivery address</Label>
                <textarea
                  id="delivery-address"
                  rows={3}
                  className={cn(
                    "w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-base outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm",
                    errors.delivery_address && "border-destructive focus-visible:border-destructive"
                  )}
                  placeholder="14 Bode Thomas St, Surulere, Lagos"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  required
                  aria-invalid={errors.delivery_address ? "true" : "false"}
                />
                {errors.delivery_address && (
                  <p className="text-sm text-destructive" role="alert">{errors.delivery_address}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="08012345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  aria-invalid={errors.phone ? "true" : "false"}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive" role="alert">{errors.phone}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={busy} size="lg">
                {busy ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <IconCheck className="mr-2 size-4" />
                    Pay <Amount value={invoice.total_kobo / 100} />
                  </>
                )}
              </Button>
            </form>
          </section>
        </div>
      )}

      {invoice.status === "processing" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
          <IconLoader2 className="size-4 shrink-0 text-sky-600 dark:text-sky-400 animate-spin" />
          <p>
            Payment in progress.
            {invoice.order_id ? (
              <>
                {" "}
                <a
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  View the order
                </a>{" "}
                to track payment confirmation.
              </>
            ) : (
              " Please wait for payment confirmation."
            )}
          </p>
        </div>
      )}

      {invoice.status === "paid" && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <IconCheck className="size-4 shrink-0 text-primary" />
          <p>
            Paid {invoice.paid_at ? formatDateTime(invoice.paid_at) : ""}.
            {invoice.order_id ? (
              <>
                {" "}
                <a
                  href={`/dashboard/orders/${invoice.order_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  View the order
                </a>
              </>
            ) : (
              " The order is being prepared."
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
            <IconCheck className="size-3.5" />
            Amounts are locked in when the invoice is created.
          </p>
        </section>
      </div>
    </div>
  );
}