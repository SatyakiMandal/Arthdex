import { GlobalSentiment } from "@/components/macro/global-sentiment";
import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { CandlestickChart, TrendingDown, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MoversTable } from "@/components/market/movers-table";
import { DataCard } from "@/components/ui/data-card";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { FactorScreens } from "@/components/market/factor-screens";
import { WindowedMovers } from "@/components/market/windowed-movers";
import { MoversExplained } from "@/components/market/movers-explained";
import { ExportCsv } from "@/components/ui/export-csv";
import { InstitutionalFlows } from "@/components/market/institutional-flows";
import { SectorTreemap } from "@/components/market/sector-treemap";
import { SectorRotationRrg } from "@/components/market/sector-rotation-rrg";
import { SectionHead } from "@/components/ui/section-head";
import {
  getFactorScreens,
  getFlows,
  getIndices,
  getPulse,
  getMovers,
  getMoversExplained,
  getWindowedMovers,
  getSectorRotation,
} from "@/lib/api/endpoints";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Market Watch · Arthdex",
  description: "Live NSE top gainers and losers, index levels and market breadth.",
};

interface PageProps {
  searchParams: Promise<{ universe?: string; window?: string; price?: string }>;
}

const WINDOWS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const UNIVERSES = [
  { id: "gt20", label: "Above ₹20" },
  { id: "nifty50", label: "Nifty 50" },
  { id: "niftynext50", label: "Nifty Next 50" },
  { id: "banknifty", label: "Bank Nifty" },
  { id: "fo", label: "F&O" },
  { id: "all", label: "All" },
];

/** Price bands applied to the CMP of each mover. */
const PRICE_BANDS = [
  { id: "all", label: "All prices", test: () => true },
  { id: "penny", label: "< ₹50", test: (p: number) => p < 50 },
  { id: "small", label: "₹50–500", test: (p: number) => p >= 50 && p <= 500 },
  { id: "mid", label: "₹500–2,000", test: (p: number) => p > 500 && p <= 2000 },
  { id: "large", label: "> ₹2,000", test: (p: number) => p > 2000 },
];

export default async function MarketWatchPage({ searchParams }: PageProps) {
  const { universe: requested, window: requestedWindow, price: requestedPrice } = await searchParams;
  const band = PRICE_BANDS.find((b) => b.id === requestedPrice) ?? PRICE_BANDS[0];
  const href = (o: { universe?: string; window?: string; price?: string }) =>
    `/market-watch?universe=${o.universe ?? universe}&window=${o.window ?? activeWindow}&price=${o.price ?? band.id}`;
  const universe = UNIVERSES.some((u) => u.id === requested) ? requested! : "gt20";
  const universeLabel = UNIVERSES.find((u) => u.id === universe)?.label ?? universe;
  const activeWindow = WINDOWS.some((w) => w.id === requestedWindow) ? requestedWindow! : "daily";

  // Daily comes straight from NSE's live variation feed; weekly and monthly are
  // computed from index-constituent history, because NSE publishes daily only.
  const [gainers, losers, indices, windowed, factors, explainedUp, explainedDown, flows, pulse500, sectorRotation] =
    await Promise.all([
      getMovers("gainers", universe, band.id === "all" ? 15 : 50),
      getMovers("losers", universe, band.id === "all" ? 15 : 50),
      getIndices(),
      activeWindow === "daily" ? Promise.resolve(null) : getWindowedMovers(activeWindow),
      getFactorScreens("nifty100", 8),
      getMoversExplained("gainers", 8),
      getMoversExplained("losers", 8),
      getFlows(90),
      getPulse("nifty500"),
      getSectorRotation(),
    ]);

  // Advances and declines are reported per index constituent set
  const breadth = indices.ok
    ? indices.data.reduce(
        (acc, index) => ({
          advances: acc.advances + (index.advances || 0),
          declines: acc.declines + (index.declines || 0),
        }),
        { advances: 0, declines: 0 },
      )
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        {/* Bloomberg Top Command Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-lg sm:text-xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <CandlestickChart className="h-4 w-4 text-accent" />
              <span>Market Watch</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              NSE Movers, Sector Capital Rotation & Whole-Market Breadth
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {breadth && breadth.advances + breadth.declines > 0 ? (
              <div className="flex items-center gap-2 border border-border bg-surface px-2 py-0.5 text-2xs font-mono rounded-none">
                <span className="text-muted-foreground">Breadth:</span>
                <span className="text-up font-bold">▲ {breadth.advances} Adv</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-down font-bold">▼ {breadth.declines} Dec</span>
              </div>
            ) : null}
            {gainers.ok ? <FreshnessBadge meta={gainers.meta} /> : null}
            {gainers.ok && losers.ok ? (
              <ExportCsv
                filename={`arthdex-movers-${universe}`}
                header={["Direction", "Symbol", "Price", "Change %"]}
                rows={[
                  ...gainers.data.filter((r) => band.test(r.cmp)).map((r) => ["gainer", r.symbol, r.cmp, r.change.percent]),
                  ...losers.data.filter((r) => band.test(r.cmp)).map((r) => ["loser", r.symbol, r.cmp, r.change.percent]),
                ]}
              />
            ) : null}
          </div>
        </div>

        {/* Multi-Segment Bloomberg Filter Toolbar */}
        <div className="mt-2 border border-border bg-surface px-2.5 py-1.5 rounded-none flex flex-wrap items-center justify-between gap-2 text-2xs font-mono">
          {/* Universe Segment */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground mr-1">Universe:</span>
            {UNIVERSES.map((option) => (
              <a
                key={option.id}
                href={href({ universe: option.id })}
                className={cn(
                  "px-2 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                  option.id === universe
                    ? "border-accent bg-accent/15 text-accent font-bold"
                    : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {option.label}
              </a>
            ))}
          </div>

          {/* Window & Price Segments */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1">
              <span className="text-3xs uppercase tracking-wider text-muted-foreground mr-1">Window:</span>
              {WINDOWS.map((option) => (
                <a
                  key={option.id}
                  href={href({ window: option.id })}
                  className={cn(
                    "px-1.5 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                    option.id === activeWindow
                      ? "border-accent bg-accent text-accent-foreground font-bold"
                      : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </a>
              ))}
            </div>

            <div className="flex items-center gap-1 border-l border-border/70 pl-2.5">
              <span className="text-3xs uppercase tracking-wider text-muted-foreground mr-1">Price:</span>
              {PRICE_BANDS.map((option) => (
                <a
                  key={option.id}
                  href={href({ price: option.id })}
                  className={cn(
                    "px-1.5 py-0.5 text-2xs font-mono transition-colors rounded-none border",
                    option.id === band.id
                      ? "border-accent bg-accent/15 text-accent font-bold"
                      : "border-border/70 bg-surface-muted/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Top Movers Dual Grid */}
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <DataCard title="Top Gainers" subtitle={`Universe: ${universeLabel}`} icon={TrendingUp}>
            {gainers.ok ? (
              <div className="p-1">
                <MoversTable rows={gainers.data.filter((r) => band.test(r.cmp)).slice(0, 15)} tone="up" />
              </div>
            ) : (
              <div className="p-3">
                <DataUnavailable message={gainers.message} />
              </div>
            )}
          </DataCard>

          <DataCard title="Top Losers" subtitle={`Universe: ${universeLabel}`} icon={TrendingDown}>
            {losers.ok ? (
              <div className="p-1">
                <MoversTable rows={losers.data.filter((r) => band.test(r.cmp)).slice(0, 15)} tone="down" />
              </div>
            ) : (
              <div className="p-3">
                <DataUnavailable message={losers.message} />
              </div>
            )}
          </DataCard>
        </div>

        {/* Windowed Movers (if non-daily active) */}
        {activeWindow !== "daily" && windowed ? (
          <div className="mt-3">
            <WindowedMovers movers={windowed.data} />
            <p className="mt-1.5 text-2xs text-muted-foreground font-mono">
              {windowed.meta.note} Covering {windowed.data.universeCovered} constituents.
            </p>
          </div>
        ) : activeWindow !== "daily" ? (
          <div className="mt-3">
            <DataUnavailable
              title={`${activeWindow} window unavailable`}
              message="The universe screener could not be computed. Daily movers are still live above."
            />
          </div>
        ) : null}

        {/* Movers Explained */}
        {explainedUp.ok && explainedDown.ok ? (
          <div className="mt-3.5">
            <MoversExplained gainers={explainedUp.data} losers={explainedDown.data} />
          </div>
        ) : null}

        {/* Index Levels */}
        {indices.ok ? (
          <section className="mt-3.5 rounded-none border border-border bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider font-mono">Index Levels & Multiples</h2>
                <span className="text-2xs font-mono text-muted-foreground">NSE Official Benchmark Gauges</span>
              </div>
              <FreshnessBadge meta={indices.meta} />
            </header>

            <div className="overflow-x-auto p-1">
              <table className="data-table w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-2xs text-muted-foreground font-mono uppercase tracking-wider">
                    <th className="px-2.5 py-1.5 text-left font-medium">Index</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Level</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">% Chg</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">1M</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">1Y</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">P/E</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">52W High</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">52W Low</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.data.map((index) => (
                    <tr
                      key={index.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface-muted/80 transition-colors duration-150"
                    >
                      <td className="px-2.5 py-1.5 text-xs font-medium font-mono text-foreground">{index.name}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums font-medium">
                        {formatINR(index.level, 2)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-1.5 text-right font-mono tabular-nums",
                          deltaColor(index.change.percent),
                        )}
                      >
                        {formatPct(index.change.percent)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-1.5 text-right font-mono tabular-nums text-2xs",
                          deltaColor(index.oneMonthChangePct ?? 0),
                        )}
                      >
                        {index.oneMonthChangePct === null
                          ? "—"
                          : formatPct(index.oneMonthChangePct, 1)}
                      </td>
                      <td
                        className={cn(
                          "px-2.5 py-1.5 text-right font-mono tabular-nums text-2xs",
                          deltaColor(index.oneYearChangePct ?? 0),
                        )}
                      >
                        {index.oneYearChangePct === null
                          ? "—"
                          : formatPct(index.oneYearChangePct, 1)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground text-2xs">
                        {index.peRatio ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground text-2xs">
                        {index.high52w === null ? "—" : formatINR(index.high52w, 0)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-muted-foreground text-2xs">
                        {index.low52w === null ? "—" : formatINR(index.low52w, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-2xs">
              <PageStamp meta={indices.meta} />
              <SourceLine meta={indices.meta} />
            </div>
          </section>
        ) : null}

        {/* Sector Map */}
        {pulse500.ok ? (
          <section aria-labelledby="sector-map" className="mt-4">
            <SectionHead id="sector-map" title="Sector Map" note={`Nifty 500 today: ${pulse500.data.advances} up, ${pulse500.data.declines} down`} />
            <div className="mt-2.5">
              <SectorTreemap pulse={pulse500.data} />
            </div>
            <SourceLine meta={pulse500.meta} className="mt-1 text-2xs" />
          </section>
        ) : null}

        {/* Institutional Flows */}
        {flows ? (
          <section aria-labelledby="flows" className="mt-4">
            <SectionHead id="flows" title="Institutional Flows" note="Cash market FII / DII net turnover" />
            <div className="mt-2.5">
              <InstitutionalFlows flows={flows.data} />
            </div>
            <SourceLine meta={flows.meta} className="mt-1 text-2xs" />
          </section>
        ) : null}

        {/* Sector Rotation RRG */}
        <section id="sector-rotation" className="mt-4 rounded-none border border-border bg-card p-3 sm:p-4 shadow-sm scroll-mt-20">
          <SectionHead
            title="Sector Rotation (Relative Rotation Graph)"
            note="10 NSE sectors against Nifty 50 · 12-week trailing vectors"
          />
          <div className="mt-3">
            {sectorRotation && sectorRotation.ok ? (
              <>
                <SectorRotationRrg rotationData={sectorRotation.data} />
                <div className="mt-3 border-t border-border/40 pt-2 text-2xs">
                  <SourceLine meta={sectorRotation.meta} />
                </div>
              </>
            ) : (
              <DataUnavailable
                title="Sector Rotation (Relative Rotation Graph) unavailable"
                message={sectorRotation?.message ?? "Waiting for sectoral history feed"}
              />
            )}
          </div>
        </section>

        {/* Factor Screens */}
        {factors ? (
          <div className="mt-4">
            <FactorScreens screens={factors.data} />
            <div className="mt-1.5 text-2xs">
              <SourceLine meta={factors.meta} />
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <GlobalSentiment />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
