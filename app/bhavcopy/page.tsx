import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Flame, Gauge, Layers, Zap } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CellBar } from "@/components/ui/cell-bar";
import { DeskAnalysis } from "@/components/ui/desk-analysis";
import { DataCard } from "@/components/ui/data-card";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getBhavcopy } from "@/lib/api/endpoints";
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
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RowsTable({ rows, extra }: { rows: BhavRow[]; extra?: { label: string; render: (r: BhavRow) => React.ReactNode } }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-sm text-muted-foreground">Nothing met the criteria on this session.</p>;
  const maxTurn = Math.max(...rows.map((r) => r.turnoverCr ?? 0), 1);
  const maxChg = Math.max(...rows.map((r) => Math.abs(r.changePct ?? 0)), 1);
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="data-table data-table-sticky w-full min-w-[520px] border-collapse text-sm">
        <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-medium">Scrip</th>
            <th className="px-3 py-2 text-right font-medium">Close</th>
            <th className="px-3 py-2 text-right font-medium">% Chg</th>
            <th className="px-3 py-2 text-right font-medium">Turnover ₹Cr</th>
            <th className="px-3 py-2 text-right font-medium">Deliv %</th>
            {extra ? <th className="px-3 py-2 text-right font-medium">{extra.label}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.symbol}-${r.band ?? ""}`} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
              <td className="px-3 py-2">
                <Link href={`/company/${r.symbol}`} className="font-mono text-xs font-semibold hover:text-accent">
                  {r.symbol}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{r.close == null ? "—" : formatINR(r.close)}</td>
              <td className="px-3 py-1 text-right">
                <CellBar value={r.changePct} max={maxChg} tone={(r.changePct ?? 0) >= 0 ? "up" : "down"}>
                  <span className={cn("text-xs", r.changePct != null && deltaColor(r.changePct))}>{r.changePct == null ? "—" : formatPct(r.changePct)}</span>
                </CellBar>
              </td>
              <td className="px-3 py-1 text-right">
                <CellBar value={r.turnoverCr} max={maxTurn} tone="accent">
                  <span className="text-xs">{r.turnoverCr == null ? "—" : formatINR(r.turnoverCr, 1)}</span>
                </CellBar>
              </td>
              <td className="px-3 py-1 text-right">
                {r.deliveryPct == null ? "—" : (
                  <CellBar value={r.deliveryPct} max={100} tone={r.deliveryPct > 68 ? "accent" : "muted"} markers={[68]}>
                    <span className={cn("text-xs", r.deliveryPct > 68 && "text-accent")}>{r.deliveryPct.toFixed(1)}%</span>
                  </CellBar>
                )}
              </td>
              {extra ? <td className="px-3 py-2 text-right font-mono tabular-nums">{extra.render(r)}</td> : null}
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
  const res = await getBhavcopy(valid);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Layers}>NSE Bhavcopy</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Delivery &amp; breadth</h1>
            <p className="mt-3 text-muted-foreground">
              What the whole market did on one session: breadth, turnover, how much of it was taken into delivery, and
              where volume or price broke from the recent pattern.
            </p>
          </div>
          {/* A plain GET form, so the chosen date lives in the URL and works without client JS */}
          <form action="/bhavcopy" method="get" className="flex items-end gap-2">
            <label className="text-2xs uppercase tracking-wide text-muted-foreground">
              Trading date
              <input
                type="date"
                name="date"
                defaultValue={res.ok ? res.data.date : valid}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-1 block h-9 rounded-lg border border-border bg-surface px-2 font-mono text-sm"
              />
            </label>
            <button type="submit" className="h-9 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-muted">
              Load
            </button>
          </form>
        </div>

        {!res.ok ? (
          <div className="mt-8">
            <DataUnavailable title="Bhavcopy unavailable" message={res.message} />
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Session" value={res.data.date} />
              <Kpi label="Securities traded" value={formatINR(res.data.kpis.securities, 0)} />
              <Kpi
                label="Advance / decline"
                value={
                  <>
                    <span className="text-up">{res.data.kpis.advances}</span>
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-down">{res.data.kpis.declines}</span>
                  </>
                }
                hint={res.data.kpis.advanceDeclineRatio != null ? `${res.data.kpis.advanceDeclineRatio.toFixed(2)}x ratio` : undefined}
              />
              <Kpi label="Turnover" value={`₹${formatINR(res.data.kpis.turnoverCr, 0)} Cr`} />
              <Kpi
                label="Delivery (weighted)"
                value={res.data.kpis.weightedDeliveryPct != null ? `${res.data.kpis.weightedDeliveryPct}%` : "—"}
                hint="of all traded quantity"
              />
              <Kpi
                label="Delivery (simple avg)"
                value={res.data.kpis.averageDeliveryPct != null ? `${res.data.kpis.averageDeliveryPct}%` : "—"}
                hint="mean across stocks"
              />
            </div>

            <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <span className="mr-2 font-mono text-2xs uppercase tracking-wider text-accent">Session narrative</span>
              {res.data.narrative}
            </p>

            <DeskAnalysis insights={res.data.insights} title="Session analysis" className="mt-4" />

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
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
                footnote={`Inferred from move size and close-at-extreme; the file does not list each stock's price band.`}
              >
                <RowsTable rows={res.data.bandMoves.upper} extra={{ label: "Band", render: (r) => `${r.band}%` }} />
              </DataCard>

              <DataCard title="Lower-band closes" subtitle="Closed on the day's low at a 5%, 10% or 20% fall" icon={Gauge}>
                <RowsTable rows={res.data.bandMoves.lower} extra={{ label: "Band", render: (r) => `${r.band}%` }} />
              </DataCard>
            </div>

            <div className="mt-4 flex items-center gap-2 text-2xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Equity (EQ) and trade-for-trade (BE) series only. Sector-wise averages are not shown: the Bhavcopy carries no sector field.
            </div>
            <div className="mt-2">
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
