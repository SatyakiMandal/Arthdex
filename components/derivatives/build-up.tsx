import Link from "next/link";
import type { ApiBuildUp } from "@/lib/api/types";
import { cn, formatPct } from "@/lib/utils";

const QUADRANTS: { key: keyof ApiBuildUp["buckets"]; title: string; reads: string; tone: "up" | "down" }[] = [
  { key: "longBuildUp", title: "Long build-up", reads: "Price up, open interest up: new buying", tone: "up" },
  { key: "shortCovering", title: "Short covering", reads: "Price up, open interest down: shorts closing", tone: "up" },
  { key: "shortBuildUp", title: "Short build-up", reads: "Price down, open interest up: new selling", tone: "down" },
  { key: "longUnwinding", title: "Long unwinding", reads: "Price down, open interest down: longs exiting", tone: "down" },
];

export function BuildUpView({ data }: { data: ApiBuildUp }) {
  return (
    <div>
      <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
        {QUADRANTS.map((q) => {
          const rows = data.buckets[q.key];
          return (
            <div key={q.key}>
              <div className="flex items-baseline justify-between gap-3 border-t border-foreground/80 pt-3">
                <h3 className="font-sans text-[15px] font-semibold tracking-normal">{q.title}</h3>
                <span className="font-mono text-sm text-muted-foreground">{rows.length}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{q.reads}</p>
              <table className="mt-3 w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Stock</th>
                    <th scope="col">Price change</th>
                    <th scope="col">Open interest change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r) => (
                    <tr key={r.symbol} className="border-b border-border/60">
                      <th scope="row" className="py-1.5 text-left font-normal">
                        <Link href={`/derivatives?symbol=${encodeURIComponent(r.symbol)}`} className="font-mono underline decoration-border underline-offset-4 hover:decoration-gold">
                          {r.symbol}
                        </Link>
                      </th>
                      <td className={cn("py-1.5 text-right font-mono tabular-nums", q.tone === "up" ? "text-up" : "text-down")}>{formatPct(r.priceChangePct, 2)}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                        OI {r.oiChangePct != null ? formatPct(r.oiChangePct, 1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">None today.</p> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        {data.classified} of {data.of} F&amp;O stocks with an open-interest change today, ranked by the size of that change. Price change is measured from
        the exchange&apos;s adjusted base, so an ex-dividend day does not read as a fall. Each symbol opens its option chain.
      </p>
    </div>
  );
}
