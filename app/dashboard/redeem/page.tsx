"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Amount } from "@/components/amount";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import {
  useDashboardSession,
  useRequireBuyer,
} from "@/components/dashboard/session-context";
import {
  useDataSource,
  getInvoice,
  payInvoice,
  type MockInvoice,
} from "@/lib/api";
import { IconArrowLeft, IconReceiptOff } from "@tabler/icons-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
        <div className="h-64 rounded-xl border border-border/60 bg-muted/40" />
      </div>
    </div>
  );
}

function CodeEntry({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border/60 bg-card p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto grid size-10 place-items-center rounded-full border border-border/60 bg-muted">
        <IconReceiptOff className="size-4 text-muted-foreground" />
      </div>
      <h1 className="mt-4 font-heading text-xl font-extrabold tracking-tight">
        Pay an invoice
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the invoice code the seller shared with you.
      </p>
      <form
        className="mt-5 space-y-3 text-left"
        onSubmit={(event) => {
          event.preventDefault();
          const code = value.trim().toUpperCase();
          if (!code) return;
          router.replace(
            `/dashboard/redeem?code=${encodeURIComponent(code)}`,
          );
        }}
      >
        <Label htmlFor="invoice-code" className="text-xs uppercase tracking-wide text-muted-foreground">
          Invoice code
        </Label>
        <Input
          id="invoice-code"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="INV-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="text-center font-mono uppercase tracking-widest"
        />
        <Button type="submit" className="w-full">
          Open invoice
        </Button>
      </form>
    </div>
  );
}

function RedeemInner() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useDashboardSession();
  const source = useDataSource();
  useRequireBuyer();

  const code = (params.get("code") ?? "").trim().toUpperCase();
  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [failed, setFailed] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code || source === "live") return;
    let cancelled = false;
    // Deferred so state isn't reset synchronously inside the effect.
    queueMicrotask(() => {
      if (cancelled) return;
      setInvoice(null);
      setFailed(false);
      getInvoice(code)
        .then((data) => {
          if (!cancelled) setInvoice(data);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [code, source]);

  async function handlePay(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice) return;

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 10) {
      toast.error("Delivery address must be at least 10 characters");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setBusy(true);
    try {
      const { order_id } = await payInvoice(invoice.id, {
        delivery_address: trimmedAddress,
        phone: phone.trim(),
      });
      toast.success("Payment confirmed — your order is on its way");
      router.push(`/dashboard/orders/${order_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (session.status === "loading" || session.status === "error") {
    return <Skeleton />;
  }

  if (session.status === "authed" && session.data.role === "seller") {
    return null;
  }

  if (source === "live") {
    return <DemoDataNotice />;
  }

  if (!code) {
    return <CodeEntry initial="" />;
  }

  if (failed || !invoice) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-border/60 p-10 text-center">
        <h1 className="font-heading text-lg font-bold">Invoice not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Check the code with the seller, or try another one.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.replace("/dashboard/redeem")}
        >
          Enter a different code
        </Button>
      </div>
    );
  }

  if (invoice.status === "cancelled") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-border/60 p-10 text-center">
        <h1 className="font-heading text-lg font-bold">
          Invoice <span className="font-mono">#{invoice.id}</span> was cancelled
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask the seller to send you a new one.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.replace("/dashboard/redeem")}
        >
          Enter a different code
        </Button>
      </div>
    );
  }

  if (invoice.status === "paid") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-primary/40 bg-primary/10 p-10 text-center">
        <h1 className="font-heading text-lg font-bold">
          Invoice <span className="font-mono">#{invoice.id}</span> is already paid
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {invoice.paid_at ? `Paid ${formatDateTime(invoice.paid_at)}.` : ""}
        </p>
        {invoice.order_id && (
          <Link
            href={`/dashboard/orders/${invoice.order_id}`}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View the order
          </Link>
        )}
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.replace("/dashboard/redeem")}
          >
            Enter a different code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.replace("/dashboard/redeem")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        Different code
      </button>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
          Invoice <span className="font-mono">#{invoice.id}</span>
        </h1>
        <InvoiceStatusChip status={invoice.status} />
        <span className="text-sm text-muted-foreground">
          Created {formatDateTime(invoice.created_at)}
        </span>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">Items</h2>
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

          <dl className="mt-6">
            {invoice.note && (
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-border/60 py-2.5">
                <dt className="text-sm text-muted-foreground">Note</dt>
                <dd className="max-w-64 whitespace-normal text-right text-sm font-medium">
                  {invoice.note}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">
              How it works
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                1. Enter your delivery details and confirm payment.
              </li>
              <li>
                2. The invoice becomes a real order you can track from your
                dashboard.
              </li>
              <li>3. You confirm delivery when the item arrives.</li>
            </ol>
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground">
            Delivery details
          </h2>

          <dl className="mt-4 space-y-3 border-b border-dashed border-border/60 pb-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">
                <Amount value={invoice.product_kobo / 100} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Dispatch fee</dt>
              <dd className="tabular-nums">
                <Amount
                  value={
                    (invoice.dispatch_fee_kobo ??
                      invoice.total_kobo - invoice.product_kobo) / 100
                  }
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-base font-semibold">
              <dt>Total amount due</dt>
              <dd className="tabular-nums">
                <Amount value={invoice.total_kobo / 100} />
              </dd>
            </div>
          </dl>

          <form className="mt-5 space-y-4" onSubmit={handlePay}>
            <div className="space-y-1.5">
              <Label
                htmlFor="delivery-address"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Delivery address
              </Label>
              <textarea
                id="delivery-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Street, area, city, state"
                required
                minLength={10}
                className="min-h-20 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-base outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="phone"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Phone number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0801 234 5678"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Confirming payment..." : "Pay & create order"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Demo mode — no real money moves.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function RedeemPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <RedeemInner />
    </Suspense>
  );
}
