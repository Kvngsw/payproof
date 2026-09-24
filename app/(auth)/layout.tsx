import type { ReactNode } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-6 px-4 py-12 sm:px-6">
      <Link
        href="/"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <IconArrowLeft aria-hidden="true" />
        Back to home
      </Link>
      {children}
    </main>
  );
}
