import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getResultsSeason } from "@/lib/api/endpoints";
import type { ApiReportedResult } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Results season · Arthdex",
  description: "The quarterly results season across the Nifty 500: who has reported, how revenue and profit compare with a year ago, and who reports next.",
};

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const growth = (v: number | null) => (v == null ? "—" : formatPct(v, 1));

const SORTS: { key: keyof ApiReportedResult; label: string }[] = [
  { key: "netProfit", label: "Profit" },
  { key: "profitGrowth", label: "Profit growth" },
  { key: "revenueGrowth", label: "Revenue growth" },
  { key: "marginChange", label: "Margin change" },
];

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const { sort = "netProfit" } = await searchParams;
  const res = await getResultsSeason();
  const key = (SORTS.find((s) => s.key === sort)?.key ?? "netProfit") as keyof ApiReportedResult;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <Eyebrow>Markets</Eyebrow>
        <h1 className="mt-4 text-balance text-4xl sm:text-5xl">Results season</h1>
        {!res.ok ? (
          <div className="mt-8">
            <DataUnavailable title="Results season unavailable" message={res.message} />
          </div>
        ) : (
          (() => {
            const d = res.data;
            const s = d.summary;
            const rows = [...d.reported].sort((a, b) => {
              const x = a[key] as number | null;
              const y = b[key] as number | null;
              return (y ?? -Infinity) - (x ?? -Infinity);
            });
            const ledger = [
              { label: "Reported so far", value: `${s.reported} of ${d.covered}` },
              { label: "Revenue up on a year ago", value: s.comparable ? `${s.revenueUp} of ${s.comparable}` : "—" },
              { label: "Profit up on a year ago", value: s.comparable ? `${s.profitUp} of ${s.comparable}` : "—" },
              { label: "Revenue growth, combined", value: growth(s.aggregateRevenueGrowth), tone: s.aggregateRevenueGrowth },
              { label: "Profit growth, combined", value: growth(s.aggregateProfitGrowth), tone: s.aggregateProfitGrowth },
              { label: "Median profit growth", value: growth(s.medianProfitGrowth), tone: s.medianProfitGrowth },
            ];
            return (
              <>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  {d.quarter ?? "The latest quarter"}
                  {d.season ? `, ended ${new Date(`${d.season}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}, across
                  the Nifty 500: each company&apos;s quarter against the same quarter a year before, from Arthdex&apos;s vetted figures.
                </p>

                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-6">
                  {ledger.map((l) => (
                    <div key={l.label} className="border-t border-border pt-3">
                      <dt className="text-xs text-muted-foreground">{l.label}</dt>
                      <dd className={cn("mt-1 font-mono text-[15px] font-medium tabular-nums", typeof l.tone === "number" && deltaColor(l.tone))}>{l.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
                  <section aria-labelledby="reported">
                    <SectionHead id="reported" title="Reported" note="₹ crore; growth against the same quarter a year ago" />
                    <nav aria-label="Sort" className="mt-4 flex flex-wrap gap-1.5 text-sm">
                      {SORTS.map((o) => (
                        <Link
                          key={o.key}
                          href={`/results?sort=${o.key}`}
                          aria-current={key === o.key ? "page" : undefined}
                          className={cn("rounded-md px-2.5 py-1", key === o.key ? "bg-surface-muted text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
                        >
                          {o.label}
                        </Link>
                      ))}
                    </nav>
                    {rows.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[760px] border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                              <th scope="col" className="py-2 pr-4 text-left font-medium">Company</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">Revenue</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">Growth</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">Net profit</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">Growth</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">EPS growth</th>
                              <th scope="col" className="px-2 py-2 text-right font-medium">Margin change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.symbol} className="border-b border-border/60 hover:bg-surface-muted">
                                <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                                  <Link href={`/company/${r.symbol}`} className="underline decoration-border underline-offset-4 hover:decoration-gold">{r.name}</Link>
                                  <span className="ml-2 font-mono text-xs text-muted-foreground">{r.symbol}</span>
                                  {r.unresolved ? <span className="ml-1 text-muted-foreground" title="A figure the two sources still dispute">*</span> : null}
                                </th>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.revenue != null ? formatINR(r.revenue, 0) : "—"}</td>
                                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", deltaColor(r.revenueGrowth ?? 0))}>{growth(r.revenueGrowth)}</td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums">{r.netProfit != null ? formatINR(r.netProfit, 0) : "—"}</td>
                                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", deltaColor(r.profitGrowth ?? 0))}>{growth(r.profitGrowth)}</td>
                                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", deltaColor(r.epsGrowth ?? 0))}>{growth(r.epsGrowth)}</td>
                                <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", deltaColor(r.marginChange ?? 0))}>
                                  {r.marginChange == null ? "—" : `${r.marginChange > 0 ? "+" : ""}${r.marginChange.toFixed(1)} pts`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">No company in the snapshot has reported this quarter yet.</p>
                    )}
                    <p className="mt-3 text-xs text-muted-foreground">
                      Combined growth adds up the {s.comparable} companies with a year-ago quarter on file and compares the totals. Each company&apos;s two
                      quarters come from one source, so growth compares like with like; across lenders, revenue is gross interest earned on one source and
                      net interest income on the other, so compare banks on growth rather than size. A dash means the year-ago quarter is not on file yet.
                    </p>
                  </section>

                  <section aria-labelledby="upcoming">
                    <SectionHead id="upcoming" title="Next to report" />
                    {d.awaitingFigures.length ? (
                      <p className="mt-4 text-xs text-muted-foreground">
                        {d.awaitingFigures.length} compan{d.awaitingFigures.length === 1 ? "y has" : "ies have"} held a results meeting whose figures are still being
                        recorded; they appear above within a few hours.
                      </p>
                    ) : null}
                    <ul className="mt-4 divide-y divide-border/60">
                      {d.upcoming.slice(0, 30).map((u) => (
                        <li key={u.symbol} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                          <Link href={`/company/${u.symbol}`} className="min-w-0 truncate hover:underline">{u.name}</Link>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{day(u.date)}</span>
                        </li>
                      ))}
                    </ul>
                    {!d.upcoming.length ? <p className="mt-4 text-sm text-muted-foreground">No results meetings scheduled in the snapshot set.</p> : null}
                  </section>
                </div>
                <SourceLine meta={res.meta} className="mt-8" />
              </>
            );
          })()
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
