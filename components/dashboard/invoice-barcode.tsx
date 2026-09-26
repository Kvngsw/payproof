const BAR_COUNT = 42;

function barsFromCode(code: string) {
  let seed = 7;
  for (let i = 0; i < code.length; i++) {
    seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
  }
  const widths: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    widths.push((seed % 3) + 1);
  }
  return widths;
}

export function InvoiceBarcode({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const widths = barsFromCode(code);
  return (
    <div className={className} aria-hidden="true">
      <div className="flex h-10 items-stretch gap-[3px]">
        {widths.map((w, i) => (
          <span
            key={i}
            className={i % 2 === 0 ? "bg-foreground" : "bg-transparent"}
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <p className="mt-1 text-center font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
        {code}
      </p>
    </div>
  );
}
