"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";
import type { ApiOrderflow } from "@/lib/api/types";

/** Dollar value of one index point per contract. NNQ is left out: its multiplier is not confirmed. */
const POINT_VALUE: Record<string, number> = { NQ: 20, MNQ: 2, ES: 50, MES: 5 };

export function RiskPlan({ data }: { data: ApiOrderflow }) {
  const nse = data.market === "nse";
  const cur = nse ? "₹" : "$";
  const [capital, setCapital] = useState(nse ? 500000 : 50000);
  const [riskPct, setRiskPct] = useState(1);
  const [atrMult, setAtrMult] = useState(1.5);
  const [side, setSide] = useState<"long" | "short">("long");

  const atr = data.atr;
  const entry = data.lastClose;
  const multiplier = data.market === "futures" ? POINT_VALUE[data.symbol] : 1;
  const unitName = (n: number | null) => (data.market === "futures" ? (n === 1 ? "contract" : "contracts") : n === 1 ? "share" : "shares");

  if (!atr || atr <= 0) return null;

  const dist = atr * atrMult;
  const stop = side === "long" ? entry - dist : entry + dist;
  const targets = [1, 2, 3].map((r) => (side === "long" ? entry + dist * r : entry - dist * r));
  const riskBudget = (capital * riskPct) / 100;
  const sizeKnown = multiplier != null;
  const units = sizeKnown ? Math.floor(riskBudget / (dist * (multiplier as number))) : null;

  const field = "w-full rounded-md border border-border bg-surface-muted px-2 py-1 font-mono text-sm outline-none focus:border-accent/60";
  const f2 = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

  return (
    <DataCard
      title="Risk plan"
      subtitle={`Volatility-based stop and size on ${data.intervalLabel.toLowerCase()} ATR`}
      icon={ShieldAlert}
      footnote="A calculation from your inputs and the latest ATR, not a recommendation to trade. It pairs best with location from the profile and value area."
    >
      <div className="space-y-3 p-4">
        <div className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5 text-xs">
          {(["long", "short"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSide(s)} className={cn("rounded-md px-3 py-1 capitalize transition-colors", side === s ? (s === "long" ? "bg-up/15 text-up" : "bg-down/15 text-down") : "text-muted-foreground")}>
              {s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-2xs text-muted-foreground">
            Capital ({cur})
            <input type="number" min={0} value={capital} onChange={(e) => setCapital(Math.max(0, Number(e.target.value)))} className={field} />
          </label>
          <label className="text-2xs text-muted-foreground">
            Risk per trade (%)
            <input type="number" min={0.1} max={10} step={0.1} value={riskPct} onChange={(e) => setRiskPct(Math.min(10, Math.max(0.1, Number(e.target.value))))} className={field} />
          </label>
          <label className="text-2xs text-muted-foreground">
            Stop (× ATR)
            <input type="number" min={0.5} max={5} step={0.25} value={atrMult} onChange={(e) => setAtrMult(Math.min(5, Math.max(0.5, Number(e.target.value))))} className={field} />
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-sm">
          <dt className="text-muted-foreground">Entry (last close)</dt>
          <dd className="text-right">{f2(entry)}</dd>
          <dt className="text-muted-foreground">ATR (14)</dt>
          <dd className="text-right">{f2(atr)}</dd>
          <dt className="text-muted-foreground">Stop</dt>
          <dd className="text-right text-down">{f2(stop)}</dd>
          <dt className="text-muted-foreground">Risk budget</dt>
          <dd className="text-right">
            {cur}
            {f2(riskBudget)}
          </dd>
          <dt className="text-muted-foreground">Position size</dt>
          <dd className="text-right font-semibold">{units == null ? "Multiplier not confirmed" : `${units.toLocaleString("en-IN")} ${unitName(units)}`}</dd>
          {targets.map((t, i) => (
            <div key={i} className="col-span-2 flex justify-between">
              <dt className="text-muted-foreground">Target {i + 1}R</dt>
              <dd className="text-up">{f2(t)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </DataCard>
  );
}
