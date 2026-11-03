"use client";

import { useMemo, useState } from "react";
import type { ApiForensics } from "@/lib/api/types";
import { formatINR } from "@/lib/utils";

type Inputs = NonNullable<ApiForensics["reverseDcf"]>;

/** Yearly growth for `years` that makes discounted cash flows equal `value` (same model as the backend). */
function impliedGrowth(base: number, value: number, r: number, tg: number, years: number): number | null {
  if (base <= 0 || value <= 0 || r <= tg) return null;
  const pv = (g: number) => {
    let f = base;
    let sum = 0;
    for (let t = 1; t <= years; t++) {
      f *= 1 + g;
      sum += f / (1 + r) ** t;
    }
    return sum + (f * (1 + tg)) / (r - tg) / (1 + r) ** years;
  };
  let lo = -0.5;
  let hi = 1;
  if (!(pv(lo) <= value && value <= pv(hi))) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) < value) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">{value.toFixed(1)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[hsl(var(--gold))]"
      />
    </label>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

export function ReverseDcf({ inputs }: { inputs: Inputs }) {
  const [r, setR] = useState(inputs.defaults.discountRatePct);
  const [tg, setTg] = useState(inputs.defaults.terminalGrowthPct);
  const years = inputs.defaults.years;

  const fcfG = useMemo(() => impliedGrowth(inputs.fcfAverage3y, inputs.enterpriseValue, r / 100, tg / 100, years), [inputs, r, tg, years]);
  const earnG = useMemo(
    () => impliedGrowth(inputs.netIncomeLatest ?? 0, inputs.marketCap, r / 100, tg / 100, years),
    [inputs, r, tg, years],
  );
  const history = inputs.revenueCagr;
  const lowConversion = inputs.fcfToProfit != null && inputs.fcfToProfit < 0.6;

  return (
    <div className="grid gap-8 border-t border-border pt-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <div>
        <h3 className="font-sans text-sm font-semibold tracking-normal">What the price implies</h3>
        <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground">
          The growth the market is paying for: the yearly growth over the next {years} years that makes today&apos;s value equal the
          discounted cash the business would earn, with {tg.toFixed(1)}% growth after that.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <dt className="text-xs text-muted-foreground">On free cash flow</dt>
            <dd className="mt-1 font-mono text-3xl font-medium tabular-nums">{pct(fcfG)}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              {fcfG == null && inputs.fcfAverage3y <= 0
                ? "Free cash flow was negative over three years, so no growth rate equates to the price."
                : `From ₹${formatINR(inputs.fcfAverage3y, 0)} Cr average, against an EV of ₹${formatINR(inputs.enterpriseValue, 0)} Cr`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">On earnings</dt>
            <dd className="mt-1 font-mono text-3xl font-medium tabular-nums">{pct(earnG)}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              {inputs.netIncomeLatest != null ? `From ₹${formatINR(inputs.netIncomeLatest, 0)} Cr profit, against a market cap of ₹${formatINR(inputs.marketCap, 0)} Cr` : "No profit figure"}
            </dd>
          </div>
        </dl>
        {lowConversion ? (
          <p role="note" className="mt-4 text-xs text-muted-foreground">
            Free cash flow has averaged {Math.round((inputs.fcfToProfit ?? 0) * 100)}% of profit, so working capital is absorbing cash; the free-cash-flow
            figure overstates the growth needed if that reverses, and the earnings figure understates it if it does not.
          </p>
        ) : null}
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Revenue has grown </span>
          <span className="font-mono">{pct(history["3y"])}</span>
          <span className="text-muted-foreground"> a year over 3 years, </span>
          <span className="font-mono">{pct(history["5y"])}</span>
          <span className="text-muted-foreground"> over 5 and </span>
          <span className="font-mono">{pct(history["10y"])}</span>
          <span className="text-muted-foreground"> over 10.</span>
        </p>
      </div>
      <div className="space-y-5">
        <Slider label="Discount rate (cost of capital)" value={r} min={8} max={18} step={0.5} onChange={setR} />
        <Slider label="Growth after year ten" value={tg} min={2} max={Math.min(8, r - 1)} step={0.5} onChange={setTg} />
        <p className="text-xs text-muted-foreground">
          Defaults: 12% for an Indian equity (a 6.5% risk-free rate plus a market premium), 5% long-run nominal growth. Net debt ₹
          {formatINR(inputs.netDebt, 0)} Cr.
        </p>
      </div>
    </div>
  );
}
