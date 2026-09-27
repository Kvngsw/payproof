"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";
import { Amount } from "@/components/amount";
import { StatusChip } from "@/components/status-chip";
import {
  getInvoice,
  listOrders,
  payInvoice,
  useDataSource,
  type MockInvoice,
  type MockOrder,
} from "@/lib/api";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceStatusChip } from "@/components/dashboard/invoice-status-chip";
import {
  first,
  hasErrors,
  minLength,
  required,
  type FieldErrors,
} from "@/lib/form";
import {
  IconArrowRight,
  IconArrowLeft,
  IconReceiptOff,
} from "@tabler/icons-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecentOrders({ orders }: { orders: MockOrder[] | null }) {
  if (orders === null) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
        <div className="mx-auto grid size-10 place-items-center rounded-full border border-border/60 bg-muted">
          <IconReceiptOff className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          No orders yet. Orders you pay for will show up here.
        </p>
      </div>
    );
  }

  return (
    <dl>
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/dashboard/orders/${order.id}`}
          className="flex items-center gap-4 border-b border-dashed border-border/60 py-3 transition-colors last:border-b-0 hover:text-foreground"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {order.product.name}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              #{order.id.slice(0, 8)} · {formatDate(order.created_at)}
            </span>
          </span>
          <span className="hidden shrink-0 text-sm font-medium tabular-nums sm:block">
            <Amount value={order.amounts.total_kobo / 100} />
          </span>
          <span className="shrink-0">
            <StatusChip state={order.status} />
          </span>
        </Link>
      ))}
    </dl>
  );
}

function CodeEntryCard({
  value,
  onChange,
  onSubmit,
  source,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  source: "mock" | "live";
}) {
  return (
    <section className="rounded-xl border border-dashed border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Have an invoice?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the code your seller shared to pay and track it as an order.
          </p>
        </div>
        {source === "live" ? (
          <div className="w-full max-w-sm">
            <DemoDataNotice compact />
          </div>
        ) : (
          <form className="flex items-center gap-2" onSubmit={onSubmit}>
            <Label htmlFor="invoice-code" className="sr-only">
              Invoice code
            </Label>
            <Input
              id="invoice-code"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="INV-XXXXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-44 text-center font-mono uppercase tracking-widest"
            />
            <Button type="submit">Pay invoice</Button>
          </form>
        )}
      </div>
    </section>
  );
}

function InvoiceMessageCard({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <section
      className={
        tone === "success"
          ? "mx-auto max-w-xl rounded-xl border border-primary/40 bg-primary/10 p-10 text-center"
          : "mx-auto max-w-xl rounded-xl border border-dashed border-border/60 p-10 text-center"
      }
    >
      {children}
    </section>
  );
}

export function BuyerHome() {
  const router = useRouter();
  const session = useDashboardSession();
  const source = useDataSource();
  const [orders, setOrders] = useState<MockOrder[] | null>(null);

  const [codeDraft, setCodeDraft] = useState("");
  const [invoiceCode, setInvoiceCode] = useState("");
  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [invoiceFailed, setInvoiceFailed] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [payErrors, setPayErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listOrders()
      .then((data) => {
        if (!cancelled) setOrders(data.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  // Keep the code in sync with ?invoice= (share links + browser back/forward).
  useEffect(() => {
    function read() {
      const raw =
        new URLSearchParams(window.location.search).get("invoice") ?? "";
      const code = raw.trim().toUpperCase();
      // Deferred so state isn't set synchronously inside the effect.
      queueMicrotask(() => setInvoiceCode(code));
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  useEffect(() => {
    if (!invoiceCode || source === "live") return;
    let cancelled = false;
    // Deferred so state isn't reset synchronously inside the effect.
    queueMicrotask(() => {
      if (cancelled) return;
      setInvoice(null);
      setInvoiceFailed(false);
      getInvoice(invoiceCode)
        .then((data) => {
          if (!cancelled) setInvoice(data);
        })
        .catch(() => {
          if (!cancelled) setInvoiceFailed(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceCode, source]);

  if (session.status !== "authed") return null;

  const { profile } = session.data;
  const greeting = profile.name?.split(/\s+/)[0] ?? profile.email.split("@")[0] ?? "there";
  const initials = (profile.name ?? profile.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-NG", {
        month: "short",
        year: "numeric",
      })
    : null;

  function openCode(code: string) {
    const next = code.trim().toUpperCase();
    if (!next) return;
    setInvoiceCode(next);
    router.replace(`/dashboard?invoice=${encodeURIComponent(next)}`);
  }

  function clearInvoice() {
    setInvoiceCode("");
    setInvoice(null);
    setInvoiceFailed(false);
    setCodeDraft("");
    setAddress("");
    setPhone("");
    setPayErrors({});
    router.replace("/dashboard");
  }

  async function handlePay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;

    const trimmedAddress = address.trim();
    const nextErrors: FieldErrors = {
      address: first(
        required(address, "Delivery address"),
        minLength(address.trim(), 10, "Delivery address"),
      ),
      phone: required(phone, "Phone number"),
    };
    setPayErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

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

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-border/60 bg-muted text-base font-semibold">
          {initials}
        </span>
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Hello, {greeting}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Your orders and payments, all in one place.
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
        View orders
        <IconArrowRight className="size-4" />
      </Button>
    </header>
  );

  if (invoiceCode && source === "live") {
    return (
      <div className="space-y-8">
        {header}
        <section className="rounded-xl border border-dashed border-border/60 bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pay an invoice
          </h2>
          <div className="pt-4">
            <DemoDataNotice compact />
          </div>
        </section>
      </div>
    );
  }

  if (invoiceCode) {
    let body: ReactNode;

    if (invoiceFailed) {
      body = (
        <InvoiceMessageCard>
          <div className="mx-auto grid size-10 place-items-center rounded-full border border-border/60 bg-muted">
            <IconReceiptOff className="size-4 text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-bold">Invoice not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check the code with the seller, or try another one.
          </p>
          <Button variant="outline" className="mt-4" onClick={clearInvoice}>
            Enter a different code
          </Button>
        </InvoiceMessageCard>
      );
    } else if (!invoice) {
      body = (
        <div
          className="mx-auto h-40 max-w-xl animate-pulse rounded-xl border border-border/60 bg-muted/40"
          aria-hidden="true"
        />
      );
    } else if (invoice.status === "cancelled") {
      body = (
        <InvoiceMessageCard>
          <h2 className="font-heading text-lg font-bold">
            Invoice <span className="font-mono">#{invoice.id}</span> was cancelled
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the seller to send you a new one.
          </p>
          <Button variant="outline" className="mt-4" onClick={clearInvoice}>
            Enter a different code
          </Button>
        </InvoiceMessageCard>
      );
    } else if (invoice.status === "paid") {
      body = (
        <InvoiceMessageCard tone="success">
          <h2 className="font-heading text-lg font-bold">
            Invoice <span className="font-mono">#{invoice.id}</span> is already paid
          </h2>
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
            <Button variant="outline" size="sm" onClick={clearInvoice}>
              Enter a different code
            </Button>
          </div>
        </InvoiceMessageCard>
      );
    } else {
      body = (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl bg-secondary p-1">
            <section className="h-full rounded-xl border border-border/60 bg-card p-6">
              <button
                type="button"
                onClick={clearInvoice}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <IconArrowLeft className="size-4" />
                Different code
              </button>
              <header className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-dashed border-border/60 pb-4">
                <h2 className="font-heading text-xl font-extrabold tracking-tight">
                  Invoice <span className="font-mono">#{invoice.id}</span>
                </h2>
                <InvoiceStatusChip status={invoice.status} />
                <span className="text-xs text-muted-foreground">
                  Created {formatDateTime(invoice.created_at)}
                </span>
              </header>

              <ul className="mt-2">
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

              {invoice.note && (
                <p className="mt-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span>{" "}
                  {invoice.note}
                </p>
              )}
            </section>
          </div>

          <div className="rounded-2xl bg-secondary p-1">
            <section className="h-full rounded-xl border border-border/60 bg-card p-6">
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

              <form
                className="mt-5 space-y-4"
                onSubmit={handlePay}
                noValidate
              >
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
                    onChange={(event) => {
                      setAddress(event.target.value);
                      if (payErrors.address)
                        setPayErrors((prev) => ({ ...prev, address: undefined }));
                    }}
                    placeholder="Street, area, city, state"
                    required
                    minLength={10}
                    aria-invalid={payErrors.address ? true : undefined}
                    className="min-h-20 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-base outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
                  />
                  <FieldError>{payErrors.address}</FieldError>
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
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (payErrors.phone)
                        setPayErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="0801 234 5678"
                    required
                    aria-invalid={payErrors.phone ? true : undefined}
                  />
                  <FieldError>{payErrors.phone}</FieldError>
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

    return (
      <div className="space-y-8">
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl bg-secondary p-1">
          <section className="h-full rounded-xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-between border-b border-dashed border-border/60 pb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent orders
              </h2>
              <Link
                href="/dashboard/orders"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="pt-2">
              <RecentOrders orders={orders} />
            </div>
          </section>
        </div>

        <div className="rounded-2xl bg-secondary p-1">
          <section className="h-full rounded-xl border border-border/60 bg-card p-6">
            <div className="border-b border-dashed border-border/60 pb-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                Your details
              </h2>
            </div>
            <dl className="grid gap-4 pt-5">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Email
                </dt>
                <dd className="pt-1 break-all text-sm font-medium">
                  {profile.email}
                </dd>
              </div>
              {memberSince && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Member since
                  </dt>
                  <dd className="pt-1 text-sm font-medium">{memberSince}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>

      <CodeEntryCard
        value={codeDraft}
        onChange={setCodeDraft}
        onSubmit={(event) => {
          event.preventDefault();
          openCode(codeDraft);
        }}
        source={source}
      />
    </div>
  );
}
