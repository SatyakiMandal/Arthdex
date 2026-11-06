"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Grid,
  Maximize2,
  Minimize2,
  Columns,
  Square,
  Layers,
  Settings,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PresetWorkspace = "EQUITY_RESEARCH" | "DERIVATIVES" | "MACRO_RATES" | "RISK_SUPPLY";

interface PanelConfig {
  id: number;
  title: string;
  command: string;
  symbol: string;
  channel: "YELLOW" | "CYAN" | "EMERALD" | "MAGENTA";
  embedUrl: string;
}

const PRESET_PANELS: Record<PresetWorkspace, PanelConfig[]> = {
  EQUITY_RESEARCH: [
    { id: 1, title: "Company Overview", command: "DES", symbol: "RELIANCE", channel: "YELLOW", embedUrl: "/company/RELIANCE" },
    { id: 2, title: "10-Year Financials", command: "FA", symbol: "RELIANCE", channel: "YELLOW", embedUrl: "/company/RELIANCE/statements" },
    { id: 3, title: "Technicals & Chart", command: "GP", symbol: "RELIANCE", channel: "YELLOW", embedUrl: "/company/RELIANCE/technicals" },
    { id: 4, title: "Interactive DCF", command: "VAL", symbol: "RELIANCE", channel: "YELLOW", embedUrl: "/company/RELIANCE/valuation" },
  ],
  DERIVATIVES: [
    { id: 1, title: "NIFTY Option Chain", command: "OMON", symbol: "NIFTY", channel: "CYAN", embedUrl: "/derivatives" },
    { id: 2, title: "Strategy Payoff Lab", command: "OVLV", symbol: "NIFTY", channel: "CYAN", embedUrl: "/derivatives" },
    { id: 3, title: "Participant OI Flow", command: "PART", symbol: "GLOBAL", channel: "CYAN", embedUrl: "/orderflow" },
    { id: 4, title: "SEBI ASM/GSM Surveillance", command: "SURV", symbol: "GLOBAL", channel: "CYAN", embedUrl: "/surveillance" },
  ],
  MACRO_RATES: [
    { id: 1, title: "India Sovereign Yield Curve", command: "GC IN", symbol: "IN10Y", channel: "EMERALD", embedUrl: "/yield-curve" },
    { id: 2, title: "Macro Economic Calendar", command: "ECO", symbol: "GLOBAL", channel: "EMERALD", embedUrl: "/briefing" },
    { id: 3, title: "Forex & Rupee Monitor", command: "FXM", symbol: "USDINR", channel: "EMERALD", embedUrl: "/commodities" },
    { id: 4, title: "Sector Operating KPIs", command: "SKPI", symbol: "GLOBAL", channel: "EMERALD", embedUrl: "/sectors" },
  ],
  RISK_SUPPLY: [
    { id: 1, title: "Corporate Supply Chain Web", command: "SPLC", symbol: "M&M", channel: "MAGENTA", embedUrl: "/network?mode=splc" },
    { id: 2, title: "Conglomerate Holding Tree", command: "HOLD", symbol: "M&M", channel: "MAGENTA", embedUrl: "/network?mode=hold" },
    { id: 3, title: "Crisis Stress Testing", command: "STRS", symbol: "PORT", channel: "MAGENTA", embedUrl: "/risk-lab" },
    { id: 4, title: "Dedicated SME Board", command: "SME", symbol: "GLOBAL", channel: "MAGENTA", embedUrl: "/sme" },
  ],
};

export function TerminalWorkspaceGrid() {
  const [activePreset, setActivePreset] = useState<PresetWorkspace>("EQUITY_RESEARCH");
  const [panels, setPanels] = useState<PanelConfig[]>(PRESET_PANELS.EQUITY_RESEARCH);
  const [maximizedPanel, setMaximizedPanel] = useState<number | null>(null);
  const [activeChannelSymbol, setActiveChannelSymbol] = useState<string>("RELIANCE");

  const switchPreset = (p: PresetWorkspace) => {
    setActivePreset(p);
    setPanels(PRESET_PANELS[p]);
    setMaximizedPanel(null);
  };

  const channelColor = (ch: string) => {
    switch (ch) {
      case "YELLOW":
        return "border-accent bg-accent text-accent-foreground";
      case "CYAN":
        return "border-cyan-400 bg-cyan-400 text-black";
      case "EMERALD":
        return "border-emerald-400 bg-emerald-400 text-black";
      case "MAGENTA":
        return "border-fuchsia-400 bg-fuchsia-400 text-black";
      default:
        return "border-border bg-surface text-foreground";
    }
  };

  return (
    <div className="w-full space-y-3 font-mono text-xs">
      {/* Workspace Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold uppercase text-muted-foreground text-3xs px-1">WORKSPACE PRESET:</span>
          {(
            [
              { id: "EQUITY_RESEARCH", label: "1. EQUITY RESEARCH" },
              { id: "DERIVATIVES", label: "2. DERIVATIVES DESK" },
              { id: "MACRO_RATES", label: "3. MACRO & RATES" },
              { id: "RISK_SUPPLY", label: "4. RISK & CORPORATE WEB" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => switchPreset(preset.id)}
              className={cn(
                "px-2.5 py-1 text-3xs font-bold uppercase border transition-colors",
                activePreset === preset.id
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-surface-muted text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>CHANNEL BROADCAST: {activeChannelSymbol}</span>
          </span>
        </div>
      </div>

      {/* 4-Window Grid Layout */}
      <div
        className={cn(
          "grid gap-2 w-full",
          maximizedPanel !== null
            ? "grid-cols-1"
            : "grid-cols-1 lg:grid-cols-2 min-h-[720px]"
        )}
      >
        {panels
          .filter((p) => maximizedPanel === null || p.id === maximizedPanel)
          .map((panel) => {
            const isMax = maximizedPanel === panel.id;
            return (
              <div
                key={panel.id}
                className="border border-border bg-surface flex flex-col min-h-[360px] overflow-hidden"
              >
                {/* Panel Title Bar */}
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-surface-muted/60">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-1 py-0.5 text-[8px] font-bold border", channelColor(panel.channel))}>
                      CH-{panel.id}
                    </span>
                    <span className="font-bold text-2xs uppercase text-foreground">
                      [{panel.command}] {panel.title}
                    </span>
                    <span className="text-3xs text-muted-foreground font-normal">• {panel.symbol}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link
                      href={panel.embedUrl}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                      title="Open full page"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMaximizedPanel(isMax ? null : panel.id)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                      title={isMax ? "Restore 4-grid" : "Maximize panel"}
                    >
                      {isMax ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Panel Content Frame / Embed Preview */}
                <div className="flex-1 p-3 flex flex-col justify-between bg-surface-muted/10">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-3xs text-muted-foreground border-b border-border/40 pb-1">
                      <span>ACTIVE SUB-ROUTER: {panel.embedUrl}</span>
                      <span className="text-accent font-bold">READY</span>
                    </div>

                    <div className="p-4 border border-dashed border-border/80 bg-surface text-center space-y-2 my-auto">
                      <div className="text-xs font-bold text-foreground uppercase">
                        {panel.title} Panel Active
                      </div>
                      <p className="text-3xs text-muted-foreground max-w-sm mx-auto">
                        Displaying live telemetry and data bindings for {panel.symbol} via command <code className="text-accent">{panel.command} &lt;GO&gt;</code>.
                      </p>
                      <Link
                        href={panel.embedUrl}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-surface-muted hover:bg-accent hover:text-accent-foreground border border-border text-3xs font-bold uppercase transition-colors"
                      >
                        <span>LAUNCH DESK →</span>
                      </Link>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-3xs text-muted-foreground">
                    <span>PANEL ID #{panel.id}</span>
                    <span>CHANNEL BROADCAST ENABLED</span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
