"use client";

import Link from "next/link";
import { AlertTriangle, Ban, Info, ShieldAlert, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiFnoBan } from "@/lib/api/types";

export function FnoBanTracker({
  banData,
}: {
  banData: ApiFnoBan;
}) {
  const banned = banData.bannedSymbols ?? [];
  const watchlist = banData.dangerWatchlist ?? [];

  return (
    <div className="space-y-6">
      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <div className="flex items-center justify-between text-2xs text-rose-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Ban className="h-4 w-4" /> Securities in Ban Period
            </span>
            <span className="font-mono text-sm font-bold">{banData.bannedCount}</span>
          </div>
          <div className="mt-3 text-3xs text-rose-300/80">
            Normal trading halted. Participants can only decrease open positions through offsetting trades.
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center justify-between text-2xs text-amber-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> MWPL Ban Threshold
            </span>
            <span className="font-mono text-sm font-bold">{banData.mwplThreshold}</span>
          </div>
          <div className="mt-3 text-3xs text-amber-300/80">
            A security enters the ban list when Aggregate Open Interest reaches 95% of its Market Wide Position Limit.
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
          <div className="flex items-center justify-between text-2xs text-blue-400">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> MWPL Exit Threshold
            </span>
            <span className="font-mono text-sm font-bold">{banData.exitThreshold}</span>
          </div>
          <div className="mt-3 text-3xs text-blue-300/80">
            Security exits the ban period only after aggregate OI cools down below 80% of MWPL.
          </div>
        </div>
      </div>

      {/* Banned Securities Grid */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Ban className="h-4 w-4 text-rose-500" /> Official NSE Ban List ({banned.length})
          </h3>
          <span className="text-2xs font-mono text-muted-foreground">Session: {banData.tradeDate}</span>
        </div>

        {banned.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground font-sans">
            No securities are currently under the F&amp;O ban period for this session.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {banned.map((sym) => (
              <Link
                key={sym}
                href={`/company/${sym}`}
                className="group flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-foreground group-hover:text-rose-400 transition-colors">
                    {sym}
                  </div>
                  <div className="text-3xs text-rose-400/80 font-mono mt-0.5">&gt;95% MWPL</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-rose-400 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Danger Watchlist */}
      {watchlist.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Approaching Ban Watchlist ({watchlist.length})
            </h3>
            <span className="text-3xs text-muted-foreground">OI between 85% and 94% MWPL</span>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {watchlist.map((sym) => (
              <Link
                key={sym}
                href={`/company/${sym}`}
                className="group flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 hover:border-amber-500/60 hover:bg-amber-500/10 transition-colors"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-foreground group-hover:text-amber-400 transition-colors">
                    {sym}
                  </div>
                  <div className="text-3xs text-amber-400/80 font-mono mt-0.5">High Danger</div>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-amber-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory Rules Footer */}
      <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2 font-sans">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-2xs uppercase tracking-wider">
          <Info className="h-3.5 w-3.5 text-primary" /> SEBI &amp; NSE Regulatory Guidelines
        </div>
        <ul className="list-disc pl-4 space-y-1 text-2xs">
          <li><strong>Position Restriction:</strong> {banData.rules?.restriction}</li>
          <li><strong>Entry Criterion:</strong> {banData.rules?.entry}</li>
          <li><strong>Exit Criterion:</strong> {banData.rules?.exit}</li>
        </ul>
      </div>
    </div>
  );
}
