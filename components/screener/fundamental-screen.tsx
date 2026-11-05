import Link from "next/link";
import type { ApiFundamentalScreen } from "@/lib/api/types";
import { cn, deltaColor, formatINR } from "@/lib/utils";

const COLUMNS: { key: string; digits: number; tone?: boolean }[] = [
  { key: "price", digits: 2 },
  { key: "change", digits: 2, tone: true },
  { key: "mcap", digits: 0 },
  { key: "pe", digits: 1 },
  { key: "pb", digits: 1 },
  { key: "roe", digits: 1 },
  { key: "roce", digits: 1 },
  { key: "de", digits: 2 },
  { key: "revgrowth", digits: 1, tone: true },
  { key: "profitgrowth", digits: 1, tone: true },
  { key: "opm", digits: 1 },
  { key: "divyield", digits: 2 },
];
const SHORT: Record<string, string> = {
  price: "Price", change: "Today", mcap: "Mkt cap (Cr)", pe: "P/E", pb: "P/B", roe: "ROE %", roce: "ROCE %", de: "D/E",
  revgrowth: "Rev. growth %", profitgrowth: "Profit growth %", opm: "OPM %", divyield: "Yield %",
};

function href(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return `/screener?${qs.toString()}#fundamental`;
}

export function FundamentalScreen({
  data,
  q,
  sort,
  order,
  error,
}: {
  data: ApiFundamentalScreen | null;
  q: string;
  sort: string;
  order: string;
  error?: string;
}) {
  const presets = data?.presets ?? {};
  const active = data?.preset ?? null;
  const formula = active ? presets[active]?.formula ?? "" : q;

  return (
    <div className="space-y-6">
      <nav aria-label="Ready-made screens" className="flex flex-wrap gap-2">
        {Object.entries(presets).map(([id, p]) => (
          <Link
            key={id}
            href={href({ preset: id })}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "rounded-none border px-3 py-1.5 text-sm transition-colors",
              active === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <form action="/screener#fundamental" className="flex flex-wrap items-center gap-2">
        <label htmlFor="formula" className="sr-only">Screen formula</label>
        <input
          id="formula"
          name="q"
          defaultValue={formula}
          placeholder="pe < 20 AND roe > 18 AND de < 0.5"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-none border border-border bg-surface px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="btn-primary h-10 px-4">Run screen</button>
      </form>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer underline decoration-border underline-offset-4">Fields you can use</summary>
        <dl className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data?.fields ?? {}).map(([key, f]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-24 shrink-0 font-mono text-foreground">{key}</dt>
              <dd>
                {f.label} ({f.unit}), {f.basis}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3">Join conditions with AND. A company missing a figure never passes a condition on it: a blank is not a zero.</p>
      </details>

      {error ? (
        <p role="alert" className="rounded-none border border-down/40 bg-down/10 px-3 py-2 text-sm">{error}</p>
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{data.matched}</span> of {data.universe} companies pass
            {data.formula ? <> <span className="font-mono">{data.formula}</span></> : " (no conditions)"}
            {data.matched > data.rows.length ? `; the first ${data.rows.length} by ${data.fields[sort]?.label.toLowerCase() ?? sort} are shown` : ""}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Company</th>
                  {COLUMNS.map((c) => {
                    const on = sort === c.key;
                    const next = on && order === "desc" ? "asc" : "desc";
                    return (
                      <th key={c.key} scope="col" aria-sort={on ? (order === "desc" ? "descending" : "ascending") : undefined} className="px-2 py-2 text-right font-medium">
                        <Link
                          href={href({ q: active ? undefined : q, preset: active ?? undefined, sort: c.key, order: next })}
                          className={cn("hover:text-foreground", on && "text-foreground")}
                        >
                          {SHORT[c.key]}
                          {on ? (order === "desc" ? " ↓" : " ↑") : ""}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/60 hover:bg-surface-muted">
                    <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                      <Link href={`/company/${r.symbol}`} className="font-mono text-xs font-semibold underline decoration-border underline-offset-4 hover:decoration-gold">
                        {r.symbol}
                      </Link>
                      {r.unresolved ? <span className="ml-1 text-muted-foreground" title="A figure still disputed between sources">*</span> : null}
                      <span className="ml-2 text-xs text-muted-foreground">{r.sector}</span>
                    </th>
                    {COLUMNS.map((c) => {
                      const v = r[c.key];
                      return (
                        <td key={c.key} className={cn("px-2 py-1.5 text-right font-mono tabular-nums", typeof v !== "number" ? "text-muted-foreground" : c.tone ? deltaColor(v) : "")}>
                          {typeof v === "number" ? formatINR(v, c.digits) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Fundamentals are Arthdex&apos;s vetted figures, recorded per company
            {data.snapshotRange ? ` between ${data.snapshotRange.oldest} and ${data.snapshotRange.newest}` : ""} and refreshed weekly; P/E, P/B and yield
            use today&apos;s NSE price. Growth is the latest full year against the one before.
            {data.withUnresolved ? ` ${data.withUnresolved} result(s) marked * carry a figure the two sources still dispute.` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
