import { cn } from "@/lib/utils"

export function VisualPlaceholder({
  label,
  src,
  className,
}: {
  label?: string
  src?: string
  className?: string
}) {
  if (src) {
    return (
      <div className={cn("rounded-2xl bg-secondary p-1", className)}>
        <div className="flex h-full w-full shrink-0 items-center justify-center rounded-xl bg-background p-6 md:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl bg-secondary p-1", className)}>
      <div className="flex h-full w-full shrink-0 items-center justify-center rounded-xl bg-chart-1/90">
        <span className="caption text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
