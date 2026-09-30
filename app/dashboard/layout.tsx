"use client";

import type { ReactNode } from "react";
import { DashboardProvider } from "@/components/dashboard/session-context";
import { DashboardNavbar } from "@/components/dashboard/navbar";
import { InvoiceRedirectHandler } from "@/components/dashboard/invoice-redirect";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardProvider>
      <DashboardNavbar />
      <InvoiceRedirectHandler />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-24 sm:px-6">
        {children}
      </main>
    </DashboardProvider>
  );
}
