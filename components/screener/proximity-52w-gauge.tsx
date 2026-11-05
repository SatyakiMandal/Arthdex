import { cn, formatINR } from "@/lib/utils";

interface Proximity52WGaugeProps {
  price: number;
  high52w: number | null | undefined;
  low52w: number | null | undefined;
}

export function Proximity52WGauge({ price, high52w, low52w }: Proximity52WGaugeProps) {
  if (!high52w || !low52w || high52w <= low52w) {
    return <span className="font-mono text-3xs text-muted-foreground/60">—</span>;
  }

  const span = high52w - low52w;
  const pct = Math.max(0, Math.min(100, ((price - low52w) / span) * 100));
  const distHigh = ((price - high52w) / high52w) * 100;
  const isCoiling = distHigh >= -2.5 && distHigh <= 0.2;
  const isATH = distHigh > 0.2;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 min-w-[100px] w-full px-1 py-0.5 border border-transparent transition-colors",
        isCoiling && "border-gold/60 bg-gold/5",
        isATH && "border-up/60 bg-up/5",
      )}
      title={`52W Band: ₹${formatINR(low52w, 0)} – ₹${formatINR(high52w, 0)} · CMP at ${pct.toFixed(0)}% of range (${distHigh >= 0 ? "+" : ""}${distHigh.toFixed(1)}% from high)`}
    >
      <div className="relative h-2 flex-1 bg-border/40 overflow-hidden">
        {/* Low Extreme marker */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-down/70" />

        {/* 52W High Breakout Hot Zone (top 5% of range) */}
        <div className="absolute right-0 top-0 bottom-0 w-[5%] bg-gold/30" />

        {/* High Extreme marker */}
        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-up/70" />

        {/* Current Price Pin */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-1 transition-all duration-300",
            isCoiling ? "bg-gold" : isATH ? "bg-up" : "bg-foreground",
          )}
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>

      {/* Proximity Callout */}
      <span
        className={cn(
          "font-mono text-3xs shrink-0 tabular-nums font-semibold",
          isATH
            ? "text-up font-bold"
            : isCoiling
              ? "text-gold font-bold"
              : "text-muted-foreground",
        )}
      >
        {isATH ? "ATH" : `${distHigh >= 0 ? "+" : ""}${distHigh.toFixed(1)}%`}
      </span>
    </div>
  );
}
