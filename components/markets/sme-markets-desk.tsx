"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApiIpoIssue, ApiSmeBoardRow, ApiSmeOverview } from "@/lib/api/types";

interface SmeMarketsDeskProps {
  overview: ApiSmeOverview | null;
  rows: ApiSmeBoardRow[];
  ipos: ApiIpoIssue[] | null;
  /** Why the board is empty, when the exchange feed did not answer. */
  boardError?: string | null;
  ipoError?: string | null;
}

type SortKey = "marketCapCr" | "turnoverCr" | "changePct";
const SIZE_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: "all", label: "All sizes", min: 0, max: Infinity },
  { id: "micro", label: "Under ₹100 Cr", min: 0, max: 100 },
  { id: "small", label: "₹100 to 250 Cr", min: 100, max: 250 },
  { id: "mid", label: "₹250 to 500 Cr", min: 250, max: 500 },
  { id: "large", label: "Over ₹500 Cr", min: 500, max: Infinity },
];
const PAGE = 50;
const DASH = "—";

const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${num(v)}%` : DASH);
const tone = (v: number | null | undefined) => (typeof v !== "number" || v === 0 ? "text-muted-foreground" : v > 0 ? "text-up" : "text-down");
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : DASH);

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border bg-surface p-3">
      <span className="text-3xs font-bold uppercase text-muted-foreground">{label}</span>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
      {sub ? <span className="text-3xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return (
    <div className="border border-border bg-surface p-6 text-2xs text-muted-foreground" role="status">
      <p className="font-bold uppercase text-foreground">{title}</p>
      <p className="mt-1 max-w-prose">{message}</p>
    </div>
  );
}

export function SmeMarketsDesk({ overview, rows, ipos, boardError = null, ipoError = null }: SmeMarketsDeskProps) {
  const [tab, setTab] = useState<"BOARD" | "IPOS">("BOARD");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState<SortKey>("marketCapCr");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const { min, max } = SIZE_BANDS.find((b) => b.id === band) ?? SIZE_BANDS[0];
    const q = query.trim().toUpperCase();
    return rows
      .filter((r) => {
        if (q && !r.symbol.includes(q) && !(r.name ?? "").toUpperCase().includes(q)) return false;
        if (band === "all") return true;
        return r.marketCapCr !== null && r.marketCapCr >= min && r.marketCapCr < max;
      })
      .sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity));
  }, [rows, band, sort, query]);

  const tabs = [
    { id: "BOARD" as const, label: `Board (${rows.length})` },
    { id: "IPOS" as const, label: `SME IPOs (${ipos?.length ?? 0})` },
  ];

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-surface-muted/40 p-2.5 text-2xs">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="font-bold uppercase tracking-wider text-foreground">
            SME shares trade in fixed lots and can be illiquid. Information only, not advice.
          </span>
        </div>
        <span className="text-3xs text-muted-foreground">
          NSE Emerge, delayed{overview?.asOf ? ` • as of ${overview.asOf}` : ""}
        </span>
      </div>

      {overview ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <Kpi label="Securities traded today" value={num(overview.count, 0)} sub="NSE Emerge, series SM and ST" />
          <Kpi label="Combined market cap" value={overview.totalMarketCapCr === null ? DASH : `₹${num(overview.totalMarketCapCr, 0)} Cr`} sub={`${num(overview.marketCapTiers.over500Cr, 0)} companies above ₹500 Cr`} />
          <Kpi label="Turnover today" value={overview.totalTurnoverCr === null ? DASH : `₹${num(overview.totalTurnoverCr)} Cr`} />
          <Kpi
            label="Advances / declines"
            value={`${overview.breadth.advances} / ${overview.breadth.declines}`}
            sub={`${overview.breadth.unchanged} unchanged`}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-border" role="tablist" aria-label="SME desk sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "border-b-2 px-3 py-1.5 text-3xs font-bold uppercase tracking-wider",
              tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "BOARD" ? (
        !overview ? (
          <Unavailable title="SME board unavailable" message={boardError ?? "The exchange feed did not answer. Try again shortly."} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-2xs">
              <label className="sr-only" htmlFor="sme-search">Search symbol</label>
              <input
                id="sme-search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
                placeholder="Search symbol"
                maxLength={20}
                className="w-40 border border-border bg-surface-muted px-2 py-1 uppercase text-foreground focus:border-accent focus:outline-none"
              />
              <label className="sr-only" htmlFor="sme-band">Market cap</label>
              <select id="sme-band" value={band} onChange={(e) => { setBand(e.target.value); setShown(PAGE); }} className="border border-border bg-surface-muted px-2 py-1 text-foreground">
                {SIZE_BANDS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="sme-sort">Sort by</label>
              <select id="sme-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="border border-border bg-surface-muted px-2 py-1 text-foreground">
                <option value="marketCapCr">Largest market cap</option>
                <option value="turnoverCr">Highest turnover</option>
                <option value="changePct">Biggest gain today</option>
              </select>
              <span className="text-3xs text-muted-foreground">{filtered.length} of {rows.length}</span>
            </div>

            <div className="overflow-x-auto border border-border bg-surface">
              <table className="w-full text-left text-2xs">
                <thead>
                  <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                    <th className="px-2 py-1.5" scope="col">Symbol</th>
                    <th className="px-2 py-1.5 text-right" scope="col">Last (₹)</th>
                    <th className="px-2 py-1.5 text-right" scope="col">Change</th>
                    <th className="px-2 py-1.5 text-right" scope="col">Market cap (₹ Cr)</th>
                    <th className="px-2 py-1.5 text-right" scope="col">Turnover (₹ Cr)</th>
                    <th className="px-2 py-1.5 text-right" scope="col">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.slice(0, shown).map((r) => (
                    <tr key={r.symbol} className="hover:bg-surface-muted/50">
                      <th className="px-2 py-1.5 font-bold" scope="row">
                        <Link href={`/company/${encodeURIComponent(r.symbol)}`} className="text-foreground hover:text-accent">
                          {r.symbol}
                        </Link>
                        {r.name ? <span className="ml-2 font-normal text-muted-foreground">{r.name}</span> : null}
                      </th>
                      <td className="px-2 py-1.5 text-right">{num(r.last)}</td>
                      <td className={cn("px-2 py-1.5 text-right font-bold", tone(r.changePct))}>{signed(r.changePct)}</td>
                      <td className="px-2 py-1.5 text-right">{num(r.marketCapCr, 0)}</td>
                      <td className="px-2 py-1.5 text-right">{num(r.turnoverCr)}</td>
                      <td className="px-2 py-1.5 text-right">{num(r.volume, 0)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">No securities match these filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {filtered.length > shown ? (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="border border-border bg-surface-raised px-3 py-1.5 text-3xs font-bold uppercase hover:border-accent">
                Show {Math.min(PAGE, filtered.length - shown)} more
              </button>
            ) : null}

            <ul className="list-disc space-y-0.5 pl-4 text-3xs text-muted-foreground">
              {Object.values(overview.unavailable).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )
      ) : ipos === null ? (
        <Unavailable title="SME IPO list unavailable" message={ipoError ?? "The exchange's IPO list did not answer. Try again shortly."} />
      ) : ipos.length === 0 ? (
        <Unavailable title="No SME issues listed" message="NSE lists no current, upcoming or recent SME issues right now." />
      ) : (
        <div className="overflow-x-auto border border-border bg-surface">
          <table className="w-full text-left text-2xs">
            <thead>
              <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                <th className="px-2 py-1.5" scope="col">Issue</th>
                <th className="px-2 py-1.5" scope="col">Status</th>
                <th className="px-2 py-1.5 text-right" scope="col">Price band (₹)</th>
                <th className="px-2 py-1.5" scope="col">Opens</th>
                <th className="px-2 py-1.5" scope="col">Closes</th>
                <th className="px-2 py-1.5 text-right" scope="col">Subscription</th>
                <th className="px-2 py-1.5 text-right" scope="col">Since issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {ipos.map((i) => {
                const times = i.subscription?.totalX ?? i.subscriptionTimes;
                return (
                  <tr key={i.id} className="hover:bg-surface-muted/50">
                    <th className="px-2 py-1.5 font-bold" scope="row">
                      {i.name ?? i.symbol ?? DASH}
                      {i.symbol ? <span className="ml-2 font-normal text-muted-foreground">{i.symbol}</span> : null}
                    </th>
                    <td className="px-2 py-1.5 uppercase text-muted-foreground">{i.status}</td>
                    <td className="px-2 py-1.5 text-right">
                      {i.priceBandLow !== null && i.priceBandHigh !== null && i.priceBandLow !== i.priceBandHigh
                        ? `${num(i.priceBandLow, 0)} – ${num(i.priceBandHigh, 0)}`
                        : num(i.priceBandHigh ?? i.priceBandLow, 0)}
                    </td>
                    <td className="px-2 py-1.5">{day(i.issueStartDate)}</td>
                    <td className="px-2 py-1.5">{day(i.issueEndDate)}</td>
                    <td className="px-2 py-1.5 text-right">{typeof times === "number" ? `${num(times)}x` : DASH}</td>
                    <td className={cn("px-2 py-1.5 text-right font-bold", tone(i.cmpVsIssuePct))}>{signed(i.cmpVsIssuePct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border/60 p-2 text-3xs text-muted-foreground">
            From NSE&apos;s IPO listings. Grey-market premium is not shown: it is an unofficial quote that no exchange publishes.
          </p>
        </div>
      )}
    </div>
  );
}
