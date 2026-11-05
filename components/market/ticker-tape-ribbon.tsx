"use client";

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiIndex } from "@/lib/api/types";

interface TickerTapeRibbonProps {
  indices?: ApiIndex[];
}

const BENCHMARKS = [
  { id: "nifty-50", label: "NIFTY 50", short: "N50" },
  { id: "bank-nifty", label: "BANK NIFTY", short: "BN" },
  { id: "india-vix", label: "INDIA VIX", short: "VIX", isVol: true },
  { id: "nifty-it", label: "NIFTY IT", short: "IT" },
  { id: "nifty-auto", label: "NIFTY AUTO", short: "AUTO" },
  { id: "nifty-metal", label: "NIFTY METAL", short: "METAL" },
  { id: "nifty-midcap-100", label: "NIFTY MIDCAP", short: "MID" },
  { id: "nifty-smallcap-100", label: "NIFTY SMALLCAP", short: "SML" },
];

export function TickerTapeRibbon({ indices = [] }: TickerTapeRibbonProps) {
  const indexMap = useMemo(() => {
    const map = new Map<string, ApiIndex>();
    indices.forEach((i) => map.set(i.id, i));
    return map;
  }, [indices]);

  return (
    <div className="w-full border border-border bg-surface font-mono text-2xs overflow-x-auto no-scrollbar rounded-none shadow-xs">
      <div className="flex items-center divide-x divide-border/80 min-w-max">
        <div className="px-2.5 py-1 bg-surface-muted/60 text-3xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>TAPE</span>
        </div>

        {BENCHMARKS.map((b) => {
          const item = indexMap.get(b.id);
          const level = item?.level;
          const changePct = item?.change?.percent ?? 0;
          const changeAbs = item?.change?.absolute ?? 0;
          const isUp = changePct > 0;
          const isDown = changePct < 0;

          return (
            <div
              key={b.id}
              className="px-2.5 py-1 flex items-center gap-2 hover:bg-surface-muted/50 transition-colors shrink-0"
            >
              <span className="text-3xs font-bold text-muted-foreground">{b.short}</span>
              <span className="font-extrabold text-foreground text-3xs">
                {level ? level.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : "—"}
              </span>
              <span
                className={cn(
                  "flex items-center text-3xs font-bold px-1 py-0.2 rounded-none",
                  b.isVol
                    ? isUp
                      ? "text-down bg-down/10"
                      : "text-up bg-up/10"
                    : isUp
                      ? "text-up bg-up/10"
                      : isDown
                        ? "text-down bg-down/10"
                        : "text-muted-foreground bg-surface-muted",
                )}
              >
                {isUp ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
