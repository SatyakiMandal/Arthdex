import { cn } from "@/lib/utils";

/**
 * A table cell with a proportional bar behind the figure, so a column can be scanned
 * by length as well as read by value. The bar is anchored to the number's side.
 */
export function CellBar({
  value,
  max,
  tone = "accent",
  children,
  className,
  markers,
}: {
  value: number | null | undefined;
  /** The value that fills the whole cell. */
  max: number;
  tone?: "up" | "down" | "accent" | "flat" | "muted";
  children: React.ReactNode;
  className?: string;
  /** Optional reference positions (same scale as `max`), drawn as thin ticks. */
  markers?: number[];
}) {
  const pct = value == null || !Number.isFinite(value) || max <= 0 ? 0 : Math.min(100, (Math.abs(value) / max) * 100);
  const color = {
    up: "hsl(var(--up) / 0.22)",
    down: "hsl(var(--down) / 0.22)",
    accent: "hsl(var(--accent) / 0.22)",
    flat: "hsl(var(--flat) / 0.25)",
    muted: "hsl(var(--muted-foreground) / 0.2)",
  }[tone];

  return (
    <div className={cn("relative ml-auto flex h-7 min-w-[5.5rem] items-center justify-end overflow-hidden rounded-md px-2", className)}>
      <span className="absolute inset-y-0 right-0 rounded-md transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} aria-hidden />
      {markers?.map((m) => (
        <span key={m} className="absolute inset-y-1 w-px bg-muted-foreground/40" style={{ right: `${100 - Math.min(100, (m / max) * 100)}%` }} aria-hidden />
      ))}
      <span className="relative font-mono tabular-nums">{children}</span>
    </div>
  );
}
