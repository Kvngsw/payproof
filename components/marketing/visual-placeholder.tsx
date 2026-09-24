import { cn } from "@/lib/utils"

export function VisualPlaceholder({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl bg-secondary p-1", className)}>
      <div className="flex h-full w-full shrink-0 items-center justify-center rounded-xl bg-chart-1/90">
        <span className="caption text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
