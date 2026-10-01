import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { CandlestickChart, TrendingDown, TrendingUp } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MoversTable } from "@/components/market/movers-table";
import { DataCard } from "@/components/ui/data-card";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { FactorScreens } from "@/components/market/factor-screens";
import { WindowedMovers } from "@/components/market/windowed-movers";
import { MoversExplained } from "@/components/market/movers-explained";
import { ExportCsv } from "@/components/ui/export-csv";
import { getFactorScreens, getIndices, getMovers, getMoversExplained, getWindowedMovers } from "@/lib/api/endpoints";
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
  { id: "penny", label: "Penny < ₹50", test: (p: number) => p < 50 },
  { id: "small", label: "₹50 – 500", test: (p: number) => p >= 50 && p <= 500 },
  { id: "mid", label: "₹500 – 2,000", test: (p: number) => p > 500 && p <= 2000 },
  { id: "large", label: "Above ₹2,000", test: (p: number) => p > 2000 },
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
  const [gainers, losers, indices, windowed, factors, explainedUp, explainedDown] = await Promise.all([
    getMovers("gainers", universe, band.id === "all" ? 15 : 50),
    getMovers("losers", universe, band.id === "all" ? 15 : 50),
    getIndices(),
    activeWindow === "daily" ? Promise.resolve(null) : getWindowedMovers(activeWindow),
    getFactorScreens("nifty100", 8),
    getMoversExplained("gainers", 8),
    getMoversExplained("losers", 8),
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

      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={CandlestickChart}>Market watch</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Top gainers &amp; losers
            </h1>
            <p className="mt-3 text-muted-foreground">
              Live NSE variation lists. Rights entitlements are excluded, since they are not
              shares in the company.
            </p>
          </div>
          {gainers.ok ? <FreshnessBadge meta={gainers.meta} /> : null}
        </div>

        {/* Links rather than state, so the chosen universe is shareable and survives reload */}
        <nav className="mt-6 flex flex-wrap gap-1.5">
          {UNIVERSES.map((option) => (
            <a
              key={option.id}
              href={href({ universe: option.id })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                option.id === universe
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </a>
          ))}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">Window</span>
          {WINDOWS.map((option) => (
            <a
              key={option.id}
              href={href({ window: option.id })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                option.id === activeWindow
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </a>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">Price</span>
          {PRICE_BANDS.map((option) => (
            <a
              key={option.id}
              href={href({ price: option.id })}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                option.id === band.id
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </a>
          ))}
        </div>

        {breadth && breadth.advances + breadth.declines > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              Index constituent breadth
            </span>
            <span className="font-mono text-sm">
              <span className="text-up">{breadth.advances} advancing</span>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-down">{breadth.declines} declining</span>
            </span>
          </div>
        ) : null}

        {activeWindow !== "daily" && windowed ? (
          <div className="mt-6">
            <WindowedMovers movers={windowed.data} />
            <p className="mt-2 text-2xs text-muted-foreground">
              {windowed.meta.note} Covering {windowed.data.universeCovered} constituents.
            </p>
          </div>
        ) : activeWindow !== "daily" ? (
          <div className="mt-6">
            <DataUnavailable
              title={`${activeWindow} window unavailable`}
              message="The universe screener could not be computed. Daily movers are still live below."
            />
          </div>
        ) : null}

        {gainers.ok && losers.ok ? (
          <div className="mt-6 flex justify-end">
            <ExportCsv
              filename={`arthdex-movers-${universe}`}
              header={["Direction", "Symbol", "Price", "Change %"]}
              rows={[
                ...gainers.data.filter((r) => band.test(r.cmp)).map((r) => ["gainer", r.symbol, r.cmp, r.change.percent]),
                ...losers.data.filter((r) => band.test(r.cmp)).map((r) => ["loser", r.symbol, r.cmp, r.change.percent]),
              ]}
            />
          </div>
        ) : null}

        <div className={cn("grid gap-4 xl:grid-cols-2", activeWindow === "daily" ? "mt-3" : "mt-4")}>
          <DataCard title="Top Gainers" subtitle={`Universe: ${universeLabel}`} icon={TrendingUp}>
            {gainers.ok ? (
              <div className="p-2">
                <MoversTable rows={gainers.data.filter((r) => band.test(r.cmp)).slice(0, 15)} tone="up" />
              </div>
            ) : (
              <div className="p-4">
                <DataUnavailable message={gainers.message} />
              </div>
            )}
          </DataCard>

          <DataCard title="Top Losers" subtitle={`Universe: ${universeLabel}`} icon={TrendingDown}>
            {losers.ok ? (
              <div className="p-2">
                <MoversTable rows={losers.data.filter((r) => band.test(r.cmp)).slice(0, 15)} tone="down" />
              </div>
            ) : (
              <div className="p-4">
                <DataUnavailable message={losers.message} />
              </div>
            )}
          </DataCard>
        </div>

        {explainedUp.ok && explainedDown.ok ? (
          <div className="mt-6">
            <MoversExplained gainers={explainedUp.data} losers={explainedDown.data} />
          </div>
        ) : null}

        {indices.ok ? (
          <section className="mt-6 rounded-xl border border-border bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Index Levels</h2>
              <FreshnessBadge meta={indices.meta} />
            </header>

            <div className="overflow-x-auto p-2">
              <table className="data-table w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Index</th>
                    <th className="px-3 py-2 text-right font-medium">Level</th>
                    <th className="px-3 py-2 text-right font-medium">% Chg</th>
                    <th className="px-3 py-2 text-right font-medium">1M</th>
                    <th className="px-3 py-2 text-right font-medium">1Y</th>
                    <th className="px-3 py-2 text-right font-medium">P/E</th>
                    <th className="px-3 py-2 text-right font-medium">52W High</th>
                    <th className="px-3 py-2 text-right font-medium">52W Low</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.data.map((index) => (
                    <tr
                      key={index.id}
                      className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                    >
                      <td className="px-3 py-2 text-xs font-medium">{index.name}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {formatINR(index.level, 2)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono tabular-nums",
                          deltaColor(index.change.percent),
                        )}
                      >
                        {formatPct(index.change.percent)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono tabular-nums",
                          deltaColor(index.oneMonthChangePct ?? 0),
                        )}
                      >
                        {index.oneMonthChangePct === null
                          ? "—"
                          : formatPct(index.oneMonthChangePct, 1)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-mono tabular-nums",
                          deltaColor(index.oneYearChangePct ?? 0),
                        )}
                      >
                        {index.oneYearChangePct === null
                          ? "—"
                          : formatPct(index.oneYearChangePct, 1)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {index.peRatio ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {index.high52w === null ? "—" : formatINR(index.high52w, 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        {index.low52w === null ? "—" : formatINR(index.low52w, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-border px-4 py-2">
<PageStamp meta={indices.meta} />
              <SourceLine meta={indices.meta} />
            </div>
          </section>
        ) : null}

        {factors ? (
          <div className="mt-6">
            <FactorScreens screens={factors.data} />
            <div className="mt-2">
              <SourceLine meta={factors.meta} />
            </div>
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
