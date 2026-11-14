import { cn } from "@/lib/utils";
import type { ApiForexMonitorResponse } from "@/lib/api/types";

const DASH = "—";
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${num(v)}%` : DASH);
// A higher number is a weaker rupee, which is neither good nor bad on its own, so moves are not coloured green or red
const tone = (v: number | null | undefined) => (typeof v !== "number" || v === 0 ? "text-muted-foreground" : "text-foreground");

export function FxMonitorDesk({ initialData }: { initialData: ApiForexMonitorResponse }) {
  const { pairs, asOf, unavailable, missingPairs } = initialData;
  const lead = pairs.slice(0, 4);

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h1 className="text-base font-bold uppercase tracking-wider text-foreground">Rupee cross rates</h1>
        <span className="text-3xs text-muted-foreground">Spot market quotes • latest session {asOf}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {lead.map((p) => (
          <div key={p.pair} className="border border-border bg-surface p-3">
            <span className="text-3xs font-bold uppercase text-muted-foreground">{p.pair}</span>
            <div className="mt-1 text-lg font-bold text-foreground">₹{num(p.rate, p.rate < 10 ? 4 : 2)}</div>
            <span className={cn("text-3xs", tone(p.changePct))}>{signed(p.changePct)} on the day</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left text-2xs">
          <caption className="sr-only">Rupees per unit of each currency</caption>
          <thead>
            <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
              <th className="px-2 py-1.5" scope="col">Pair</th>
              <th className="px-2 py-1.5 text-right" scope="col">Rate (₹)</th>
              <th className="px-2 py-1.5 text-right" scope="col">Day</th>
              <th className="px-2 py-1.5 text-right" scope="col">Day low</th>
              <th className="px-2 py-1.5 text-right" scope="col">Day high</th>
              <th className="px-2 py-1.5 text-right" scope="col">1 month</th>
              <th className="px-2 py-1.5 text-right" scope="col">1 year</th>
              <th className="px-2 py-1.5 text-right" scope="col">As of</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {pairs.map((p) => (
              <tr key={p.pair} className="hover:bg-surface-muted/50">
                <th className="px-2 py-1.5 font-bold" scope="row">{p.pair}</th>
                <td className="px-2 py-1.5 text-right font-bold">{num(p.rate, p.rate < 10 ? 4 : 2)}</td>
                <td className={cn("px-2 py-1.5 text-right", tone(p.changePct))}>{signed(p.changePct)}</td>
                <td className="px-2 py-1.5 text-right">{num(p.low, p.rate < 10 ? 4 : 2)}</td>
                <td className="px-2 py-1.5 text-right">{num(p.high, p.rate < 10 ? 4 : 2)}</td>
                <td className={cn("px-2 py-1.5 text-right", tone(p.change1mPct))}>{signed(p.change1mPct)}</td>
                <td className={cn("px-2 py-1.5 text-right", tone(p.change1yPct))}>{signed(p.change1yPct)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{p.asOf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-3xs text-muted-foreground">
        <p>A rising figure means the rupee has weakened against that currency. Changes are on closing quotes.</p>
        {missingPairs.length ? <p>No data today for: {missingPairs.join(", ")}.</p> : null}
        <ul className="list-disc space-y-0.5 pl-4">
          {Object.values(unavailable).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
