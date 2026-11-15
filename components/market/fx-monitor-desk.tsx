import type { ApiForexMonitorResponse } from "@/lib/api/types";
import { cn, formatPct } from "@/lib/utils";

/** The RBI's reference rates, as published; changes only against Arthdex's own earlier snapshot. */
export function FxMonitorDesk({ initialData: d }: { initialData: ApiForexMonitorResponse }) {
  const anyPrevious = d.pairs.some((p) => p.previous);
  return (
    <div className="space-y-4 py-3">
      <header className="border-b border-border pb-3">
        <h1 className="text-2xl font-semibold">Rupee reference rates</h1>
        <p className="mt-1 text-sm text-muted-foreground">The RBI&apos;s latest published reference rates: rupees per unit of each currency.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 text-left font-medium">Currency</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Rupees</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Change</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Since</th>
            </tr>
          </thead>
          <tbody>
            {d.pairs.map((p) => (
              <tr key={p.currency} className="border-b border-border/60">
                <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                  <span className="font-mono font-semibold">{p.currency}</span>
                  {p.units !== 1 ? <span className="ml-2 text-xs text-muted-foreground">per {p.units.toLocaleString("en-IN")}</span> : null}
                </th>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">₹{p.rate.toFixed(4)}</td>
                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", !p.previous ? "text-muted-foreground" : p.previous.change > 0 ? "text-down" : p.previous.change < 0 ? "text-up" : "")}>
                  {p.previous ? `${p.previous.change > 0 ? "+" : ""}${p.previous.change.toFixed(4)} (${formatPct(p.previous.changePct, 2)})` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-xs text-muted-foreground">{p.previous?.asOf ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        A rise means the rupee weakened against that currency.{" "}
        {anyPrevious
          ? "Changes are against Arthdex's own earlier snapshot of the same RBI rates."
          : "Changes appear once Arthdex has an earlier snapshot to compare with; none are back-filled."}{" "}
        Forward premia and the RBI&apos;s REER indices are not shown: no feed for them is connected yet.
      </p>
    </div>
  );
}
