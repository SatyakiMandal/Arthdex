"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Search,
  Layers,
  Zap,
  Flame,
  Gauge,
  SlidersHorizontal,
  Download,
  Crosshair,
  ExternalLink,
} from "lucide-react";
import type { BhavRow } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export type BhavTab = "ALL" | "ACCUMULATION" | "SURGES" | "UPPER_BAND" | "LOWER_BAND";

type SortField = "symbol" | "close" | "changePct" | "turnoverCr" | "deliveryPct" | "volumeMultiple";
type SortDirection = "asc" | "desc";

interface BhavcopyBrowserProps {
  accumulation: BhavRow[];
  volumeAnomalies: BhavRow[];
  bandMoves: { upper: BhavRow[]; lower: BhavRow[] };
  criteria?: {
    minTurnoverCr: number;
    accumulationDeliveryPct: number;
    anomalyVolumeMultiple: number;
    baselineSessions: number;
  };
  tradeDate?: string;
  initialTab?: BhavTab;
  className?: string;
}

interface EnrichedBhavRow extends BhavRow {
  tags: string[];
}

export function BhavcopyBrowser({
  accumulation,
  volumeAnomalies,
  bandMoves,
  criteria,
  tradeDate,
  initialTab = "ALL",
  className,
}: BhavcopyBrowserProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BhavTab>(initialTab);
  const [search, setSearch] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("turnoverCr");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Consolidate and tag unique rows
  const allEnrichedRows = useMemo<EnrichedBhavRow[]>(() => {
    const map = new Map<string, EnrichedBhavRow>();

    const merge = (row: BhavRow, tag: string) => {
      const existing = map.get(row.symbol);
      if (existing) {
        if (!existing.tags.includes(tag)) existing.tags.push(tag);
        if (row.volumeMultiple != null && existing.volumeMultiple == null) {
          existing.volumeMultiple = row.volumeMultiple;
        }
        if (row.band != null && existing.band == null) {
          existing.band = row.band;
        }
      } else {
        map.set(row.symbol, {
          ...row,
          tags: [tag],
        });
      }
    };

    accumulation.forEach((r) => merge(r, "ACCUMULATION"));
    volumeAnomalies.forEach((r) => merge(r, "SURGE"));
    bandMoves.upper.forEach((r) => merge(r, "UPPER_BAND"));
    bandMoves.lower.forEach((r) => merge(r, "LOWER_BAND"));

    return Array.from(map.values());
  }, [accumulation, volumeAnomalies, bandMoves]);

  // Tab filtering
  const currentTabRows = useMemo(() => {
    switch (activeTab) {
      case "ACCUMULATION":
        return accumulation.map((r) => ({ ...r, tags: ["ACCUMULATION"] }));
      case "SURGES":
        return volumeAnomalies.map((r) => ({ ...r, tags: ["SURGE"] }));
      case "UPPER_BAND":
        return bandMoves.upper.map((r) => ({ ...r, tags: ["UPPER_BAND"] }));
      case "LOWER_BAND":
        return bandMoves.lower.map((r) => ({ ...r, tags: ["LOWER_BAND"] }));
      case "ALL":
      default:
        return allEnrichedRows;
    }
  }, [activeTab, accumulation, volumeAnomalies, bandMoves, allEnrichedRows]);

  // Search filtering
  const searchedRows = useMemo(() => {
    if (!search.trim()) return currentTabRows;
    const q = search.trim().toUpperCase();
    return currentTabRows.filter((r) => r.symbol.toUpperCase().includes(q));
  }, [currentTabRows, search]);

  // Sorting
  const sortedRows = useMemo(() => {
    return [...searchedRows].sort((a, b) => {
      let valA: string | number = 0;
      let valB: string | number = 0;

      switch (sortField) {
        case "symbol":
          valA = a.symbol;
          valB = b.symbol;
          break;
        case "close":
          valA = a.close ?? -Infinity;
          valB = b.close ?? -Infinity;
          break;
        case "changePct":
          valA = a.changePct ?? -Infinity;
          valB = b.changePct ?? -Infinity;
          break;
        case "turnoverCr":
          valA = a.turnoverCr ?? -Infinity;
          valB = b.turnoverCr ?? -Infinity;
          break;
        case "deliveryPct":
          valA = a.deliveryPct ?? -Infinity;
          valB = b.deliveryPct ?? -Infinity;
          break;
        case "volumeMultiple":
          valA = a.volumeMultiple ?? -Infinity;
          valB = b.volumeMultiple ?? -Infinity;
          break;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return sortDir === "asc" ? numA - numB : numB - numA;
    });
  }, [searchedRows, sortField, sortDir]);

  // Max values for cell bars
  const maxTurn = useMemo(() => Math.max(...sortedRows.map((r) => r.turnoverCr ?? 0), 1), [sortedRows]);
  const maxChg = useMemo(() => Math.max(...sortedRows.map((r) => Math.abs(r.changePct ?? 0)), 1), [sortedRows]);

  // Aggregated KPIs for filtered rows
  const summaryKpis = useMemo(() => {
    const totalTurnover = sortedRows.reduce((acc, r) => acc + (r.turnoverCr ?? 0), 0);
    const validDeliv = sortedRows.filter((r) => r.deliveryPct != null);
    const avgDeliv = validDeliv.length > 0 ? validDeliv.reduce((acc, r) => acc + (r.deliveryPct ?? 0), 0) / validDeliv.length : 0;
    const advances = sortedRows.filter((r) => (r.changePct ?? 0) > 0).length;
    const declines = sortedRows.filter((r) => (r.changePct ?? 0) < 0).length;
    return { totalTurnover, avgDeliv, advances, declines };
  }, [sortedRows]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

      // Quick Search Focus on '/'
      if (e.key === "/" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Tab switcher keys 1-5 when not typing
      if (!isInput && ["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        const tabs: BhavTab[] = ["ALL", "ACCUMULATION", "SURGES", "UPPER_BAND", "LOWER_BAND"];
        const idx = Number(e.key) - 1;
        if (tabs[idx]) {
          setActiveTab(tabs[idx]);
          setSelectedIndex(0);
        }
        return;
      }

      // Escape clears search and blurs
      if (e.key === "Escape") {
        if (search) setSearch("");
        searchInputRef.current?.blur();
        return;
      }

      // Arrow navigation
      if (!isInput) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = Math.min(prev + 1, sortedRows.length - 1);
            scrollRowIntoView(next);
            return next;
          });
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            scrollRowIntoView(next);
            return next;
          });
        } else if (e.key === "Enter") {
          const selected = sortedRows[selectedIndex];
          if (selected) {
            e.preventDefault();
            router.push(`/company/${selected.symbol}`);
          }
        }
      }
    }

    function scrollRowIntoView(idx: number) {
      const container = tableContainerRef.current;
      if (!container) return;
      const row = container.querySelector<HTMLTableRowElement>(`tr[data-index="${idx}"]`);
      if (row) {
        row.scrollIntoView({ block: "nearest" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search, sortedRows, selectedIndex, router]);

  // Export CSV
  const handleExportCsv = useCallback(() => {
    const headers = ["Symbol", "Close", "ChangePct", "TurnoverCr", "DeliveryPct", "VolumeVs5dAvg", "Band", "Tags"];
    const rows = sortedRows.map((r) => [
      r.symbol,
      r.close ?? "",
      r.changePct ?? "",
      r.turnoverCr ?? "",
      r.deliveryPct ?? "",
      r.volumeMultiple ?? "",
      r.band ?? "",
      r.tags.join(";"),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `arthdex-bhavcopy-${tradeDate || "session"}-${activeTab.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [sortedRows, tradeDate, activeTab]);

  return (
    <div className={cn("rounded-none border border-border/70 bg-card p-3 shadow-xs space-y-3 font-mono", className)}>
      {/* Bloomberg Station Header Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-accent/15 border border-accent/40 text-accent rounded-none">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-sans text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <span>Bhavcopy Institutional Radar</span>
              {tradeDate && (
                <span className="text-3xs font-mono px-1.5 py-0.2 bg-muted/60 border border-border/80 text-muted-foreground">
                  {tradeDate}
                </span>
              )}
            </h2>
            <p className="text-3xs text-muted-foreground font-sans">
              Razor-edge delivery accumulation, circuit moves &amp; volume surge analytics
            </p>
          </div>
        </div>

        {/* Quick Search and Export */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Filter scrip [/]..."
              className="h-7 w-36 sm:w-48 pl-7 pr-7 text-2xs rounded-none border border-border/80 bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            ) : (
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-muted-foreground border border-border/70 px-1 py-0.2">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            title="Export filtered dataset to CSV"
            className="flex items-center gap-1 h-7 px-2 text-3xs font-bold rounded-none border border-border/80 bg-surface hover:bg-surface-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* View Selector Tabs & Micro Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 text-3xs font-sans">
          <button
            type="button"
            onClick={() => {
              setActiveTab("ALL");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 font-bold uppercase tracking-wider rounded-none border transition-colors flex items-center gap-1",
              activeTab === "ALL"
                ? "border-accent bg-accent text-accent-foreground shadow-xs"
                : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>All Scrips</span>
            <span className="ml-1 font-mono text-3xs opacity-80">({allEnrichedRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("ACCUMULATION");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 font-bold uppercase tracking-wider rounded-none border transition-colors flex items-center gap-1",
              activeTab === "ACCUMULATION"
                ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-emerald-400",
            )}
          >
            <Layers className="h-3 w-3" />
            <span>Accumulation</span>
            <span className="ml-1 font-mono text-3xs opacity-80">({accumulation.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("SURGES");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 font-bold uppercase tracking-wider rounded-none border transition-colors flex items-center gap-1",
              activeTab === "SURGES"
                ? "border-cyan-600 bg-cyan-600 text-white shadow-xs"
                : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-cyan-400",
            )}
          >
            <Zap className="h-3 w-3" />
            <span>Surges</span>
            <span className="ml-1 font-mono text-3xs opacity-80">({volumeAnomalies.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("UPPER_BAND");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 font-bold uppercase tracking-wider rounded-none border transition-colors flex items-center gap-1",
              activeTab === "UPPER_BAND"
                ? "border-amber-600 bg-amber-600 text-white shadow-xs"
                : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-amber-400",
            )}
          >
            <Flame className="h-3 w-3" />
            <span>Upper Band</span>
            <span className="ml-1 font-mono text-3xs opacity-80">({bandMoves.upper.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("LOWER_BAND");
              setSelectedIndex(0);
            }}
            className={cn(
              "px-2.5 py-1 font-bold uppercase tracking-wider rounded-none border transition-colors flex items-center gap-1",
              activeTab === "LOWER_BAND"
                ? "border-rose-600 bg-rose-600 text-white shadow-xs"
                : "border-border/70 bg-surface text-muted-foreground hover:bg-surface-muted hover:text-rose-400",
            )}
          >
            <Gauge className="h-3 w-3" />
            <span>Lower Band</span>
            <span className="ml-1 font-mono text-3xs opacity-80">({bandMoves.lower.length})</span>
          </button>
        </div>

        {/* Live Filter Metric Strip */}
        <div className="flex items-center gap-3 text-3xs text-muted-foreground">
          <span>
            Matched: <strong className="text-foreground">{sortedRows.length}</strong>
          </span>
          <span className="text-border">|</span>
          <span>
            Turnover: <strong className="text-foreground">₹{formatINR(summaryKpis.totalTurnover, 0)} Cr</strong>
          </span>
          <span className="text-border">|</span>
          <span>
            Avg Deliv: <strong className="text-foreground">{summaryKpis.avgDeliv.toFixed(1)}%</strong>
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="text-up font-bold">+{summaryKpis.advances}</span> /{" "}
            <span className="text-down font-bold">-{summaryKpis.declines}</span>
          </span>
        </div>
      </div>

      {/* Ultra-Dense Bloomberg Terminal Data Grid */}
      <div
        ref={tableContainerRef}
        className="max-h-[32rem] overflow-auto rounded-none border border-border/80 bg-surface"
      >
        <table className="data-table data-table-sticky w-full min-w-[700px] border-collapse text-2xs">
          <thead>
            <tr className="border-b border-border text-3xs uppercase tracking-wider text-muted-foreground select-none">
              <th className="px-2.5 py-1.5 text-left font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("symbol")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <span>Scrip</span>
                  {sortField === "symbol" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2 py-1.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("close")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <span>Close</span>
                  {sortField === "close" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2 py-1.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("changePct")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <span>% Chg</span>
                  {sortField === "changePct" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2 py-1.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("turnoverCr")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <span>Turnover ₹Cr</span>
                  {sortField === "turnoverCr" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2 py-1.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("deliveryPct")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <span>Deliv %</span>
                  {sortField === "deliveryPct" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2 py-1.5 text-left font-semibold min-w-36">
                <span>Delivery Sparkline &amp; Split</span>
              </th>

              <th className="px-2 py-1.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort("volumeMultiple")}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <span>Anomaly</span>
                  {sortField === "volumeMultiple" ? (
                    sortDir === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-accent" /> : <ArrowDown className="h-2.5 w-2.5 text-accent" />
                  ) : (
                    <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                  )}
                </button>
              </th>

              <th className="px-2.5 py-1.5 text-right font-semibold">
                <span>Action</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground font-sans">
                  No scrips match the filter or search criteria.
                </td>
              </tr>
            ) : (
              sortedRows.map((r, idx) => {
                const isSelected = selectedIndex === idx;
                const turnPct = Math.min(100, ((r.turnoverCr ?? 0) / maxTurn) * 100);
                const delivVal = r.deliveryPct ?? 0;
                const isHighDelivery = delivVal >= 68;

                return (
                  <tr
                    key={`${r.symbol}-${idx}`}
                    data-index={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={cn(
                      "transition-colors duration-100",
                      isSelected && "row-cursor-active",
                    )}
                  >
                    {/* Scrip Symbol & Badges */}
                    <td className="px-2.5 py-1 font-semibold cell-glow">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/company/${r.symbol}`}
                          className="font-bold text-foreground hover:text-accent transition-colors flex items-center gap-1"
                        >
                          <span>{r.symbol}</span>
                          <ArrowUpRight className="h-2.5 w-2.5 opacity-60 text-muted-foreground" />
                        </Link>
                        {r.band ? (
                          <span className="px-1 py-0.2 text-3xs font-mono border border-amber-500/40 bg-amber-500/10 text-amber-400 rounded-none">
                            {r.band}% Band
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Close Price */}
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-foreground cell-glow">
                      {r.close == null ? "—" : `₹${formatINR(r.close)}`}
                    </td>

                    {/* % Change */}
                    <td className="px-2 py-1 text-right font-mono tabular-nums cell-glow">
                      <span
                        className={cn(
                          "inline-block font-semibold",
                          r.changePct != null && deltaColor(r.changePct),
                        )}
                      >
                        {r.changePct == null ? "—" : formatPct(r.changePct)}
                      </span>
                    </td>

                    {/* Turnover ₹Cr */}
                    <td className="px-2 py-1 text-right font-mono tabular-nums cell-glow text-foreground">
                      {r.turnoverCr == null ? "—" : formatINR(r.turnoverCr, 1)}
                    </td>

                    {/* Delivery % */}
                    <td className="px-2 py-1 text-right font-mono tabular-nums cell-glow">
                      <span
                        className={cn(
                          "font-bold",
                          isHighDelivery
                            ? "text-emerald-400 font-extrabold"
                            : delivVal >= 50
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {r.deliveryPct == null ? "—" : `${delivVal.toFixed(1)}%`}
                      </span>
                    </td>

                    {/* Inline Delivery Sparkline & Visual Split */}
                    <td className="px-2 py-1 font-mono">
                      <div className="flex items-center gap-2">
                        {/* Compact Dual-Tone Split Bar (zero rounded) */}
                        <div className="relative h-2 w-24 bg-muted/60 rounded-none border border-border/50 overflow-hidden">
                          {/* Total turnover / volume representation */}
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-muted-foreground/30 rounded-none"
                            style={{ width: `${Math.max(6, turnPct)}%` }}
                          />
                          {/* Physical Delivery absorption representation */}
                          <div
                            className={cn(
                              "absolute top-0 bottom-0 left-0 rounded-none transition-all",
                              isHighDelivery ? "bg-emerald-500" : "bg-accent",
                            )}
                            style={{ width: `${Math.min(100, delivVal)}%` }}
                          />
                          {/* Institutional 68% absorption threshold needle */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-gold/90 z-10"
                            style={{ left: "68%" }}
                            title="68% Institutional Accumulation Threshold"
                          />
                        </div>
                        <span className="text-3xs text-muted-foreground font-mono">
                          {turnPct > 40 ? "HIGH VOL" : "STABLE"}
                        </span>
                      </div>
                    </td>

                    {/* Anomaly vs 5D or Signal Tag */}
                    <td className="px-2 py-1 text-right font-mono cell-glow">
                      {r.volumeMultiple != null ? (
                        <span
                          className={cn(
                            "px-1 py-0.2 text-3xs font-bold rounded-none border",
                            r.volumeMultiple >= 2.5
                              ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-400"
                              : "border-border bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {r.volumeMultiple.toFixed(1)}x 5D
                        </span>
                      ) : r.tags.includes("ACCUMULATION") ? (
                        <span className="px-1 py-0.2 text-3xs font-bold rounded-none border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                          DELIV ACC
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-3xs">—</span>
                      )}
                    </td>

                    {/* 1-Click Action */}
                    <td className="px-2.5 py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/derivatives?symbol=${r.symbol}`}
                          title={`Open ${r.symbol} Option Chain`}
                          className="px-1.5 py-0.5 text-3xs font-bold text-muted-foreground hover:text-accent border border-border/60 hover:border-accent rounded-none bg-surface transition-colors"
                        >
                          F&amp;O
                        </Link>
                        <Link
                          href={`/company/${r.symbol}`}
                          title={`View ${r.symbol} Analytics`}
                          className="px-1.5 py-0.5 text-3xs font-bold text-foreground hover:text-accent border border-border/60 hover:border-accent rounded-none bg-surface transition-colors"
                        >
                          Dossier
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Terminal Footer Quick Status */}
      <div className="flex flex-wrap items-center justify-between text-3xs text-muted-foreground border-t border-border/40 pt-2 font-mono">
        <div className="flex items-center gap-2">
          <span>Active Cursor: [↑ / ↓] Navigate</span>
          <span>·</span>
          <span>[Enter] Open Stock Dossier</span>
          <span>·</span>
          <span>[/] Search</span>
          <span>·</span>
          <span>[1-5] Switch Quadrant</span>
        </div>
        <div>
          <span>Criteria: Turnover ≥ ₹{criteria?.minTurnoverCr ?? 3} Cr · Deliv ≥ {criteria?.accumulationDeliveryPct ?? 60}%</span>
        </div>
      </div>
    </div>
  );
}
