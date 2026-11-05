"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Layers, Sparkles } from "lucide-react";
import type { ApiBuildUp, ApiBuildUpRow } from "@/lib/api/types";
import { cn, formatPct, formatINR } from "@/lib/utils";

interface QuadrantConfig {
  key: keyof ApiBuildUp["buckets"];
  title: string;
  reads: string;
  tone: "up" | "down";
  badge: string;
  accentColor: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    key: "longBuildUp",
    title: "Long Build-Up",
    reads: "Price ▲, Open Interest ▲ · Aggressive Institutional Buying",
    tone: "up",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    accentColor: "#10b981",
  },
  {
    key: "shortCovering",
    title: "Short Covering",
    reads: "Price ▲, Open Interest ▼ · Bear Unwinding & Short Squeeze",
    tone: "up",
    badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    accentColor: "#06b6d4",
  },
  {
    key: "shortBuildUp",
    title: "Short Build-Up",
    reads: "Price ▼, Open Interest ▲ · Fresh Institutional Short Additions",
    tone: "down",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-400",
    accentColor: "#f43f5e",
  },
  {
    key: "longUnwinding",
    title: "Long Unwinding",
    reads: "Price ▼, Open Interest ▼ · Profit Taking & Bull Capitulation",
    tone: "down",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    accentColor: "#f59e0b",
  },
];

/**
 * Precision SVG Momentum Sparkline
 * Strict zero rounded radius (rx="0" ry="0")
 */
function MomentumSparkline({
  priceChange,
  oiChange,
  tone,
  color,
}: {
  priceChange: number;
  oiChange: number | null;
  tone: "up" | "down";
  color: string;
}) {
  const isUp = tone === "up";
  const pNorm = Math.min(Math.max(priceChange, -10), 10);
  const oiNorm = Math.min(Math.max(oiChange ?? 0, -30), 30);

  // Synthesize smooth 4-point momentum curve
  const y0 = isUp ? 14 : 4;
  const y1 = isUp ? Math.max(2, 10 - pNorm * 0.8) : Math.min(16, 8 - pNorm * 0.8);
  const y2 = isUp ? Math.max(2, y1 - Math.abs(oiNorm) * 0.15) : Math.min(16, y1 + Math.abs(oiNorm) * 0.15);
  const y3 = isUp ? 3 : 15;

  const d = `M 0,${y0} Q 14,${y1} 28,${y2} T 52,${y3}`;

  return (
    <svg width="52" height="18" viewBox="0 0 52 18" className="overflow-visible" aria-hidden="true">
      {/* Hairline baseline */}
      <line x1="0" y1="9" x2="52" y2="9" stroke="hsl(var(--border) / 0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
      {/* Animated Momentum Stroke */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="square"
        className="momentum-sparkline"
      />
      {/* Terminal Node */}
      <rect x="50" y={y3 - 1.5} width="3" height="3" fill={color} />
    </svg>
  );
}

export function BuildUpView({ data }: { data: ApiBuildUp }) {
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [expandedQuadrants, setExpandedQuadrants] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedQuadrants((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Institutional Filter & Quadrant Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-accent/15 border border-accent/40 text-accent rounded-none">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-foreground">
              4-Quadrant F&amp;O Open Interest &amp; Price Buildup Grid
            </span>
            <span className="ml-2 text-3xs text-muted-foreground">
              {data.classified} of {data.of} active derivatives tracked
            </span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search symbol across 4 quadrants..."
            className="h-7 w-48 sm:w-64 pl-7 pr-7 text-2xs rounded-none border border-border/80 bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-3xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 4-Quadrant Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUADRANTS.map((q) => {
          const rawRows = data.buckets[q.key] ?? [];
          const filteredRows = filterQuery.trim()
            ? rawRows.filter((r) => r.symbol.toUpperCase().includes(filterQuery.trim().toUpperCase()))
            : rawRows;

          const isExpanded = !!expandedQuadrants[q.key];
          const displayedRows = isExpanded ? filteredRows : filteredRows.slice(0, 8);

          // Calculate max OI change for relative mini-bars
          const maxOiPct = Math.max(...rawRows.map((r) => Math.abs(r.oiChangePct ?? 0)), 1);
          const maxPricePct = Math.max(...rawRows.map((r) => Math.abs(r.priceChangePct ?? 0)), 1);

          return (
            <div
              key={q.key}
              className="rounded-none border border-border/80 bg-card p-3 flex flex-col justify-between shadow-xs transition-colors hover:border-border"
            >
              <div>
                {/* Quadrant Header Ribbon */}
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <div className="flex items-center gap-1.5">
                    {q.tone === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5 text-up" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-down" />
                    )}
                    <h3 className="font-sans text-xs font-bold tracking-tight text-foreground uppercase">
                      {q.title}
                    </h3>
                  </div>
                  <span className={cn("px-1.5 py-0.2 text-3xs font-mono font-bold rounded-none border", q.badge)}>
                    {filteredRows.length} scrips
                  </span>
                </div>
                <p className="mt-1 text-3xs text-muted-foreground font-sans leading-relaxed line-clamp-1">
                  {q.reads}
                </p>

                {/* Dense Quadrant Table */}
                <div className="mt-2.5 overflow-x-auto">
                  <table className="w-full text-2xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 text-3xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-1 text-left font-semibold">Scrip</th>
                        <th className="py-1 text-center font-semibold">Momentum</th>
                        <th className="py-1 text-right font-semibold">% Chg</th>
                        <th className="py-1 text-right font-semibold">OI Chg</th>
                        <th className="py-1 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-3xs text-muted-foreground font-sans">
                            {filterQuery ? "No matches found." : "No counters in this quadrant."}
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((r: ApiBuildUpRow) => {
                          const priceBarWidth = Math.min(100, (Math.abs(r.priceChangePct) / maxPricePct) * 100);
                          const oiBarWidth = Math.min(100, (Math.abs(r.oiChangePct ?? 0) / maxOiPct) * 100);
                          const underlyingAtm = r.underlying ? Math.round(r.underlying) : null;

                          return (
                            <tr
                              key={r.symbol}
                              className="group border-b border-border/40 hover:bg-surface-muted/60 transition-colors"
                            >
                              {/* Scrip Symbol */}
                              <td className="py-1 pr-1 font-semibold cell-glow">
                                <Link
                                  href={`/derivatives?symbol=${encodeURIComponent(r.symbol)}`}
                                  className="font-mono text-2xs font-bold text-foreground hover:text-accent flex items-center gap-0.5"
                                  title={`Open ${r.symbol} Option Chain`}
                                >
                                  <span>{r.symbol}</span>
                                </Link>
                              </td>

                              {/* Momentum SVG Sparkline */}
                              <td className="py-1 px-1 text-center align-middle">
                                <div className="flex items-center justify-center">
                                  <MomentumSparkline
                                    priceChange={r.priceChangePct}
                                    oiChange={r.oiChangePct}
                                    tone={q.tone}
                                    color={q.accentColor}
                                  />
                                </div>
                              </td>

                              {/* Price Change % with Compact Mini-Bar */}
                              <td className="py-1 px-1 text-right tabular-nums cell-glow">
                                <div className="flex flex-col items-end">
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      q.tone === "up" ? "text-up font-bold" : "text-down font-bold",
                                    )}
                                  >
                                    {formatPct(r.priceChangePct, 1)}
                                  </span>
                                  {/* Compact mini-bar */}
                                  <div className="w-10 h-1 bg-muted/60 rounded-none overflow-hidden mt-0.5">
                                    <div
                                      className={cn("h-full rounded-none", q.tone === "up" ? "bg-up" : "bg-down")}
                                      style={{ width: `${priceBarWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* OI Change % with Compact Mini-Bar */}
                              <td className="py-1 px-1 text-right tabular-nums cell-glow text-muted-foreground">
                                <div className="flex flex-col items-end">
                                  <span className="text-foreground font-medium">
                                    {r.oiChangePct != null ? formatPct(r.oiChangePct, 1) : "—"}
                                  </span>
                                  {/* Compact OI mini-bar */}
                                  <div className="w-10 h-1 bg-muted/60 rounded-none overflow-hidden mt-0.5">
                                    <div
                                      className="h-full bg-accent/70 rounded-none"
                                      style={{ width: `${oiBarWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* 1-Click Strike Jump Button */}
                              <td className="py-1 pl-1 text-right">
                                <Link
                                  href={`/derivatives?symbol=${encodeURIComponent(r.symbol)}`}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 text-3xs font-mono font-bold rounded-none border border-border/70 bg-surface hover:bg-accent hover:text-accent-foreground hover:border-accent transition-colors"
                                  title={underlyingAtm ? `ATM Strike: ₹${underlyingAtm}` : "View Chain"}
                                >
                                  <span>{underlyingAtm ? `₹${underlyingAtm}` : "Chain"}</span>
                                  <ArrowUpRight className="h-2.5 w-2.5 opacity-70" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* View More / Expand Toggle */}
              {filteredRows.length > 8 && (
                <div className="mt-2 pt-1.5 border-t border-border/40 text-center">
                  <button
                    type="button"
                    onClick={() => toggleExpand(q.key)}
                    className="inline-flex items-center gap-1 text-3xs font-mono font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>{isExpanded ? "Collapse to Top 8" : `Show All ${filteredRows.length} Scrips`}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desk Footnote & Legend */}
      <div className="flex flex-wrap items-center justify-between text-3xs text-muted-foreground border-t border-border/40 pt-2 font-mono">
        <div>
          <span>
            Ranked by size of open interest delta · Price change measured against exchange adjusted base
          </span>
        </div>
        <div>
          <span>Click any ATM strike pill to jump directly to options chain</span>
        </div>
      </div>
    </div>
  );
}
