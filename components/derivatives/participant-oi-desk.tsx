"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  Activity,
  Layers,
  BarChart3,
  Scale,
  RefreshCw,
} from "lucide-react";
import type { ApiParticipantOiResponse, ApiParticipantRecord } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface ParticipantOiDeskProps {
  initialData: ApiParticipantOiResponse;
}

export function ParticipantOiDesk({ initialData }: ParticipantOiDeskProps) {
  const [activeTab, setActiveTab] = useState<"all" | "futures" | "options">("all");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("FII");

  const {
    asOf,
    fiiIndexLongPct,
    fiiNetIndexContracts,
    clientNetIndexContracts,
    marketRegime,
    regimeTone,
    putWritingBias,
    participants,
    divergenceSignal,
  } = initialData;

  const activeParticipantRecord = participants.find((p) => p.participant === selectedParticipant) || participants[0];

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-2.5 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            PART &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            NSE F&amp;O Participant Open Interest &amp; Institutional Positioning
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Activity className="h-3 w-3 text-cyan-400" />
            Official NSE fao_participant_oi
          </span>
        </div>

        <div className="flex items-center gap-2 text-2xs">
          <span
            className={cn(
              "px-2 py-0.5 text-3xs font-bold uppercase tracking-wider border",
              regimeTone === "up" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
              regimeTone === "down" && "bg-rose-500/10 text-rose-400 border-rose-500/30",
              regimeTone === "gold" && "bg-amber-500/10 text-amber-400 border-amber-500/30",
              regimeTone === "neutral" && "bg-muted/40 text-muted-foreground border-border"
            )}
          >
            {marketRegime}
          </span>
          <span className="text-3xs text-muted-foreground">
            AS OF: {new Date(asOf).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* 2. Executive Metric Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {/* Metric 1: FII Index Futures Long % */}
        <div className="border border-border bg-card/60 p-2 relative overflow-hidden">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">FII Index Fut Long %</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                fiiIndexLongPct < 25
                  ? "text-amber-400"
                  : fiiIndexLongPct < 45
                  ? "text-rose-400"
                  : fiiIndexLongPct > 65
                  ? "text-emerald-400"
                  : "text-foreground"
              )}
            >
              {fiiIndexLongPct.toFixed(1)}%
            </span>
            <span className="text-3xs text-muted-foreground">
              {fiiIndexLongPct < 25 ? "Oversold" : fiiIndexLongPct < 45 ? "Short-Heavy" : "Balanced"}
            </span>
          </div>
          {/* Mini Range Indicator */}
          <div className="mt-1.5 h-1 w-full bg-muted/40 relative">
            <div
              className={cn(
                "h-full",
                fiiIndexLongPct < 25 ? "bg-amber-400" : fiiIndexLongPct < 45 ? "bg-rose-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, Math.max(0, fiiIndexLongPct))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: FII Net Index Futures Contracts */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">FII Net Index Futures</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                fiiNetIndexContracts < 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {fiiNetIndexContracts > 0 ? "+" : ""}
              {fiiNetIndexContracts.toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">contracts</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Index future net bias</div>
        </div>

        {/* Metric 3: Client Net Index Futures Contracts */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Client (Retail) Net Index</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                clientNetIndexContracts < 0 ? "text-rose-400" : "text-emerald-400"
              )}
            >
              {clientNetIndexContracts > 0 ? "+" : ""}
              {clientNetIndexContracts.toLocaleString("en-IN")}
            </span>
            <span className="text-3xs text-muted-foreground">contracts</span>
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Retail counter-positioning</div>
        </div>

        {/* Metric 4: Writing / Protection Balance */}
        <div className="border border-border bg-card/60 p-2">
          <div className="text-3xs uppercase tracking-wider text-muted-foreground">Institutional Option Tone</div>
          <div className="mt-1 text-xs font-bold text-cyan-400 truncate">{putWritingBias}</div>
          <div className="text-3xs text-muted-foreground mt-0.5">Pro + FII net index options</div>
        </div>
      </div>

      {/* 3. Divergence Alert Banner */}
      <div className="border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 flex items-start gap-2 text-2xs">
        <Scale className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-amber-400 uppercase tracking-wide">
            {divergenceSignal.title} ({divergenceSignal.divergenceMagnitude.toLocaleString("en-IN")} contracts gap):
          </span>
          <p className="text-3xs text-muted-foreground leading-relaxed">{divergenceSignal.description}</p>
        </div>
      </div>

      {/* 4. Tab Selector Bar */}
      <div className="flex items-center justify-between border-b border-border pb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "all"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            All Segments
          </button>
          <button
            onClick={() => setActiveTab("futures")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "futures"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Futures Breakdown
          </button>
          <button
            onClick={() => setActiveTab("options")}
            className={cn(
              "px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border transition-colors",
              activeTab === "options"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Options Calls &amp; Puts
          </button>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span>Click participant row for deep dive</span>
        </div>
      </div>

      {/* 5. Main Positioning Matrix */}
      <div className="border border-border bg-card/40 overflow-x-auto">
        <table className="w-full text-left text-2xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="py-1.5 px-2">Participant</th>
              {(activeTab === "all" || activeTab === "futures") && (
                <>
                  <th className="py-1.5 px-2 text-right">Idx Fut Long</th>
                  <th className="py-1.5 px-2 text-right">Idx Fut Short</th>
                  <th className="py-1.5 px-2 text-right">Idx Fut Net</th>
                  <th className="py-1.5 px-2 text-right">Idx L/S %</th>
                  <th className="py-1.5 px-2 text-right">Stk Fut Long</th>
                  <th className="py-1.5 px-2 text-right">Stk Fut Short</th>
                  <th className="py-1.5 px-2 text-right">Stk Fut Net</th>
                </>
              )}
              {(activeTab === "all" || activeTab === "options") && (
                <>
                  <th className="py-1.5 px-2 text-right">Idx CE Net</th>
                  <th className="py-1.5 px-2 text-right">Idx PE Net</th>
                  <th className="py-1.5 px-2 text-right">Stk CE Net</th>
                  <th className="py-1.5 px-2 text-right">Stk PE Net</th>
                </>
              )}
              <th className="py-1.5 px-2 text-left">Strategic Bias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {participants.map((p) => {
              const isSelected = p.participant === selectedParticipant;
              return (
                <tr
                  key={p.participant}
                  onClick={() => setSelectedParticipant(p.participant)}
                  className={cn(
                    "cursor-pointer hover:bg-muted/40 transition-colors",
                    isSelected ? "bg-muted/30 font-semibold" : ""
                  )}
                >
                  <td className="py-1.5 px-2 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-none",
                          p.participant === "FII"
                            ? "bg-amber-400"
                            : p.participant === "DII"
                            ? "bg-blue-400"
                            : p.participant === "Pro"
                            ? "bg-cyan-400"
                            : "bg-emerald-400"
                        )}
                      />
                      <span className="font-bold text-foreground">{p.participant}</span>
                      <span className="text-3xs text-muted-foreground hidden md:inline">({p.label})</span>
                    </div>
                  </td>

                  {(activeTab === "all" || activeTab === "futures") && (
                    <>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {p.indexFutures.long.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {p.indexFutures.short.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums font-bold",
                          p.indexFutures.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.indexFutures.net > 0 ? "+" : ""}
                        {p.indexFutures.net.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {p.indexFutures.longPct.toFixed(1)}%
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {p.stockFutures.long.toLocaleString("en-IN")}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                        {p.stockFutures.short.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums font-bold",
                          p.stockFutures.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.stockFutures.net > 0 ? "+" : ""}
                        {p.stockFutures.net.toLocaleString("en-IN")}
                      </td>
                    </>
                  )}

                  {(activeTab === "all" || activeTab === "options") && (
                    <>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums font-medium",
                          p.indexCalls.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.indexCalls.net > 0 ? "+" : ""}
                        {p.indexCalls.net.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums font-medium",
                          p.indexPuts.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.indexPuts.net > 0 ? "+" : ""}
                        {p.indexPuts.net.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums",
                          p.stockCalls.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.stockCalls.net > 0 ? "+" : ""}
                        {p.stockCalls.net.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={cn(
                          "py-1.5 px-2 text-right font-mono tabular-nums",
                          p.stockPuts.net > 0 ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {p.stockPuts.net > 0 ? "+" : ""}
                        {p.stockPuts.net.toLocaleString("en-IN")}
                      </td>
                    </>
                  )}

                  <td className="py-1.5 px-2 text-3xs text-muted-foreground truncate max-w-[280px]">
                    {p.netIndexBias}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 6. Participant Deep Dive Panel */}
      <div className="border border-border bg-card/60 p-2.5 space-y-2">
        <div className="flex items-center justify-between border-b border-border pb-1">
          <div className="flex items-center gap-2">
            <span className="text-3xs uppercase font-bold text-amber-500 tracking-wider">SELECTED DOSSIER:</span>
            <span className="text-xs font-bold text-foreground">
              {activeParticipantRecord.participant} — {activeParticipantRecord.label}
            </span>
          </div>
          <span className="text-3xs text-muted-foreground uppercase tracking-wide">
            Tone: {activeParticipantRecord.tone.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-2xs">
          <div className="border border-border/60 bg-muted/10 p-2">
            <div className="text-3xs uppercase text-muted-foreground">Index Futures Exposure</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-bold font-mono">
                {activeParticipantRecord.indexFutures.longPct.toFixed(1)}% Long
              </span>
              <span
                className={cn(
                  "font-mono font-bold",
                  activeParticipantRecord.indexFutures.net >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {activeParticipantRecord.indexFutures.net >= 0 ? "+" : ""}
                {activeParticipantRecord.indexFutures.net.toLocaleString("en-IN")} net
              </span>
            </div>
            <p className="text-3xs text-muted-foreground mt-1">
              Longs: {activeParticipantRecord.indexFutures.long.toLocaleString("en-IN")} | Shorts:{" "}
              {activeParticipantRecord.indexFutures.short.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="border border-border/60 bg-muted/10 p-2">
            <div className="text-3xs uppercase text-muted-foreground">Index Options Exposure</div>
            <div className="mt-1 space-y-0.5 font-mono">
              <div className="flex justify-between">
                <span>Calls Net:</span>
                <span className={activeParticipantRecord.indexCalls.net >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {activeParticipantRecord.indexCalls.net >= 0 ? "+" : ""}
                  {activeParticipantRecord.indexCalls.net.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Puts Net:</span>
                <span className={activeParticipantRecord.indexPuts.net >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {activeParticipantRecord.indexPuts.net >= 0 ? "+" : ""}
                  {activeParticipantRecord.indexPuts.net.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-border/60 bg-muted/10 p-2">
            <div className="text-3xs uppercase text-muted-foreground">Strategic Positioning Summary</div>
            <p className="text-3xs text-foreground mt-1 leading-relaxed">
              {activeParticipantRecord.netIndexBias}
            </p>
          </div>
        </div>
      </div>

      {/* 7. Quick Terminal Function Navigators */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">RELATED TERMINAL WORKBENCHES:</span>
          <Link href="/derivatives?symbol=NIFTY" className="text-cyan-400 hover:underline">
            OMON &lt;GO&gt; (Option Chain)
          </Link>
          <Link href="/strategy-builder?symbol=NIFTY" className="text-cyan-400 hover:underline">
            OSB &lt;GO&gt; (Strategy Builder)
          </Link>
          <Link href="/volatility?symbol=NIFTY" className="text-cyan-400 hover:underline">
            OVDV &lt;GO&gt; (Vol Surface)
          </Link>
          <Link href="/surveillance" className="text-cyan-400 hover:underline">
            SURV &lt;GO&gt; (Surveillance)
          </Link>
        </div>

        <div>
          <span>NSE Clearing participant report (T+0 Daily at 18:30 IST)</span>
        </div>
      </div>
    </div>
  );
}
