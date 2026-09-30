import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ApiScreenRow, ApiWindowedMovers } from "@/lib/api/types";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

/** Where CMP sits inside the 52-week band, clamped to [0, 1]. */
function bandPosition(row: ApiScreenRow): number {
  const span = row.high52w - row.low52w;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (row.cmp - row.low52w) / span));
}

function WindowTable({
  rows,
  window,
  tone,
}: {
  rows: ApiScreenRow[];
  window: string;
  tone: "up" | "down";
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No constituents qualified.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Scrip</th>
            <th className="px-3 py-2 text-right font-medium">CMP</th>
            <th className="px-3 py-2 text-right font-medium">% Chg</th>
            <th className="px-3 py-2 text-right font-medium">52W High</th>
            <th className="px-3 py-2 text-right font-medium">52W Low</th>
            <th className="w-24 px-3 py-2 text-left font-medium">Band</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const change = row.changePct[window] ?? 0;
            return (
              <tr
                key={row.symbol}
                className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/company/${row.symbol}`}
                    className="font-mono text-xs font-semibold hover:text-accent"
                  >
                    {row.symbol}
                  </Link>
                  <div className="truncate text-2xs text-muted-foreground">{row.name}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatINR(row.cmp)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums",
                      tone === "up" ? "bg-up/10 text-up" : "bg-down/10 text-down",
                    )}
                  >
                    {formatPct(change)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {formatINR(row.high52w, 0)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {formatINR(row.low52w, 0)}
                </td>
                <td className="px-3 py-2">
                  {/* Position within the 52-week range — context the raw
                      high/low columns do not give on their own */}
                  <div
                    className="relative h-1 w-full rounded-full bg-muted"
                    title="Position in 52-week range"
                  >
                    <div
                      className={cn(
                        "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                        tone === "up" ? "bg-up" : "bg-down",
                      )}
                      style={{ left: `${bandPosition(row) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WindowedMovers({ movers }: { movers: ApiWindowedMovers }) {
  const windowLabel = movers.window.charAt(0).toUpperCase() + movers.window.slice(1);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DataCard
        title={`${windowLabel} Gainers`}
        subtitle={`${movers.indexLabel} · ${movers.sessions}-session window`}
        icon={TrendingUp}
      >
        <div className="p-2">
          <WindowTable rows={movers.gainers} window={movers.window} tone="up" />
        </div>
      </DataCard>

      <DataCard
        title={`${windowLabel} Losers`}
        subtitle={`${movers.indexLabel} · ${movers.sessions}-session window`}
        icon={TrendingDown}
      >
        <div className="p-2">
          <WindowTable rows={movers.losers} window={movers.window} tone="down" />
        </div>
      </DataCard>
    </div>
  );
}
