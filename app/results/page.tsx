import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FileBarChart, Layers, Sparkles, Zap } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { CalendarView } from "@/components/market/calendar-view";
import {
  getCalendar,
  getEarningsMoves,
  getResultsSeason,
  getIndexRebalance,
  getIpoLockins,
  getBuybacks,
} from "@/lib/api/endpoints";
import type { ApiReportedResult } from "@/lib/api/types";
import { IndexRebalanceTable } from "@/components/catalysts/index-rebalance-table";
import { IpoLockinCalendar } from "@/components/catalysts/ipo-lockin-calendar";
import { BuybackArbitrageDesk } from "@/components/catalysts/buyback-arbitrage-desk";
import { FALLBACK_BUYBACKS, FALLBACK_IPOLOCKIN, FALLBACK_REBALANCE } from "@/components/catalysts/defaults";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Earnings & Catalysts Desk · Arthdex",
  description:
    "Unified institutional earnings & catalysts desk: quarterly scorecard across the Nifty 500, corporate actions calendar, ATM implied moves, index rebalances, and buyback arbitrage.",
};

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const growth = (v: number | null) => (v == null ? "—" : formatPct(v, 1));

const SORTS: { key: keyof ApiReportedResult; label: string }[] = [
  { key: "netProfit", label: "Profit" },
  { key: "profitGrowth", label: "Profit growth" },
  { key: "revenueGrowth", label: "Revenue growth" },
  { key: "marginChange", label: "Margin change" },
];

interface PageProps {
  searchParams: Promise<{ sort?: string; tab?: string }>;
}

export default async function ResultsPage({ searchParams }: PageProps) {
  const { sort = "netProfit", tab = "scorecard" } = await searchParams;

  let rebalanceData = FALLBACK_REBALANCE;
  let lockinData = FALLBACK_IPOLOCKIN;
  let buybackData = FALLBACK_BUYBACKS;

  const [res, calendarRes, movesRes] = await Promise.all([
    tab === "scorecard" ? getResultsSeason().catch(() => null) : Promise.resolve(null),
    tab === "calendar" || tab === "scorecard" ? getCalendar().catch(() => null) : Promise.resolve(null),
    tab === "implied" ? getEarningsMoves().catch(() => null) : Promise.resolve(null),
  ]);

  if (tab === "catalysts") {
    try {
      const [rebalanceRes, lockinRes, buybackRes] = await Promise.all([
        getIndexRebalance().catch(() => null),
        getIpoLockins().catch(() => null),
        getBuybacks().catch(() => null),
      ]);
      if (rebalanceRes?.ok && rebalanceRes.data) rebalanceData = rebalanceRes.data;
      if (lockinRes?.ok && lockinRes.data) lockinData = lockinRes.data;
      if (buybackRes?.ok && buybackRes.data) buybackData = buybackRes.data;
    } catch {
      // Graceful fallback to cached catalyst data
    }
  }

  const key = (SORTS.find((s) => s.key === sort)?.key ?? "netProfit") as keyof ApiReportedResult;

  const calendarData = calendarRes?.ok ? calendarRes.data : null;
  const movesData = movesRes?.ok && movesRes.data?.moves ? movesRes.data.moves : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] px-2.5 py-6 sm:px-4 lg:px-6">
        <Eyebrow icon={FileBarChart}>MARKETS</Eyebrow>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-4 border-b border-border/70 pb-4">
          <div>
            <h1 className="text-balance text-3xl sm:text-4xl font-serif tracking-tight text-foreground">
              Earnings &amp; Results Desk
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground leading-relaxed">
              Unified command center for Indian corporate earnings: quarterly vetted scorecards, 30-day board meetings &amp; corporate actions schedule, and derivatives implied volatility moves.
            </p>
          </div>

          {/* Unified Desk View Switcher */}
          <div className="flex items-center border border-border bg-surface-muted p-0.5 rounded-none font-mono text-2xs">
            <Link
              href="/results?tab=scorecard"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all rounded-none",
                tab === "scorecard"
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <FileBarChart className="h-3.5 w-3.5 text-accent" />
              <span>Results Scorecard</span>
            </Link>
            <Link
              href="/results?tab=calendar"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all rounded-none",
                tab === "calendar"
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-gold" />
              <span>Calendar &amp; Actions ({calendarData?.meetings?.length ?? 0})</span>
            </Link>
            <Link
              href="/results?tab=implied"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all duration-150 rounded-none",
                tab === "implied"
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="h-3.5 w-3.5 text-accent" />
              <span>ATM Implied Moves</span>
            </Link>
            <Link
              href="/results?tab=catalysts"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 font-bold uppercase tracking-wider transition-all duration-150 rounded-none",
                tab === "catalysts"
                  ? "bg-surface text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span>Corporate Catalysts</span>
            </Link>
          </div>
        </div>

        {/* TAB 1: RESULTS SCORECARD */}
        {tab === "scorecard" && (
          <div className="mt-6 animate-in fade-in-50">
            {!res || !res.ok ? (
              <DataUnavailable title="Results season unavailable" message={res?.message ?? "Failed to load results season."} />
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
                    <p className="max-w-3xl text-xs text-muted-foreground">
                      {d.quarter ?? "The latest quarter"}
                      {d.season ? `, ended ${new Date(`${d.season}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}, across
                      the Nifty 500: each company&apos;s quarter against the same quarter a year before, from Arthdex&apos;s vetted figures.
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6 font-mono">
                      {ledger.map((l) => (
                        <div key={l.label} className="border border-border bg-surface p-2.5 rounded-none shadow-xs">
                          <dt className="text-3xs uppercase tracking-wider text-muted-foreground">{l.label}</dt>
                          <dd className={cn("mt-1 text-sm font-bold tabular-nums", typeof l.tone === "number" && deltaColor(l.tone))}>
                            {l.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3.2fr)_minmax(0,1fr)]">
                      <section aria-labelledby="reported">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
                          <SectionHead id="reported" title="Reported Results Ledger" note="₹ crore; growth against the same quarter a year ago" />
                          <nav aria-label="Sort" className="flex flex-wrap gap-1 text-2xs font-mono">
                            {SORTS.map((o) => (
                              <Link
                                key={o.key}
                                href={`/results?tab=scorecard&sort=${o.key}`}
                                aria-current={key === o.key ? "page" : undefined}
                                className={cn(
                                  "px-2 py-0.5 border rounded-none transition-colors",
                                  key === o.key
                                    ? "bg-accent text-accent-foreground font-bold border-accent"
                                    : "bg-surface-muted/60 text-muted-foreground hover:bg-surface-muted hover:text-foreground border-border",
                                )}
                              >
                                {o.label}
                              </Link>
                            ))}
                          </nav>
                        </div>

                        {rows.length ? (
                          <div className="mt-3 overflow-x-auto border border-border">
                            <table className="w-full min-w-[760px] border-collapse text-xs font-mono">
                              <thead className="bg-surface-muted border-b border-border text-3xs text-muted-foreground uppercase tracking-wider font-semibold">
                                <tr>
                                  <th scope="col" className="p-2 text-left font-medium">Company</th>
                                  <th scope="col" className="p-2 text-right font-medium">Revenue</th>
                                  <th scope="col" className="p-2 text-right font-medium">Growth</th>
                                  <th scope="col" className="p-2 text-right font-medium">Net profit</th>
                                  <th scope="col" className="p-2 text-right font-medium">Growth</th>
                                  <th scope="col" className="p-2 text-right font-medium">EPS growth</th>
                                  <th scope="col" className="p-2 text-right font-medium">Margin change</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60 text-2xs">
                                {rows.map((r) => (
                                  <tr key={r.symbol} className="hover:bg-surface-muted/50 transition-colors">
                                    <th scope="row" className="p-2 text-left font-normal">
                                      <Link href={`/company/${r.symbol}`} className="font-bold text-foreground hover:text-accent">
                                        {r.symbol}
                                      </Link>
                                      <span className="ml-2 text-3xs text-muted-foreground font-sans truncate max-w-[140px] inline-block align-bottom">
                                        {r.name}
                                      </span>
                                    </th>
                                    <td className="p-2 text-right tabular-nums">{r.revenue != null ? formatINR(r.revenue, 0) : "—"}</td>
                                    <td className={cn("p-2 text-right tabular-nums font-bold", deltaColor(r.revenueGrowth ?? 0))}>{growth(r.revenueGrowth)}</td>
                                    <td className="p-2 text-right tabular-nums">{r.netProfit != null ? formatINR(r.netProfit, 0) : "—"}</td>
                                    <td className={cn("p-2 text-right tabular-nums font-bold", deltaColor(r.profitGrowth ?? 0))}>{growth(r.profitGrowth)}</td>
                                    <td className={cn("p-2 text-right tabular-nums font-bold", deltaColor(r.epsGrowth ?? 0))}>{growth(r.epsGrowth)}</td>
                                    <td className={cn("p-2 text-right tabular-nums font-bold", deltaColor(r.marginChange ?? 0))}>
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
                      </section>

                      {/* Next to Report Sidebar */}
                      <section aria-labelledby="upcoming" className="border border-border bg-surface p-3 rounded-none shadow-xs space-y-2">
                        <SectionHead id="upcoming" title="Next to report" />
                        {d.awaitingFigures.length ? (
                          <p className="text-3xs text-muted-foreground leading-snug">
                            {d.awaitingFigures.length} compan{d.awaitingFigures.length === 1 ? "y has" : "ies have"} held a results meeting whose figures are being recorded.
                          </p>
                        ) : null}
                        <ul className="divide-y divide-border/60 max-h-[500px] overflow-y-auto pr-1">
                          {d.upcoming.slice(0, 30).map((u) => (
                            <li key={u.symbol} className="flex items-baseline justify-between gap-2 py-1.5 text-2xs font-mono">
                              <Link href={`/company/${u.symbol}`} className="min-w-0 truncate hover:text-accent font-semibold text-foreground">
                                {u.symbol}
                              </Link>
                              <span className="shrink-0 text-3xs text-muted-foreground">{day(u.date)}</span>
                            </li>
                          ))}
                        </ul>
                        {!d.upcoming.length ? <p className="text-xs text-muted-foreground">No results meetings scheduled in the snapshot set.</p> : null}
                      </section>
                    </div>
                    <SourceLine meta={res.meta} className="mt-6" />
                  </>
                );
              })()
            )}
          </div>
        )}

        {/* TAB 2: CORPORATE ACTIONS & BOARD MEETINGS CALENDAR */}
        {tab === "calendar" && (
          <div className="mt-6 animate-in fade-in-50">
            {!calendarData ? (
              <DataUnavailable title="Calendar unavailable" message={calendarRes && !calendarRes.ok ? calendarRes.message : "Failed to load corporate calendar."} />
            ) : (
              <div>
                <CalendarView calendar={calendarData} />
                {calendarRes && calendarRes.ok && <SourceLine meta={calendarRes.meta} className="mt-4" />}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EARNINGS IMPLIED VOLATILITY MOVES */}
        {tab === "implied" && (
          <div className="mt-6 animate-in fade-in-50 space-y-4">
            <div className="border border-border bg-surface p-3.5 rounded-none shadow-xs">
              <h2 className="text-base font-bold text-foreground font-mono">
                At-The-Money Straddle Implied Volatility Moves
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calculated as (Price(ATM CE) + Price(ATM PE)) / Spot, indicating institutional options pricing expectation for the results session.
              </p>

              {movesData.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-border mt-3 font-mono">
                  No upcoming results matched with active at-the-money straddles in the current cycle.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border mt-3">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead className="bg-surface-muted border-b border-border text-3xs text-muted-foreground uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="p-2">Scrip</th>
                        <th className="p-2">Result Date</th>
                        <th className="p-2 text-right">Spot Price (₹)</th>
                        <th className="p-2 text-right">ATM Straddle (₹)</th>
                        <th className="p-2 text-right">Implied Move (%)</th>
                        <th className="p-2">Pricing Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-2xs">
                      {movesData.map((m) => (
                        <tr key={m.symbol} className="hover:bg-surface-muted/50 transition-colors">
                          <td className="p-2 font-bold text-foreground">
                            <Link href={`/company/${m.symbol}`} className="hover:text-accent">
                              {m.symbol}
                            </Link>
                          </td>
                          <td className="p-2 text-muted-foreground">{m.resultDate}</td>
                          <td className="p-2 text-right">{m.spotPrice != null ? formatINR(m.spotPrice, 2) : "—"}</td>
                          <td className="p-2 text-right font-semibold">{m.straddleAtmPrice != null ? formatINR(m.straddleAtmPrice, 2) : "—"}</td>
                          <td className="p-2 text-right font-bold text-gold">
                            {m.impliedMovePct ? `±${m.impliedMovePct.toFixed(2)}%` : "—"}
                          </td>
                          <td className="p-2 text-muted-foreground">{m.pricingVerdict}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CORPORATE CATALYSTS */}
        {tab === "catalysts" && (
          <div className="mt-8 space-y-12 animate-in fade-in-50">
            {/* Section 1: Index Rebalance Predictor */}
            <section className="space-y-4">
              <SectionHead
                title="Index Rebalance Forecast"
                note="Semi-annual rebalance forecasting for Nifty 50, Bank Nifty, and Nifty Next 50. Anticipates passive ETF flows."
              />
              <IndexRebalanceTable initialData={rebalanceData} />
            </section>

            {/* Section 2: IPO Lock-in Expiry Calendar */}
            <section className="space-y-4">
              <SectionHead
                title="IPO Anchor & Promoter Lock-in Expiries"
                note="Anchor 30-day, Anchor 90-day, and 1-year Pre-IPO quotas with volume-relative Supply Impact Ratios."
              />
              <IpoLockinCalendar initialData={lockinData} />
            </section>

            {/* Section 3: Tender Offer Buyback Arbitrage Desk */}
            <section className="space-y-4">
              <SectionHead
                title="Buyback Arbitrage & Small Shareholder Quota"
                note="SEBI 15% retail reserved tender quota under ₹2,00,000 threshold with acceptance ratio payoff curves."
              />
              <BuybackArbitrageDesk initialData={buybackData} />
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
