"use client";

import { useState } from "react";
import { IconShoe } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  url,
  name,
  className,
}: {
  url?: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid place-items-center bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <IconShoe className="size-5" />
    </span>
  );
}
