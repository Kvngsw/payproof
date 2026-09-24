"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { IconMenu2, IconX } from "@tabler/icons-react";

const NAV_LINKS = [
  { label: "How it works", href: "./#how" },
  { label: "For buyers", href: "./#who" },
] as const;

export function Navbar() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (!menuOpen && y > lastScrollY && y > 80) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(y);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScrollY, menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out",
          hidden && !menuOpen && "-translate-y-full",
        )}
      >
        <div
          className={cn(
            "transition-colors duration-300",
            scrolled || menuOpen
              ? "border-b border-border/60 bg-background/80 backdrop-blur-md"
              : "border-b border-transparent bg-transparent",
          )}
        >
          <nav className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-4 sm:px-6">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center font-heading text-lg font-extrabold tracking-tight"
              onClick={() => setMenuOpen(false)}
            >
              PayProof
            </Link>

            <ul className="hidden items-center gap-6 sm:flex">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                className="inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/signin"
                 className="inline-flex min-h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "sm" }), "h-10")}
              >
                Get your account
              </Link>
            </div>

            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted sm:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="relative flex size-5 items-center justify-center" aria-hidden="true">
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
        </div>
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
          {NAV_LINKS.map((link, index) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "font-heading text-3xl font-extrabold tracking-tight text-foreground transition-[color,opacity,transform] duration-300 ease-out hover:text-primary",
                menuOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0",
              )}
              style={{ transitionDelay: menuOpen ? `${index * 50}ms` : "0ms" }}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/signin"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "font-heading text-3xl font-extrabold tracking-tight text-foreground transition-[color,opacity,transform] duration-300 ease-out hover:text-primary",
              menuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: menuOpen ? "100ms" : "0ms" }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            onClick={() => setMenuOpen(false)}
            className={cn(
              buttonVariants({ size: "lg" }),
              "transition-[color,background-color,border-color,box-shadow,opacity,scale,transform] duration-300 ease-out",
              menuOpen
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0",
            )}
            style={{ transitionDelay: menuOpen ? "150ms" : "0ms" }}
          >
            Get your account
          </Link>
        </div>
      </div>
    </>
  );
}
