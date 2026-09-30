"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function InvoiceRedirectHandlerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const invoiceId = searchParams.get("invoice");
    if (invoiceId) {
      const cleanId = invoiceId.trim().toUpperCase();
      if (cleanId) {
        router.replace(`/i/${encodeURIComponent(cleanId)}`);
      }
    }
  }, [router, searchParams]);

  return null;
}

export function InvoiceRedirectHandler() {
  return (
    <Suspense fallback={null}>
      <InvoiceRedirectHandlerInner />
    </Suspense>
  );
}