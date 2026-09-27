import type { ReactNode } from "react";

// Nested layout for /signup/* — shared card frame for the chooser and both
// role sign-up pages (App Router nests layouts via folders).
export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border/60 bg-secondary p-1">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
        {children}
      </div>
    </div>
  );
}
