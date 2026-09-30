import Link from "next/link";
import type { ApiMover } from "@/lib/api/types";
import { cn, deltaColor, formatDelta, formatINR, formatPct } from "@/lib/utils";

function formatVolume(value: number): string {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} K`;
  return String(value);
}

export function MoversTable({ rows, tone }: { rows: ApiMover[]; tone: "up" | "down" }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No movers returned.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Scrip</th>
            <th className="px-3 py-2 text-right font-medium">CMP</th>
            <th className="px-3 py-2 text-right font-medium">Chg</th>
            <th className="px-3 py-2 text-right font-medium">% Chg</th>
            <th className="px-3 py-2 text-right font-medium">Day High</th>
            <th className="px-3 py-2 text-right font-medium">Day Low</th>
            <th className="px-3 py-2 text-right font-medium">Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.symbol}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-muted"
            >
              <td className="px-3 py-2">
                {/* Every NSE symbol now has a company page, so all rows link */}
                <Link
                  href={`/company/${row.symbol}`}
                  className="font-mono text-xs font-semibold hover:text-accent"
                >
                  {row.symbol}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{formatINR(row.cmp)}</td>
              <td
                className={cn(
                  "px-3 py-2 text-right font-mono tabular-nums",
                  deltaColor(row.change.absolute),
                )}
              >
                {formatDelta(row.change.absolute)}
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={cn(
                    "inline-block rounded px-1.5 py-0.5 font-mono text-xs font-medium tabular-nums",
                    tone === "up" ? "bg-up/10 text-up" : "bg-down/10 text-down",
                  )}
                >
                  {formatPct(row.change.percent)}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {row.dayHigh === null ? "—" : formatINR(row.dayHigh)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {row.dayLow === null ? "—" : formatINR(row.dayLow)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                {formatVolume(row.volume)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
