import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import { VisualPlaceholder } from "@/components/marketing/visual-placeholder";
import { cn } from "@/lib/utils";

const STRIP_HEIGHT = "h-[280px] md:h-[360px]";

function ProofCards() {
  return (
    <>
      <VisualPlaceholder
        label="Photo"
        className={cn(STRIP_HEIGHT, "aspect-[4/3]")}
      />
      <VisualPlaceholder
        label="App screenshot"
        className={cn(STRIP_HEIGHT, "aspect-[1/1]")}
      />
      <VisualPlaceholder
        label="Dashboard screenshot"
        className={cn(STRIP_HEIGHT, "aspect-[16/10]")}
      />
    </>
  );
}

export function Hero() {
  return (
    <section className="pt-28 sm:pt-32 lg:pt-36">
      <div className="mx-auto w-full max-w-275 px-4 text-center sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="display-hero hero-enter hero-enter-1">
            Screenshots can be faked. <br/>Bank records can&rsquo;t.
          </h1>
          <p className="hero-enter hero-enter-2 mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground text-pretty">
            PayProof gives every seller a real reserved account, confirms
            every payment at the source, and holds product price{" "}
            <span className="font-medium text-foreground">
              and the dispatch fee
            </span>{" "}
            until the buyer confirms delivery.
          </p>
          <div className="hero-enter hero-enter-3 mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className={buttonVariants({ size: "lg" })}>
              Get your reserved account
              <IconArrowRight className="size-4" />
            </Link>
            <Link
              href="#how"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              See how it works
            </Link>
          </div>
        </div>
      </div>

      <div className="hero-enter hero-enter-4 marquee mt-16 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="animate-marquee flex w-max gap-4 pr-4">
          <div className="flex gap-4">
            <ProofCards />
          </div>
          <div className="flex gap-4" aria-hidden="true">
            <ProofCards />
          </div>
        </div>
      </div>
    </section>
  );
}
