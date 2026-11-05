import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Flame, Gauge, Layers, Zap, ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CellBar } from "@/components/ui/cell-bar";
import { DeskAnalysis } from "@/components/ui/desk-analysis";
import { DataCard } from "@/components/ui/data-card";
import { DeliveryScanner } from "@/components/bhavcopy/delivery-scanner";
import { BhavcopyBrowser } from "@/components/market/bhavcopy-browser";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getBhavcopy, getBhavScanner } from "@/lib/api/endpoints";
import type { BhavRow } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "NSE Bhavcopy · Arthdex",
  description: "Market-wide delivery, breadth, volume anomalies and circuit moves from the NSE Bhavcopy.",
};

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-none border border-border/80 bg-surface px-3 py-2 font-mono">
      <p className="text-3xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-3xs text-muted-foreground font-sans">{hint}</p> : null}
    </div>
  );
}

function RowsTable({ rows, extra }: { rows: BhavRow[]; extra?: { label: string; render: (r: BhavRow) => React.ReactNode } }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-xs text-muted-foreground font-sans">Nothing met the criteria on this session.</p>;
  const maxTurn = Math.max(...rows.map((r) => r.turnoverCr ?? 0), 1);
  const maxChg = Math.max(...rows.map((r) => Math.abs(r.changePct ?? 0)), 1);
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="data-table data-table-sticky w-full min-w-[520px] border-collapse text-2xs font-mono">
        <thead className="text-3xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2.5 py-1.5 text-left font-medium">Scrip</th>
            <th className="px-2 py-1.5 text-right font-medium">Close</th>
            <th className="px-2 py-1.5 text-right font-medium">% Chg</th>
            <th className="px-2 py-1.5 text-right font-medium">Turnover ₹Cr</th>
            <th className="px-2 py-1.5 text-right font-medium">Deliv %</th>
            {extra ? <th className="px-2 py-1.5 text-right font-medium">{extra.label}</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={`${r.symbol}-${r.band ?? ""}`} className="border-b border-border/60 last:border-0 hover:bg-surface-muted transition-colors">
              <td className="px-2.5 py-1 cell-glow">
                <Link href={`/company/${r.symbol}`} className="font-mono text-2xs font-bold hover:text-accent flex items-center gap-1">
                  <span>{r.symbol}</span>
                  <ArrowUpRight className="h-2.5 w-2.5 opacity-60 text-muted-foreground" />
                </Link>
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums cell-glow text-foreground">
                {r.close == null ? "—" : `₹${formatINR(r.close)}`}
              </td>
              <td className="px-2 py-1 text-right cell-glow">
                <CellBar value={r.changePct} max={maxChg} tone={(r.changePct ?? 0) >= 0 ? "up" : "down"}>
                  <span className={cn("text-2xs font-mono tabular-nums font-semibold", r.changePct != null && deltaColor(r.changePct))}>
                    {r.changePct == null ? "—" : formatPct(r.changePct)}
                  </span>
                </CellBar>
              </td>
              <td className="px-2 py-1 text-right cell-glow text-foreground">
                <CellBar value={r.turnoverCr} max={maxTurn} tone="accent">
                  <span className="text-2xs font-mono tabular-nums">{r.turnoverCr == null ? "—" : formatINR(r.turnoverCr, 1)}</span>
                </CellBar>
              </td>
              <td className="px-2 py-1 text-right cell-glow">
                {r.deliveryPct == null ? "—" : (
                  <CellBar value={r.deliveryPct} max={100} tone={r.deliveryPct > 68 ? "accent" : "muted"} markers={[68]}>
                    <span className={cn("text-2xs font-mono tabular-nums", r.deliveryPct > 68 ? "text-accent font-bold" : "text-foreground")}>
                      {r.deliveryPct.toFixed(1)}%
                    </span>
                  </CellBar>
                )}
              </td>
              {extra ? <td className="px-2 py-1 text-right font-mono tabular-nums cell-glow text-foreground">{extra.render(r)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function BhavcopyPage({ searchParams }: PageProps) {
  const { date } = await searchParams;
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const [res, scannerRes] = await Promise.all([getBhavcopy(valid), getBhavScanner(valid)]);
  const maxDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-3">
        {/* Bloomberg Command Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              <span>NSE Bhavcopy &amp; Delivery Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-3xs font-mono text-muted-foreground uppercase tracking-wider">
              Settlement Absorption · Circuit Extremes · Volume Anomalies
            </span>
          </div>
          {/* A plain GET form, so the chosen date lives in the URL and works without client JS */}
          <form action="/bhavcopy" method="get" className="flex items-end gap-2">
            <label className="text-3xs font-mono text-muted-foreground uppercase">
              Trading date
              <input
                type="date"
                name="date"
                defaultValue={res.ok ? res.data.date : valid}
                max={maxDate}
                className="mt-1 block h-7 rounded-none border border-border/80 bg-surface px-2 font-mono text-xs"
              />
            </label>
            <button type="submit" className="h-7 rounded-none border border-border bg-surface px-2.5 text-xs font-semibold hover:bg-surface-muted transition-colors">
              Load
            </button>
          </form>
        </div>

        {/* Tactical Keyboard & Command HUD */}
        <KeyboardHud
          contextLabel="BHAVCOPY DESK · COMMAND HUD"
          shortcuts={[
            { key: "/", label: "Quick Filter Scrip", accent: true },
            { key: "↑ / ↓", label: "Select Scrip Row" },
            { key: "Enter", label: "Open Stock Dossier" },
            { key: "1-5", label: "Switch Quadrant Views" },
            { key: "G + D", label: "F&O Derivatives Desk" },
            { key: "Shift+C", label: "Ultra Pitch Contrast" },
            { key: "?", label: "All Hotkeys" },
          ]}
        />

        {!res.ok ? (
          <div className="mt-3">
            <DataUnavailable title="Bhavcopy unavailable" message={res.message} />
          </div>
        ) : (
          <>
            {/* Top KPI Metrics Bar */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Session Date" value={res.data.date} />
              <Kpi label="Traded Securities" value={formatINR(res.data.kpis.securities, 0)} />
              <Kpi
                label="Advance / Decline"
                value={
                  <>
                    <span className="text-up font-bold">{res.data.kpis.advances}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-down font-bold">{res.data.kpis.declines}</span>
                  </>
                }
                hint={res.data.kpis.advanceDeclineRatio != null ? `${res.data.kpis.advanceDeclineRatio.toFixed(2)}x ratio` : undefined}
              />
              <Kpi label="Market Turnover" value={`₹${formatINR(res.data.kpis.turnoverCr, 0)} Cr`} />
              <Kpi
                label="Delivery (weighted)"
                value={res.data.kpis.weightedDeliveryPct != null ? `${res.data.kpis.weightedDeliveryPct}%` : "—"}
                hint="of all traded shares"
              />
              <Kpi
                label="Delivery (simple avg)"
                value={res.data.kpis.averageDeliveryPct != null ? `${res.data.kpis.averageDeliveryPct}%` : "—"}
                hint="mean across stocks"
              />
            </div>

            {/* Whole-Market Physical Delivery vs Speculative Intraday Turnover Ratio Bar */}
            {res.data.kpis.weightedDeliveryPct != null ? (
              <div className="border border-border/80 bg-surface px-3 py-1.5 font-mono text-2xs rounded-none shadow-xs">
                <div className="flex items-center justify-between text-3xs uppercase tracking-wider text-muted-foreground pb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-accent rounded-none" />
                    <span>Market-Wide Settlement Absorption Gauge</span>
                  </span>
                  <span className="font-bold text-foreground">
                    <strong className="text-accent">{res.data.kpis.weightedDeliveryPct}% Delivery</strong> · {((100 - res.data.kpis.weightedDeliveryPct)).toFixed(1)}% Intraday
                  </span>
                </div>
                <div className="relative h-1.5 bg-muted/60 overflow-hidden" aria-hidden>
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(100, res.data.kpis.weightedDeliveryPct)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-[60%] w-0.5 bg-foreground" title="Institutional 60% Delivery Threshold" />
                </div>
              </div>
            ) : null}

            {/* Session Narrative Banner */}
            <p className="rounded-none border border-border/80 bg-surface px-3 py-2 text-xs text-muted-foreground font-sans">
              <span className="mr-2 font-mono text-3xs font-bold text-accent uppercase tracking-wider">Session Narrative</span>
              {res.data.narrative}
            </p>

            <DeskAnalysis insights={res.data.insights} title="Session analysis" className="mt-1" />

            {/* Interactive Ultra-Dense Bloomberg Bhavcopy Browser */}
            <BhavcopyBrowser
              accumulation={res.data.accumulation}
              volumeAnomalies={res.data.volumeAnomalies}
              bandMoves={res.data.bandMoves}
              criteria={res.data.criteria}
              tradeDate={res.data.date}
            />

            {/* Institutional Delivery & Volume Scanner */}
            {scannerRes.ok && (
              <section className="rounded-none border border-border/80 bg-card p-3 shadow-xs">
                <SectionHead
                  title="Institutional Delivery & Volume Scanner"
                  note="Delivery, volume surges, absorption and distribution"
                />
                <div className="mt-3">
                  <DeliveryScanner initialData={scannerRes.data} />
                  <div className="mt-3 border-t border-border/40 pt-2">
                    <SourceLine meta={scannerRes.meta} />
                  </div>
                </div>
              </section>
            )}

            {/* 4 Quadrant Data Cards */}
            <div className="grid gap-3 xl:grid-cols-2">
              <DataCard
                title="Institutional accumulation radar"
                subtitle={`Delivery above ${res.data.criteria.accumulationDeliveryPct}%, turnover of at least ₹${res.data.criteria.minTurnoverCr} Cr, ranked by turnover`}
                icon={Layers}
                footnote="High delivery means buyers took shares home rather than squaring off intraday. It is consistent with accumulation, but the file cannot say who the buyer was."
              >
                <RowsTable rows={res.data.accumulation} />
              </DataCard>

              <DataCard
                title="Volume anomalies"
                subtitle={`Traded quantity above ${res.data.criteria.anomalyVolumeMultiple}x its ${res.data.criteria.baselineSessions}-session average`}
                icon={Zap}
              >
                <RowsTable rows={res.data.volumeAnomalies} extra={{ label: "vs 5D avg", render: (r) => (r.volumeMultiple != null ? `${r.volumeMultiple.toFixed(1)}x` : "—") }} />
              </DataCard>

              <DataCard
                title="Upper-band closes"
                subtitle="Closed on the day's high at a 5%, 10% or 20% gain"
                icon={Flame}
                footnote="Inferred from move size and close-at-extreme; the file does not list each stock's price band."
              >
                <RowsTable rows={res.data.bandMoves.upper} extra={{ label: "Band", render: (r) => `${r.band}%` }} />
              </DataCard>

              <DataCard title="Lower-band closes" subtitle="Closed on the day's low at a 5%, 10% or 20% fall" icon={Gauge}>
                <RowsTable rows={res.data.bandMoves.lower} extra={{ label: "Band", render: (r) => `${r.band}%` }} />
              </DataCard>
            </div>

            <div className="flex items-center gap-2 text-3xs text-muted-foreground font-mono">
              <Activity className="h-3 w-3" />
              Equity (EQ) and trade-for-trade (BE) series only. Sector-wise averages are not shown: Bhavcopy carries no sector field.
            </div>
            <div>
              <PageStamp meta={res.meta} />
              <SourceLine meta={res.meta} />
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
