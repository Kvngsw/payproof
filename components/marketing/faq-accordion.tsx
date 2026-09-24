"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { FaqItem } from "@/lib/faq-data";

export function FaqAccordion({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  return (
    <div className={className}>
      {items.map((item) => {
        const open = openId === item.id;

        return (
          <div
            key={item.id}
            className="border-t border-border/60 last:border-b"
          >
            <button
              type="button"
              id={`faq-button-${item.id}`}
              aria-expanded={open}
              aria-controls={`faq-panel-${item.id}`}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-5 py-5 text-left"
            >
              <span className="font-heading text-lg font-extrabold tracking-tight text-balance md:text-xl">
                {item.question}
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border border-border/60 transition-[rotate,color,border-color] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]",
                  open && "rotate-45 border-primary text-primary",
                )}
                aria-hidden="true"
              >
                <IconPlus className="size-4" />
              </span>
            </button>
            <div
              id={`faq-panel-${item.id}`}
              role="region"
              aria-labelledby={`faq-button-${item.id}`}
              inert={!open}
              className={cn(
                "grid transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-[62ch] pb-5 pr-10 leading-relaxed text-muted-foreground text-pretty">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
