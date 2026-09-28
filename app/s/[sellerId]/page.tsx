"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getSeller,
  listPublicProducts,
  type MockProduct,
  type SellerProfile,
} from "@/lib/api";
import { ProductThumb } from "@/components/dashboard/product-thumb";
import { ReputationBadge } from "@/components/reputation-badge";
import { Amount } from "@/components/amount";
import { IconArrowLeft, IconStar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

function RatingSummary({ rating }: { rating: SellerProfile["rating"] }) {
  if (rating.count === 0) {
    return <p className="text-sm text-muted-foreground">No ratings yet</p>;
  }
  const filled = rating.average ? Math.round(rating.average) : 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="flex gap-0.5"
        role="img"
        aria-label={`${rating.average?.toFixed(1) ?? ""} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <IconStar
            key={star}
            className={cn(
              "size-4",
              star <= filled ? "fill-primary text-primary" : "text-border",
            )}
          />
        ))}
      </span>
      <p className="text-sm text-muted-foreground">
        {rating.average?.toFixed(1)} · {rating.count} rating
        {rating.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function StorefrontPage() {
  const params = useParams<{ sellerId: string }>();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [products, setProducts] = useState<MockProduct[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSeller(params.sellerId)
      .then((data) => {
        if (!cancelled) setSeller(data);
      })
      .catch((err) => {
        if (!cancelled)
          setFailed(
            err instanceof Error
              ? err.message
              : "This storefront isn't available.",
          );
      });
    listPublicProducts(params.sellerId)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sellerId]);

  const loading = !failed && seller === null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" />
        PayProof
      </Link>

      <header className="mt-6 rounded-2xl bg-secondary p-1">
        <section className="rounded-xl border border-border/60 bg-card p-6">
          {loading ? (
            <div className="animate-pulse space-y-3" aria-hidden="true">
              <div className="h-7 w-56 rounded-lg bg-muted/60" />
              <div className="h-4 w-40 rounded-lg bg-muted/60" />
            </div>
          ) : failed || !seller ? (
            <div className="py-4 text-center">
              <h1 className="font-heading text-xl font-bold">
                Storefront not found
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {failed ?? "This seller doesn't exist."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {seller.business_name || "Storefront"}
                </h1>
                <ReputationBadge badge={seller.reputation.badge} />
              </div>
              <div className="mt-2">
                <RatingSummary rating={seller.rating} />
              </div>
            </>
          )}
        </section>
      </header>

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Products
        </h2>
        {products === null ? (
          <div
            className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-hidden="true"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl bg-muted/40"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-border/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No products listed yet — check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const oos = p.stock_quantity <= 0;
              return (
                <article
                  key={p.id}
                  className={cn(
                    "overflow-hidden rounded-xl border border-border/60 bg-card",
                    oos && "opacity-60",
                  )}
                >
                  <ProductThumb
                    url={p.image_url}
                    name={p.name}
                    className="h-36 w-full"
                  />
                  <div className="space-y-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="truncate text-sm font-medium">
                        {p.name}
                      </h3>
                      {oos && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Sold out
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold tabular-nums">
                      <Amount value={p.price_kobo / 100} />
                    </p>
                    {p.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
