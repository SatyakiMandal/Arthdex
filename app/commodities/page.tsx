import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DeskAnalysis } from "@/components/ui/desk-analysis";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getCommodities, getIndices } from "@/lib/api/endpoints";
import type { ApiCommodity } from "@/lib/api/types";
import { CellBar } from "@/components/ui/cell-bar";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Commodities & Metals · Arthdex",
  description: "Gold, silver, base metals, crude oil, natural gas and agricultural futures, with the Nifty Metal and Energy indices.",
};

const GROUPS = ["Precious metals", "Base metals", "Energy", "Agriculture"] as const;
const HORIZONS = ["1D", "1W", "1M", "3M", "1Y"] as const;

function Spark({ values, up }: { values: (number | null)[]; up: boolean }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(24 - ((x - lo) / (hi - lo || 1)) * 22 - 1).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-24" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "hsl(var(--up))" : "hsl(var(--down))"} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Chg({ v, max }: { v: number | null; max: number }) {
  return (
    <CellBar value={v} max={max} tone={(v ?? 0) >= 0 ? "up" : "down"} className="min-w-[4.5rem]">
      <span className={cn("text-xs", v != null && deltaColor(v))}>{v == null ? "—" : formatPct(v, 1)}</span>
    </CellBar>
  );
}

function Group({ title, rows }: { title: string; rows: ApiCommodity[] }) {
  if (rows.length === 0) return null;
  const maxByHorizon = Object.fromEntries(HORIZONS.map((h) => [h, Math.max(...rows.map((r) => Math.abs(r.change[h] ?? 0)), 1)])) as Record<(typeof HORIZONS)[number], number>;
  return (
    <section className="mt-6 rounded-xl border border-border bg-surface">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold tracking-tight">{title}</h2>
      <div className="overflow-x-auto">
        <table className="data-table w-full min-w-[900px] border-collapse text-sm">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Commodity</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              {HORIZONS.map((h) => (
                <th key={h} className="px-3 py-2 text-right font-medium">
                  {h}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium">1Y trend</th>
              <th className="px-3 py-2 text-left font-medium">52W range</th>
              <th className="px-3 py-2 text-left font-medium">What moves it</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pos = r.rangePosition;
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-2xs text-muted-foreground">{r.symbol}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatINR(r.price, r.price < 10 ? 3 : 2)} <span className="text-2xs text-muted-foreground">{r.unit}</span>
                  </td>
                  {HORIZONS.map((h) => (
                    <td key={h} className="px-3 py-2 text-right">
                      <Chg v={r.change[h]} max={maxByHorizon[h]} />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <Spark values={r.spark} up={(r.change["1Y"] ?? r.change["3M"] ?? 0) >= 0} />
                  </td>
                  <td className="px-3 py-2">
                    {pos == null ? (
                      "—"
                    ) : (
                      <div className="relative h-1 w-20 rounded-full bg-muted" title={`${formatINR(r.low52w ?? 0)} – ${formatINR(r.high52w ?? 0)}`}>
                        <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${pos * 100}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-2xs text-muted-foreground">{r.driver}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CommoditiesPage() {
  const [res, indices] = await Promise.all([getCommodities(), getIndices()]);
  const related = indices.ok ? indices.data.filter((i) => /METAL|ENERGY|OIL|COMMOD/i.test(i.name)) : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <Eyebrow icon={Coins}>Commodities</Eyebrow>
        <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Metals, energy &amp; agriculture</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The commodity prices that move Indian earnings and inflation, next to the Nifty indices that trade them.
        </p>

        {related.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {related.map((i) => (
              <div key={i.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">{i.name}</p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatINR(i.level)}</p>
                <p className={cn("font-mono text-xs", deltaColor(i.change.percent))}>{formatPct(i.change.percent)} today</p>
                <p className="mt-1 text-2xs text-muted-foreground">
                  1M {i.oneMonthChangePct == null ? "—" : formatPct(i.oneMonthChangePct, 1)} · 1Y {i.oneYearChangePct == null ? "—" : formatPct(i.oneYearChangePct, 1)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {res.ok ? (
          <>
            {res.data.usdinr ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span>
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground">USD / INR </span>
                  <span className="font-mono">{res.data.usdinr.toFixed(2)}</span>
                </span>
                {res.data.indicativeInr.goldPer10g ? (
                  <span>
                    <span className="text-2xs uppercase tracking-wider text-muted-foreground">Gold per 10 g </span>
                    <span className="font-mono">₹{formatINR(res.data.indicativeInr.goldPer10g, 0)}</span>
                  </span>
                ) : null}
                {res.data.indicativeInr.silverPerKg ? (
                  <span>
                    <span className="text-2xs uppercase tracking-wider text-muted-foreground">Silver per kg </span>
                    <span className="font-mono">₹{formatINR(res.data.indicativeInr.silverPerKg, 0)}</span>
                  </span>
                ) : null}
                <span className="text-2xs text-muted-foreground">Indicative: international price converted at spot, before import duty, GST and local premium.</span>
              </div>
            ) : null}
            <DeskAnalysis insights={res.data.insights} title="Commodity desk analysis" className="mt-4" />
            {GROUPS.map((g) => (
              <Group key={g} title={g} rows={res.data.rows.filter((r) => r.group === g)} />
            ))}
            <p className="mt-4 text-2xs text-muted-foreground">
              Front-month futures in US dollars, about 15 minutes delayed. These are international benchmarks, not MCX prices; Indian
              prices also move with the rupee, duties and local demand.
            </p>
            <div className="mt-2">
<PageStamp meta={res.meta} />
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="mt-8">
            <DataUnavailable title="Commodity prices unavailable" message={res.message} />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
