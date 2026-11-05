import Link from "next/link";
import { CellBar } from "@/components/ui/cell-bar";
import type { ApiMover } from "@/lib/api/types";
import { cn, deltaColor, formatDelta, formatINR, formatPct } from "@/lib/utils";

function formatVolume(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return String(value);
}

function DayRangeBar({
  cmp,
  low,
  high,
  tone,
}: {
  cmp: number;
  low: number | null;
  high: number | null;
  tone: "up" | "down";
}) {
  if (low === null || high === null || high <= low) {
    return <span className="text-3xs font-mono text-muted-foreground">—</span>;
  }
  const pct = Math.max(0, Math.min(100, ((cmp - low) / (high - low)) * 100));
  return (
    <div
      className="flex items-center gap-1 min-w-[85px] w-full"
      title={`Day Range: ₹${formatINR(low, 1)} – ₹${formatINR(high, 1)} · CMP at ${pct.toFixed(0)}% of range`}
    >
      <span className="text-3xs font-mono text-muted-foreground tabular-nums shrink-0">
        {formatINR(low, 0)}
      </span>
      <div className="relative h-1.5 flex-1 bg-border/40 overflow-hidden">
        <div
          className={cn(
            "absolute top-0 bottom-0 transition-all duration-300",
            tone === "up" ? "bg-up/60" : "bg-down/60",
          )}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
          style={{ left: `calc(${pct}% - 1px)` }}
        />
      </div>
      <span className="text-3xs font-mono text-muted-foreground tabular-nums shrink-0">
        {formatINR(high, 0)}
      </span>
    </div>
  );
}

export function MoversTable({ rows, tone }: { rows: ApiMover[]; tone: "up" | "down" }) {
  if (rows.length === 0) {
    return <p className="px-3 py-4 text-xs text-muted-foreground">No movers returned for this universe/price band.</p>;
  }

  const maxChg = Math.max(...rows.map((r) => Math.abs(r.change.percent)), 1);

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-2xs text-muted-foreground uppercase font-mono tracking-wider">
            <th className="px-2.5 py-1.5 text-left font-medium">Scrip</th>
            <th className="px-2.5 py-1.5 text-right font-medium">CMP</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Chg</th>
            <th className="px-2.5 py-1.5 text-right font-medium">% Chg</th>
            <th className="px-2.5 py-1.5 text-center font-medium min-w-[100px]">Intraday Range</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Volume</th>
            <th
              className="px-2.5 py-1.5 text-right font-medium"
              title="Share of traded quantity taken into delivery in the last completed session"
            >
              Deliv %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-border/40 transition-colors duration-150 last:border-0 hover:bg-surface-muted/80"
            >
              <td className="px-2.5 py-1.5">
                <Link
                  href={`/company/${row.symbol}`}
                  className="font-mono text-xs font-semibold hover:text-accent tracking-tight transition-colors"
                >
                  {row.symbol}
                </Link>
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-foreground font-medium">
                {formatINR(row.cmp)}
              </td>
              <td
                className={cn(
                  "px-2.5 py-1.5 text-right font-mono tabular-nums text-xs",
                  deltaColor(row.change.absolute),
                )}
              >
                {formatDelta(row.change.absolute)}
              </td>
              <td className="px-2.5 py-1 text-right">
                <CellBar value={row.change.percent} max={maxChg} tone={tone}>
                  <span className={cn("text-xs font-mono font-medium", tone === "up" ? "text-up" : "text-down")}>
                    {formatPct(row.change.percent)}
                  </span>
                </CellBar>
              </td>
              <td className="px-2.5 py-1.5">
                <DayRangeBar cmp={row.cmp} low={row.dayLow} high={row.dayHigh} tone={tone} />
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground text-2xs">
                {formatVolume(row.volume)}
              </td>
              <td className="px-2.5 py-1 text-right">
                {row.deliveryPct == null ? (
                  <span className="font-mono text-muted-foreground text-2xs">—</span>
                ) : (
                  <CellBar value={row.deliveryPct} max={100} tone={row.deliveryPct > 68 ? "accent" : "muted"} markers={[68]}>
                    <span className={cn("text-2xs font-mono", row.deliveryPct > 68 ? "text-accent" : "text-muted-foreground")}>
                      {row.deliveryPct.toFixed(1)}%
                    </span>
                  </CellBar>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
