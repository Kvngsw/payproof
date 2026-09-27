"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type MockProduct,
} from "@/lib/api";
import { useDashboardSession, useRequireSeller } from "@/components/dashboard/session-context";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { Amount } from "@/components/amount";
import {
  first,
  hasErrors,
  pattern,
  required,
  type FieldErrors,
} from "@/lib/form";
import { IconPlus, IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

type FormState = {
  name: string;
  price: string;
  stock: string;
  description: string;
  image_url: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  price: "",
  stock: "",
  description: "",
  image_url: "",
};

function toForm(product: MockProduct): FormState {
  return {
    name: product.name,
    price: String(product.price_kobo / 100),
    stock: String(product.stock_quantity),
    description: product.description,
    image_url: product.image_url,
  };
}

function StockChip({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
        Out of stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
      <span className="size-1.5 rounded-full bg-primary/70" />
      {stock} in stock
    </span>
  );
}

export default function InventoryPage() {
  const session = useDashboardSession();
  useRequireSeller();
  const [products, setProducts] = useState<MockProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MockProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MockProduct | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  function updateForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function clearError(key: string) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  useEffect(() => {
    if (session.status !== "authed") return;
    let cancelled = false;
    listProducts()
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSheetOpen(true);
  }

  function openEdit(product: MockProduct) {
    setEditing(product);
    setForm(toForm(product));
    setErrors({});
    setSheetOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const price = form.price;
    const nextErrors: FieldErrors = {
      name: required(name, "Product name"),
      price: first(
        required(price, "Price"),
        pattern(price.trim(), /^\d+(\.\d+)?$/, "Enter a valid price"),
        Number(price) > 0 ? undefined : "Enter a price greater than zero",
      ),
      stock: pattern(
        form.stock.trim(),
        /^\d+$/,
        "Stock must be a whole number",
      ),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setBusy(true);
    const payload = {
      name,
      price_kobo: Math.round(Number(price) * 100),
      stock_quantity: Math.max(0, Math.round(Number(form.stock) || 0)),
      description: form.description.trim(),
      image_url: form.image_url.trim(),
    };

    try {
      if (editing) {
        const updated = await updateProduct(editing.id, payload);
        setProducts((prev) =>
          prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
        );
        toast.success("Product updated");
      } else {
        const created = await createProduct(payload);
        setProducts((prev) => [created, ...(prev ?? [])]);
        toast.success("Product added");
      }
      setSheetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(product: MockProduct) {
    try {
      await deleteProduct(product.id);
      setProducts((prev) => (prev ?? []).filter((p) => p.id !== product.id));
      toast.success("Product deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    }
  }

  const loading = session.status === "loading" || (products === null && !failed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Products you can pull into invoices.
          </p>
        </div>
        <Button onClick={openAdd}>
          <IconPlus className="size-4" />
          Add product
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
            Couldn&apos;t load your inventory.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setFailed(false);
              setProducts(null);
              listProducts()
                .then(setProducts)
                .catch(() => setFailed(true));
            }}
          >
            Try again
          </Button>
        </div>
      ) : products && products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
          <h2 className="font-heading text-lg font-bold">No products yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first product so you can include it on an invoice.
          </p>
          <Button className="mt-4" onClick={openAdd}>
            <IconPlus className="size-4" />
            Add product
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductThumb
                        url={product.image_url}
                        name={product.name}
                        className="size-10 shrink-0 rounded-lg"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        {product.description && (
                          <p className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <Amount value={product.price_kobo / 100} />
                  </TableCell>
                  <TableCell>
                    <StockChip stock={product.stock_quantity} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${product.name}`}
                          />
                        }
                      >
                        <IconDots className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            openEdit(product);
                          }}
                        >
                          <IconPencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setPendingDelete(product);
                          }}
                        >
                          <IconTrash className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit product" : "Add product"}</SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-6">
              <div className="space-y-1.5">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  placeholder="Air Runner Sneakers"
                  value={form.name}
                  onChange={(e) => {
                    updateForm({ name: e.target.value });
                    clearError("name");
                  }}
                  required
                  aria-invalid={errors.name ? true : undefined}
                />
                <FieldError>{errors.name}</FieldError>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="product-price">Price (₦)</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="45000"
                    value={form.price}
                    onChange={(e) => {
                      updateForm({ price: e.target.value });
                      clearError("price");
                    }}
                    required
                    aria-invalid={errors.price ? true : undefined}
                  />
                  <FieldError>{errors.price}</FieldError>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-stock">Stock</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min="0"
                    placeholder="10"
                    value={form.stock}
                    onChange={(e) => {
                      updateForm({ stock: e.target.value });
                      clearError("stock");
                    }}
                    aria-invalid={errors.stock ? true : undefined}
                  />
                  <FieldError>{errors.stock}</FieldError>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-description">Description</Label>
                <Input
                  id="product-description"
                  placeholder="Lightweight running sneakers"
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-image">Image URL</Label>
                <div className="flex items-center gap-3">
                  <ProductThumb
                    url={form.image_url.trim()}
                    name={form.name || "Product"}
                    className="size-12 shrink-0 rounded-lg border border-border/60"
                  />
                  <Input
                    id="product-image"
                    placeholder="https://..."
                    value={form.image_url}
                    onChange={(e) => updateForm({ image_url: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Add product"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : "Delete product?"}
        description="This removes the product from your inventory. Invoices that already reference it keep their snapshot."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
        }}
      />
    </div>
  );
}
