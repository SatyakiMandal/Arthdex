"use client";

import { useState } from "react";
import type { CompanyFilingsPayload } from "@/lib/api/types";
import { cn, deltaColor, formatPct } from "@/lib/utils";

// Routine notices (newspaper copies, trading-window closures) are hidden unless asked for
const ROUTINE = "General";

/** "04-Nov-2026 11:00:07" → "04 Nov 2026, 11:00" (NSE prints IST already) */
function filed(raw: string): string {
  const m = raw.match(/^(\d{2})-(\w{3})-(\d{4})(?: (\d{2}:\d{2}))?/);
  return m ? `${m[1]} ${m[2]} ${m[3]}${m[4] ? `, ${m[4]}` : ""}` : raw;
}

function Pct({ v }: { v: number | null }) {
  return (
    <td className={cn("px-2 py-2 text-right font-mono tabular-nums", v == null ? "text-muted-foreground" : deltaColor(v))}>
      {v == null ? "—" : formatPct(v, 2)}
    </td>
  );
}

export function FilingsTimeline({ data }: { data: CompanyFilingsPayload }) {
  const [category, setCategory] = useState<string | null>(null);
  const [routine, setRoutine] = useState(false);

  const counts = Object.entries(data.categoryCounts).filter(([c]) => c !== ROUTINE).sort((a, b) => b[1] - a[1]);
  const rows = data.filings.filter((f) => (category ? f.category === category : routine || f.category !== ROUTINE));
  const routineCount = data.categoryCounts[ROUTINE] ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-foreground/80 pt-3">
        <h3 className="font-sans text-[15px] font-semibold tracking-normal">Filings and how the price took them</h3>
        <span className="text-xs text-muted-foreground">Last {data.filings.length} exchange disclosures</span>
      </div>

      <nav aria-label="Filing type" className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
          className={cn(
            "rounded-none border px-3 py-1.5 text-sm transition-colors",
            category === null ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {counts.map(([c, n]) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? null : c)}
            aria-pressed={category === c}
            className={cn(
              "rounded-none border px-3 py-1.5 text-sm transition-colors",
              category === c ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c} <span className="font-mono text-xs opacity-70">{n}</span>
          </button>
        ))}
        {routineCount && category === null ? (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={routine} onChange={(e) => setRoutine(e.target.checked)} className="accent-[hsl(var(--gold))]" />
            Show {routineCount} routine notices
          </label>
        ) : null}
      </nav>

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 text-left font-medium">Filed</th>
                <th scope="col" className="py-2 pr-4 text-left font-medium">Filing</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Stock</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Nifty 50</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => (
                <tr key={f.seqId ?? `${f.broadcastDate}-${i}`} className="border-b border-border/60 align-top">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-muted-foreground">{filed(f.broadcastDate)}</td>
                  <th scope="row" className="py-2 pr-4 text-left font-normal">
                    <span className="mr-2 text-xs text-muted-foreground">{f.category}</span>
                    {f.attachment ? (
                      <a href={f.attachment} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-4 hover:decoration-gold">
                        {f.subject || "Disclosure"}
                      </a>
                    ) : (
                      f.subject || "Disclosure"
                    )}
                  </th>
                  <Pct v={f.stockReturnPct} />
                  <Pct v={f.niftyReturnPct} />
                  <Pct v={f.abnormalReturnPct} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No filings of this kind among the recent disclosures.</p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Moves are for the first session the filing could reach: the same day, or the next if it was filed after the 15:30 close. Filings on the same day share
        one move, so the column says what the market did, not what the filing caused. Closes are not adjusted, so an ex-dividend day reads as a fall.
      </p>
    </div>
  );
}
