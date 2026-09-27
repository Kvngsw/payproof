"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clearToken, useDataSource } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { IconMenu2, IconX, IconLogout2 } from "@tabler/icons-react";
import { useDashboardSession } from "./session-context";
import { DataSourceToggle } from "./data-source-switch";

type NavItem = { label: string; href: string };

const NAV_ITEMS: Record<"seller" | "buyer", NavItem[]> = {
  seller: [
    { label: "Home", href: "/dashboard" },
    { label: "Invoices", href: "/dashboard/invoices" },
    { label: "Inventory", href: "/dashboard/inventory" },
    { label: "Orders", href: "/dashboard/orders" },
  ],
  buyer: [
    { label: "Home", href: "/dashboard" },
    { label: "Pay invoice", href: "/dashboard/redeem" },
    { label: "Orders", href: "/dashboard/orders" },
  ],
};

function initialsOf(name?: string, fallback?: string) {
  const source = (name ?? fallback ?? "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function DashboardNavbar() {
  const router = useRouter();
  const session = useDashboardSession();
  const source = useDataSource();
  const [menuOpen, setMenuOpen] = useState(false);

  const role =
    session.status === "authed" ? session.data.role : ("seller" as const);
  const navItems = NAV_ITEMS[role].filter(
    (item) =>
      source !== "live" ||
      (item.href !== "/dashboard/invoices" &&
        item.href !== "/dashboard/redeem"),
  );

  const profile = session.status === "authed" ? session.data.profile : null;
  const displayName =
    profile?.business_name ?? profile?.name ?? profile?.email ?? "";

  function signOut() {
    clearToken();
    setMenuOpen(false);
    toast.success("Signed out");
    router.push("/");
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center font-heading text-lg font-extrabold tracking-tight"
            onClick={() => setMenuOpen(false)}
          >
            PayProof
          </Link>

          <ul className="hidden items-center gap-6 sm:flex">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 sm:flex">
            <DataSourceToggle reload />
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full border border-border/60 bg-muted text-xs font-semibold">
                {initialsOf(profile?.name, profile?.business_name)}
              </span>
              <span className="max-w-40 truncate text-sm font-medium">
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "text-muted-foreground",
              )}
            >
              <IconLogout2 className="size-4" />
              Sign out
            </button>
          </div>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted sm:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className="relative flex size-5 items-center justify-center"
              aria-hidden="true"
            >
              <IconMenu2
                className={cn(
                  "absolute inset-0 size-5 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  menuOpen
                    ? "scale-[0.25] opacity-0 blur-[4px]"
                    : "scale-100 opacity-100 blur-0",
                )}
              />
              <IconX
                className={cn(
                  "relative size-5 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  menuOpen
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-[0.25] opacity-0 blur-[4px]",
                )}
              />
            </span>
          </button>
        </nav>
      </header>

      {/* Mobile overlay — CSS-only enter/exit */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background transition-[opacity,visibility] duration-300 ease-out sm:hidden",
          menuOpen
            ? "visible pointer-events-auto opacity-100"
            : "invisible pointer-events-none opacity-0",
        )}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <div className="flex h-full flex-col items-start justify-center gap-8 px-8">
          {navItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "font-heading text-3xl font-extrabold tracking-tight text-foreground transition-[color,opacity,transform] duration-300 ease-out hover:text-primary",
                menuOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0",
              )}
              style={{ transitionDelay: menuOpen ? `${index * 50}ms` : "0ms" }}
            >
              {item.label}
            </Link>
          ))}
          <div
            className={cn(
              "mt-4 flex flex-col items-start gap-4 transition-[opacity,transform] duration-300 ease-out",
              menuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: "100ms" }}
          >
            <DataSourceToggle reload />
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full border border-border/60 bg-muted text-xs font-semibold">
                {initialsOf(profile?.name, profile?.business_name)}
              </span>
              <span className="max-w-60 truncate text-sm font-medium">
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              <IconLogout2 className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
