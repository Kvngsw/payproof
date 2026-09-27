"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInvoice,
  listProducts,
  type MockProduct,
} from "@/lib/api/mock";
import { useDashboardSession } from "@/components/dashboard/session-context";
import { useDataSource } from "@/lib/api";
import { DemoDataNotice } from "@/components/dashboard/demo-data-notice";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { InvoiceBarcode } from "@/components/dashboard/invoice-barcode";
import { BlankBar } from "@/components/dashboard/blank-bar";
import { Amount } from "@/components/amount";
import {
  IconPlus,
  IconMinus,
  IconPackage,
} from "@tabler/icons-react";

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `INV-${hex.toUpperCase()}`;
}

const TEXTAREA_CLASS =
  "min-h-24 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 text-base outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

export default function NewInvoicePage() {
  const router = useRouter();
  const session = useDashboardSession();
  const source = useDataSource();
  const [products, setProducts] = useState<MockProduct[] | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [code] = useState(() => makeCode());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  const chosen = useMemo(
    () => (products ?? []).filter((p) => selected[p.id]),
    [products, selected],
  );
  const subtotalKobo = chosen.reduce(
    (sum, p) => sum + selected[p.id] * p.price_kobo,
    0,
  );
  const totalKobo = subtotalKobo;

  function setQty(product: MockProduct, qty: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[product.id];
      else next[product.id] = Math.min(qty, product.stock_quantity);
      return next;
    });
  }

  const profile = session.status === "authed" ? session.data.profile : null;
  const sellerName =
    profile?.business_name ?? profile?.name ?? "Your business";
  const initials = sellerName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const today = new Date().toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.length === 0) {
      toast.error("Pick at least one product for this invoice");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setBusy(true);
    try {
      const invoice = await createInvoice({
        code,
        items: chosen.map((p) => ({
          product_id: p.id,
          quantity: selected[p.id],
        })),
        customer_name: customerName.trim(),
        customer_contact: contact.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Invoice #${invoice.id} created`);
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (source === "live") {
    return (
      <div className="space-y-6">
        <DemoDataNotice />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-border/60 bg-card p-6 shadow-sm lg:col-start-2 lg:row-start-1"
        >
          <div>
            <h1 className="font-heading text-xl font-bold">Create invoice</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Fill in the details. The preview updates as you type.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Items
            </p>
            {products === null ? (
              <div className="space-y-2" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-5 text-center">
                <p className="text-sm text-muted-foreground">
                  No products in your inventory yet.
                </p>
                <Link
                  href="/dashboard/inventory"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <IconPlus className="size-4" />
                  Add a product
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                {products.map((p) => {
                  const oos = p.stock_quantity <= 0;
                  const qty = selected[p.id] ?? 0;
                  const isSelected = qty > 0;
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={oos ? -1 : 0}
                      aria-pressed={isSelected}
                      onClick={() => !oos && setQty(p, isSelected ? 0 : 1)}
                      onKeyDown={(e) => {
                        if (!oos && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          setQty(p, isSelected ? 0 : 1);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary ring-3 ring-primary/20"
                          : "border-border/60 hover:border-border",
                        oos && "cursor-not-allowed opacity-50",
                        !oos && "cursor-pointer",
                      )}
                    >
                      <ProductThumb
                        url={p.image_url}
                        name={p.name}
                        className="size-10 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <Amount value={p.price_kobo / 100} />
                        </p>
                      </div>
                      {oos ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Out of stock
                        </span>
                      ) : isSelected ? (
                        <span
                          className="flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-background"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            aria-label={`Decrease ${p.name}`}
                            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setQty(p, qty - 1)}
                          >
                            <IconMinus className="size-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-medium tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase ${p.name}`}
                            disabled={qty >= p.stock_quantity}
                            className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                            onClick={() => setQty(p, qty + 1)}
                          >
                            <IconPlus className="size-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="size-5 shrink-0 rounded-full border-2 border-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="customer-name">Name</Label>
              <Input
                id="customer-name"
                placeholder="Chinedu Okafor"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer-contact">Email or phone (optional)</Label>
              <Input
                id="customer-contact"
                placeholder="chinedu@example.com"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice-note">Note (optional)</Label>
            <textarea
              id="invoice-note"
              className={TEXTAREA_CLASS}
              placeholder="Payment memo or delivery instructions for the customer."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-dashed border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/invoices")}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || products === null}>
              {busy ? "Creating..." : "Create invoice"}
            </Button>
          </div>
        </form>

        <div className="space-y-3 lg:col-start-1 lg:row-start-1">
          <span className="caption inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-[5px] font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </span>

          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-muted font-heading text-xl font-bold text-muted-foreground">
                {initials}
              </span>
              <h2 className="font-heading text-4xl font-extrabold tracking-tight text-foreground/80 sm:text-5xl">
                Invoice
              </h2>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_1.4fr]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Invoice date
                  </p>
                  <p className="pt-1 text-sm font-medium">{today}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      From
                    </p>
                    <p className="pt-1 text-sm font-medium">{sellerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Invoice no
                    </p>
                    <p className="pt-1 font-mono text-sm font-medium">#{code}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    To
                  </p>
                  {customerName.trim() ? (
                    <p className="pt-1 text-sm font-medium">
                      {customerName.trim()}
                    </p>
                  ) : (
                    <div className="space-y-1.5 pt-1.5">
                      <BlankBar className="w-40" />
                      <BlankBar className="w-24" />
                    </div>
                  )}
                  {contact.trim() && (
                    <p className="pt-0.5 text-xs text-muted-foreground">
                      {contact.trim()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-dashed border-border/60 pt-4">
              <div className="grid grid-cols-[minmax(0,1fr)_56px_84px_88px] gap-2 pb-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Total</span>
              </div>
              {chosen.length === 0 ? (
                <div className="grid grid-cols-[minmax(0,1fr)_56px_84px_88px] gap-2 border-t border-border/60 py-4">
                  <BlankBar className="w-32" />
                  <span className="flex justify-end">
                    <BlankBar className="w-6" />
                  </span>
                  <span className="flex justify-end">
                    <BlankBar className="w-14" />
                  </span>
                  <span className="flex justify-end">
                    <BlankBar className="w-14" />
                  </span>
                </div>
              ) : (
                chosen.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[minmax(0,1fr)_56px_84px_88px] items-center gap-2 border-t border-border/60 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProductThumb
                        url={p.image_url}
                        name={p.name}
                        className="size-8 shrink-0 rounded-lg"
                      />
                      <span className="truncate text-sm font-medium">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-right text-sm tabular-nums text-muted-foreground">
                      {selected[p.id]}
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      <Amount value={p.price_kobo / 100} />
                    </span>
                    <span className="text-right text-sm font-medium tabular-nums">
                      <Amount
                        value={(selected[p.id] * p.price_kobo) / 100}
                      />
                    </span>
                  </div>
                ))
              )}

              <dl className="ml-auto mt-4 w-full max-w-72 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">
                    <Amount value={subtotalKobo / 100} />
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-border/60 pt-3">
                  <dt className="font-medium">Total amount due</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    <Amount value={totalKobo / 100} />
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 border-t border-dashed border-border/60 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Delivery details
                </p>
                <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                  Completed by buyer
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Delivery address
                  </p>
                  <div className="mt-1.5">
                    <BlankBar className="w-full max-w-52" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <div className="mt-1.5">
                    <BlankBar className="w-32" />
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] text-muted-foreground">
                The contract completes when the buyer fills these in and sends
                payment.
              </p>
            </div>

            <div className="mt-6 border-t border-dashed border-border/60 pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Note
              </p>
              {note.trim() ? (
                <p className="min-h-8 pt-1.5 text-sm">{note.trim()}</p>
              ) : (
                <div className="space-y-1.5 pt-2.5">
                  <BlankBar className="w-full" />
                  <BlankBar className="w-2/3" />
                </div>
              )}
            </div>

            <InvoiceBarcode code={code} className="mt-6" />

            <div className="mt-4 flex items-center justify-between border-t border-dashed border-border/60 pt-4 text-xs text-muted-foreground">
              <span className="font-heading font-bold text-foreground">
                PayProof
              </span>
              <span>Payment held until delivery confirmed.</span>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconPackage className="size-3.5" />
            Set quantities per item. Dispatch fee and delivery time are
            calculated by PayProof.
          </p>
        </div>
      </div>
    </div>
  );
}
