import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Why PayProof", href: "#why" },
  { label: "Who it's for", href: "#who" },
  { label: "FAQ", href: "/faq" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Get an account", href: "/register" },
  { label: "Sign in", href: "/signin" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="font-heading text-lg font-extrabold tracking-tight">
              PayProof
            </span>
            <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-muted-foreground text-pretty">
              Escrow for people who sell in chats. Bank-verified payments,
              protected dispatch fees, payouts only after delivery.
            </p>
          </div>

          <nav aria-label="Product">
            <h3 className="caption text-muted-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h3 className="caption text-muted-foreground">Account</h3>
            <ul className="mt-4 space-y-3">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <span className="text-xs text-muted-foreground">
            Built for people who sell in chats.
          </span>
          <span className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} PayProof
          </span>
        </div>
      </div>
    </footer>
  );
}
