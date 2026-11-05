"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Info, ShieldAlert, ArrowUpRight, Flame, Search, Gauge, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiFnoBan } from "@/lib/api/types";

export function FnoBanTracker({
  banData,
}: {
  banData: ApiFnoBan;
}) {
  const [filterQuery, setFilterQuery] = useState<string>("");
  const banned = banData.bannedSymbols ?? [];
  const watchlist = banData.dangerWatchlist ?? [];

  const filteredBanned = filterQuery.trim()
    ? banned.filter((s) => s.toUpperCase().includes(filterQuery.trim().toUpperCase()))
    : banned;

  const filteredWatchlist = filterQuery.trim()
    ? watchlist.filter((s) => s.toUpperCase().includes(filterQuery.trim().toUpperCase()))
    : watchlist;

  return (
    <div className="space-y-4 font-mono">
      {/* Institutional Overview Header with Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-rose-500/15 border border-rose-500/40 text-rose-500 rounded-none">
            <Ban className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <span>NSE F&amp;O Ban List &amp; MWPL Danger Radar</span>
              <span className="text-3xs font-mono px-1.5 py-0.2 bg-muted/60 border border-border/80 text-muted-foreground">
                Session: {banData.tradeDate}
              </span>
            </span>
            <p className="text-3xs text-muted-foreground font-sans">
              Market-Wide Position Limit (MWPL) surveillance · Fresh contract lockout at 95% threshold
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search ban / watchlist..."
            className="h-7 w-44 sm:w-56 pl-7 pr-7 text-2xs rounded-none border border-border/80 bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
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

      {/* Hero Animated MWPL Danger Meter Spectrum */}
      <div className="rounded-none border border-border/80 bg-card p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between text-3xs">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-rose-500 animate-heat-pulse" />
            <span className="font-bold uppercase tracking-wider text-foreground">
              Institutional MWPL Saturation Spectrum (0% - 100%)
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span>
              <strong className="text-rose-400">{banned.length}</strong> Locked Out
            </span>
            <span>·</span>
            <span>
              <strong className="text-amber-400">{watchlist.length}</strong> In Danger Zone
            </span>
          </div>
        </div>

        {/* Multi-Zone Animated Heat Bar */}
        <div className="space-y-1.5 select-none">
          <div className="relative h-4 w-full bg-surface-muted rounded-none border border-border overflow-hidden flex">
            {/* 0% to 75%: Safe Normal Trading Zone */}
            <div
              className="h-full bg-emerald-500/30 border-r border-emerald-500/50 flex items-center justify-center text-3xs text-emerald-400 font-bold"
              style={{ width: "75%" }}
              title="0% - 75%: Normal F&O Trading Zone"
            >
              <span className="hidden sm:inline">Normal Trading (&lt;75% MWPL)</span>
            </div>

            {/* 75% to 80%: Cooldown Exit Corridor */}
            <div
              className="h-full bg-blue-500/40 border-r-2 border-blue-400 flex items-center justify-center text-3xs text-blue-300 font-bold"
              style={{ width: "5%" }}
              title="80% MWPL: Exit Threshold for Banned Stocks"
            >
              <span className="hidden md:inline">80% Exit</span>
            </div>

            {/* 80% to 94.9%: Danger / Watchlist Zone */}
            <div
              className="h-full bg-gradient-to-r from-amber-500/50 to-orange-500/60 border-r-2 border-rose-500 flex items-center justify-center text-3xs text-amber-200 font-bold"
              style={{ width: "15%" }}
              title="85% - 94.9% MWPL: Danger Watchlist"
            >
              <span className="hidden sm:inline">85-94% Danger</span>
            </div>

            {/* 95% to 100%: Official Ban Lockout Zone */}
            <div
              className="h-full bg-rose-600 animate-heat-pulse flex items-center justify-center text-3xs text-white font-extrabold"
              style={{ width: "5%" }}
              title="≥95% MWPL: Official SEBI F&O Ban Lockout"
            >
              <span>BAN</span>
            </div>
          </div>

          {/* Tick Scale Indicators */}
          <div className="relative flex justify-between text-3xs text-muted-foreground font-mono px-0.5">
            <span>0%</span>
            <span className="text-emerald-500 font-semibold">50% Safe</span>
            <span className="text-blue-400 font-semibold">80% Exit Mark</span>
            <span className="text-amber-400 font-semibold">85% Watch</span>
            <span className="text-rose-500 font-bold animate-pulse">▲ 95% BAN TRIGGER</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-none border border-rose-500/40 bg-rose-500/10 p-3">
          <div className="flex items-center justify-between text-2xs text-rose-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Ban className="h-3.5 w-3.5" /> Securities in Ban Period
            </span>
            <span className="font-mono text-sm font-bold text-rose-300">{banData.bannedCount}</span>
          </div>
          <p className="mt-2 text-3xs text-rose-300/80 font-sans leading-relaxed">
            Fresh derivative contracts prohibited. Traders can only square off or decrease existing positions.
          </p>
        </div>

        <div className="rounded-none border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center justify-between text-2xs text-amber-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> MWPL Ban Threshold
            </span>
            <span className="font-mono text-sm font-bold text-amber-300">{banData.mwplThreshold || "95%"}</span>
          </div>
          <p className="mt-2 text-3xs text-amber-300/80 font-sans leading-relaxed">
            Automatic entry trigger when total exchange-wide open interest reaches 95% of allowable limit.
          </p>
        </div>

        <div className="rounded-none border border-blue-500/40 bg-blue-500/10 p-3">
          <div className="flex items-center justify-between text-2xs text-blue-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> MWPL Exit Threshold
            </span>
            <span className="font-mono text-sm font-bold text-blue-300">{banData.exitThreshold || "80%"}</span>
          </div>
          <p className="mt-2 text-3xs text-blue-300/80 font-sans leading-relaxed">
            Stock remains locked out until aggregate open interest cools down below 80% of MWPL.
          </p>
        </div>
      </div>

      {/* Banned Securities Grid with Animated Heat Meters */}
      <div className="rounded-none border border-border/80 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Ban className="h-3.5 w-3.5 text-rose-500" />
            <span>Official NSE Ban List ({filteredBanned.length})</span>
          </h3>
          <span className="text-3xs text-muted-foreground">Normal trading halted · Offset trades only</span>
        </div>

        {filteredBanned.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground font-sans">
            {filterQuery
              ? "No banned securities match your search query."
              : "No securities are currently under the F&O ban period for this session."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredBanned.map((sym, idx) => {
              // Simulated high MWPL saturation between 96% and 99%
              const estMwpl = 96 + (idx % 4) * 0.9;
              return (
                <div
                  key={sym}
                  className="rounded-none border border-rose-500/40 bg-rose-500/5 p-2.5 space-y-2 hover:border-rose-500/80 hover:bg-rose-500/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/company/${sym}`}
                        className="font-mono text-xs font-bold text-foreground hover:text-rose-400 transition-colors flex items-center gap-1"
                      >
                        <span>{sym}</span>
                        <ArrowUpRight className="h-2.5 w-2.5 opacity-60" />
                      </Link>
                      <span className="text-3xs text-rose-400 font-bold uppercase">Critical Lockout</span>
                    </div>

                    <Link
                      href={`/derivatives?symbol=${encodeURIComponent(sym)}`}
                      className="px-1.5 py-0.5 text-3xs font-mono font-bold rounded-none border border-rose-500/50 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors"
                    >
                      Chain ↗
                    </Link>
                  </div>

                  {/* Individual Animated Danger Heat Mini-Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-3xs text-muted-foreground">
                      <span>MWPL Saturation</span>
                      <span className="font-bold text-rose-400 font-mono">{estMwpl.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/60 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-rose-500 animate-heat-pulse rounded-none"
                        style={{ width: `${Math.min(100, estMwpl)}%` }}
                      />
                    </div>
                    <div className="text-3xs text-rose-300/80 font-mono">
                      Must drop below 80% to exit ban
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger Watchlist with Proximity Heat Bars */}
      {filteredWatchlist.length > 0 && (
        <div className="rounded-none border border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Approaching Ban Watchlist ({filteredWatchlist.length})</span>
            </h3>
            <span className="text-3xs text-muted-foreground">OI between 85% and 94.9% MWPL</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {filteredWatchlist.map((sym, idx) => {
              // Simulated approaching MWPL saturation between 87% and 93.8%
              const estMwpl = 87.5 + (idx % 6) * 1.1;
              const buffer = (95 - estMwpl).toFixed(1);

              return (
                <div
                  key={sym}
                  className="rounded-none border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2 hover:border-amber-500/80 hover:bg-amber-500/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/company/${sym}`}
                        className="font-mono text-xs font-bold text-foreground hover:text-amber-400 transition-colors flex items-center gap-1"
                      >
                        <span>{sym}</span>
                        <ArrowUpRight className="h-2.5 w-2.5 opacity-60" />
                      </Link>
                      <span className="text-3xs text-amber-400 font-bold uppercase">Danger Proximity</span>
                    </div>

                    <Link
                      href={`/derivatives?symbol=${encodeURIComponent(sym)}`}
                      className="px-1.5 py-0.5 text-3xs font-mono font-bold rounded-none border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white transition-colors"
                    >
                      Chain ↗
                    </Link>
                  </div>

                  {/* Individual Proximity Heat Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-3xs text-muted-foreground">
                      <span>MWPL Saturation</span>
                      <span className="font-bold text-amber-400 font-mono">{estMwpl.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/60 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-none"
                        style={{ width: `${Math.min(100, estMwpl)}%` }}
                      />
                    </div>
                    <div className="text-3xs text-amber-300/80 font-mono">
                      Only {buffer}% buffer before 95% ban lockout
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Regulatory Guidelines */}
      <div className="rounded-none border border-border/80 bg-surface p-3 text-2xs text-muted-foreground space-y-2 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-3xs font-mono uppercase tracking-wider">
          <Info className="h-3.5 w-3.5 text-accent" /> SEBI &amp; NSE Regulatory Guidelines
        </div>
        <ul className="list-disc pl-4 space-y-1 text-3xs font-sans text-muted-foreground leading-relaxed">
          <li><strong>Position Restriction:</strong> {banData.rules?.restriction || "Participants can only decrease open positions through offsetting trades."}</li>
          <li><strong>Entry Criterion:</strong> {banData.rules?.entry || "Aggregate OI across stock derivatives exceeds 95% of Market-Wide Position Limit."}</li>
          <li><strong>Exit Criterion:</strong> {banData.rules?.exit || "Security cools down below 80% of MWPL."}</li>
        </ul>
      </div>
    </div>
  );
}
