import Link from "next/link";
import type { ApiFundamentalScreen } from "@/lib/api/types";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import { Proximity52WGauge } from "@/components/screener/proximity-52w-gauge";

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
  price: "Price",
  change: "Today",
  mcap: "Mkt cap (Cr)",
  pe: "P/E",
  pb: "P/B",
  roe: "ROE %",
  roce: "ROCE %",
  de: "D/E",
  revgrowth: "Rev. grw %",
  profitgrowth: "Pft. grw %",
  opm: "OPM %",
  divyield: "Yield %",
};

const QUICK_TOKENS = [
  { label: "⚡ 52W Coiling (Quality)", q: "roe > 18 AND de < 0.5 AND pe < 30" },
  { label: "P/E < 15 & ROE > 18%", q: "pe < 15 AND roe > 18" },
  { label: "Low Debt (D/E < 0.3)", q: "de < 0.3 AND roe > 15" },
  { label: "High Margin (OPM > 25%)", q: "opm > 25 AND profitgrowth > 15" },
  { label: "Dividend Play (Yield > 2%)", q: "divyield > 2 AND pe < 20" },
];

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
    <div className="space-y-3">
      {/* Ready-made presets toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface px-2.5 py-1.5 rounded-none text-2xs font-mono">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-3xs uppercase tracking-wider text-muted-foreground mr-1">Presets:</span>
          {Object.entries(presets).map(([id, p]) => (
            <Link
              key={id}
              href={href({ preset: id })}
              aria-current={active === id ? "page" : undefined}
              className={cn(
                "rounded-none border px-2 py-0.5 text-2xs font-mono transition-colors",
                active === id
                  ? "border-accent bg-accent/15 text-accent font-bold"
                  : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Formula Input & Quick Tokens */}
      <div className="space-y-1.5 border border-border bg-surface p-2.5 rounded-none">
        <form action="/screener#fundamental" className="flex flex-wrap items-center gap-2">
          <label htmlFor="formula" className="sr-only">Screen formula</label>
          <div className="flex-1 flex items-center border border-border bg-background px-2.5 py-1 focus-within:border-accent">
            <span className="text-3xs font-mono uppercase tracking-wider text-muted-foreground mr-2 shrink-0">WHERE</span>
            <input
              id="formula"
              name="q"
              defaultValue={formula}
              placeholder="pe < 20 AND roe > 18 AND de < 0.5"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button type="submit" className="rounded-none border border-accent bg-accent/15 hover:bg-accent/25 text-accent px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider transition-colors">
            Execute Filter
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-2xs font-mono">
          <span className="text-3xs uppercase tracking-wider text-muted-foreground">Quick Queries:</span>
          {QUICK_TOKENS.map((token) => (
            <Link
              key={token.label}
              href={href({ q: token.q })}
              className="rounded-none border border-border/70 bg-surface-muted/40 px-1.5 py-0.5 text-3xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {token.label}
            </Link>
          ))}
        </div>
      </div>

      <details className="text-2xs text-muted-foreground font-mono">
        <summary className="cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground">
          Available Fields & Query Operators
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 border border-border bg-surface-muted/30 p-2.5 rounded-none">
          {Object.entries(data?.fields ?? {}).map(([key, f]) => (
            <div key={key} className="flex gap-2 text-2xs">
              <dt className="w-20 shrink-0 font-mono text-accent">{key}</dt>
              <dd className="truncate text-muted-foreground">
                {f.label} ({f.unit})
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {error ? (
        <p role="alert" className="rounded-none border border-down/40 bg-down/10 px-3 py-1.5 font-mono text-xs text-down">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground pt-1 border-t border-border/40">
            <span>
              <strong className="text-foreground">{data.matched}</strong> of {data.universe} tickers qualify
              {data.formula ? <> on <code className="text-accent">{data.formula}</code></> : " (no filter applied)"}
            </span>
            {data.matched > data.rows.length ? (
              <span>Showing top {data.rows.length} sorted by {data.fields[sort]?.label ?? sort}</span>
            ) : null}
          </div>

          <div className="overflow-x-auto border border-border bg-surface">
            <table className="w-full min-w-[1240px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">#</th>
                  <th scope="col" className="px-2.5 py-1.5 text-left font-medium min-w-[140px]">Company</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">Today</th>
                  <th scope="col" className="px-2 py-1.5 text-center font-medium min-w-[115px]">52W Proximity</th>
                  {COLUMNS.slice(2).map((c) => {
                    const on = sort === c.key;
                    const next = on && order === "desc" ? "asc" : "desc";
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={on ? (order === "desc" ? "descending" : "ascending") : undefined}
                        className="px-2 py-1.5 text-right font-medium"
                      >
                        <Link
                          href={href({ q: active ? undefined : q, preset: active ?? undefined, sort: c.key, order: next })}
                          className={cn("hover:text-foreground transition-colors", on && "text-accent font-bold")}
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
                {data.rows.map((r, idx) => {
                  const price = Number(r.price ?? 0);
                  const change = typeof r.change === "number" ? r.change : null;
                  const high52 = typeof r.high52w === "number" ? r.high52w : null;
                  const low52 = typeof r.low52w === "number" ? r.low52w : null;

                  return (
                    <tr
                      key={r.symbol}
                      className="border-b border-border/40 last:border-0 hover:bg-surface-muted/80 transition-colors duration-150"
                    >
                      <td className="px-2 py-1 text-2xs font-mono text-muted-foreground/60 cell-glow">{idx + 1}</td>
                      <th scope="row" className="px-2.5 py-1 text-left font-normal cell-glow">
                        <Link
                          href={`/company/${r.symbol}`}
                          className="font-mono text-xs font-semibold text-foreground hover:text-accent transition-colors"
                        >
                          {r.symbol}
                        </Link>
                        {r.unresolved ? (
                          <span className="ml-1 text-muted-foreground" title="A figure still disputed between sources">*</span>
                        ) : null}
                        <span className="ml-2 text-2xs font-sans text-muted-foreground truncate">{r.sector}</span>
                      </th>
                      <td className="px-2 py-1 text-right font-mono tabular-nums text-xs font-semibold text-foreground cell-glow">
                        {price > 0 ? formatINR(price, 2) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right font-mono tabular-nums text-xs cell-glow",
                          change !== null ? deltaColor(change) : "text-muted-foreground",
                        )}
                      >
                        {change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-2 py-1">
                        <Proximity52WGauge price={price} high52w={high52} low52w={low52} />
                      </td>
                      {COLUMNS.slice(2).map((c) => {
                        const v = r[c.key];
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "px-2 py-1 text-right font-mono tabular-nums text-xs cell-glow",
                              typeof v !== "number" ? "text-muted-foreground/60 text-2xs" : c.tone ? deltaColor(v) : "text-foreground", "cell-glow",
                            )}
                          >
                            {typeof v === "number" ? formatINR(v, c.digits) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-3xs font-mono text-muted-foreground pt-1">
            Official figures from filings & NSE tick multiples. 52W Proximity shows position in annual cycle with gold breakout indicators.
            {data.withUnresolved ? ` ${data.withUnresolved} ticker(s) marked * carry figures under dual-source audit.` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
