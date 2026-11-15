"use client";

import { useMemo, useState } from "react";
import type { ApiDcfDefaults } from "@/lib/api/types";
import { cn, formatINR } from "@/lib/utils";

const YEARS = 5;

/** Equity value per share for a two-stage FCFF model: five years of growth, then Gordon growth. */
function perShare(i: { fcf: number; g: number; tg: number; wacc: number; netDebt: number; shares: number }): number | null {
  if (i.wacc <= i.tg || i.shares <= 0) return null;
  let pv = 0;
  let f = i.fcf;
  for (let t = 1; t <= YEARS; t++) {
    f *= 1 + i.g;
    pv += f / (1 + i.wacc) ** t;
  }
  const tv = (f * (1 + i.tg)) / (i.wacc - i.tg) / (1 + i.wacc) ** YEARS;
  return (pv + tv - i.netDebt) / i.shares;
}

/** The stage-one growth that makes the model's value equal today's price, by bisection. */
function impliedGrowth(target: number, base: Omit<Parameters<typeof perShare>[0], "g">): number | null {
  let lo = -0.5;
  let hi = 1.0;
  const at = (g: number) => perShare({ ...base, g });
  const vLo = at(lo);
  const vHi = at(hi);
  if (vLo == null || vHi == null || !(vLo <= target && target <= vHi)) return null;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if ((at(mid) ?? 0) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function Slider({ label, source, value, min, max, step, onChange }: { label: string; source: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(2)}%</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[hsl(var(--gold))]" />
      <span className="text-3xs text-muted-foreground">{source}</span>
    </label>
  );
}

export function DcfWorkbench({ inputs: d }: { inputs: ApiDcfDefaults }) {
  const [g, setG] = useState(d.stage1_growth_rate * 100);
  const [tg, setTg] = useState(d.terminal_growth_rate * 100);
  const [erp, setErp] = useState(d.equity_risk_premium * 100);
  const [kd, setKd] = useState(d.pretax_cost_of_debt * 100);

  const tax = 0.2517;
  const rf = d.risk_free_rate;
  const costOfEquity = rf + d.beta * (erp / 100);
  const debtWeight = d.debt_to_equity / (1 + d.debt_to_equity);
  const wacc = (1 - debtWeight) * costOfEquity + debtWeight * (kd / 100) * (1 - tax);
  const netDebt = d.total_debt_cr - d.cash_and_equivalents_cr;
  const base = { fcf: d.base_fcff_cr, tg: tg / 100, wacc, netDebt, shares: d.shares_outstanding_cr };
  const value = perShare({ ...base, g: g / 100 });
  const implied = useMemo(() => impliedGrowth(d.current_price, base), [d.current_price, base.fcf, base.tg, base.wacc, base.netDebt, base.shares]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = [-1, -0.5, 0, 0.5, 1].map((dw) => ({
    w: wacc + dw / 100,
    cells: [-1, -0.5, 0, 0.5, 1].map((dg) => perShare({ ...base, g: g / 100, wacc: wacc + dw / 100, tg: tg / 100 + dg / 100 })),
  }));

  const facts: [string, string, string][] = [
    ["Price", `₹${formatINR(d.current_price)}`, d.sources.current_price],
    ["Shares", `${formatINR(d.shares_outstanding_cr, 2)} Cr`, d.sources.shares_outstanding_cr],
    ["Free cash flow", `₹${formatINR(d.base_fcff_cr, 0)} Cr`, d.sources.base_fcff_cr],
    ["Debt", `₹${formatINR(d.total_debt_cr, 0)} Cr`, d.sources.total_debt_cr],
    ["Cash", `₹${formatINR(d.cash_and_equivalents_cr, 0)} Cr`, d.sources.cash_and_equivalents_cr],
    ["Beta", d.beta.toFixed(2), d.sources.beta],
    ["Risk-free rate", `${(rf * 100).toFixed(2)}%`, d.sources.risk_free_rate],
  ];

  return (
    <div className="space-y-6 text-sm">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="dcf-inputs">
          <h2 id="dcf-inputs" className="text-sm font-semibold">Inputs from the record</h2>
          <dl className="mt-3 divide-y divide-border/60">
            {facts.map(([k, v, src]) => (
              <div key={k} className="py-1.5">
                <div className="flex justify-between gap-3">
                  <dt>{k}</dt>
                  <dd className="font-mono tabular-nums">{v}</dd>
                </div>
                <p className="text-3xs text-muted-foreground">{src}</p>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="dcf-assumptions" className="space-y-4">
          <h2 id="dcf-assumptions" className="text-sm font-semibold">Assumptions, yours to change</h2>
          <Slider label="Growth, years 1 to 5" source={d.sources.stage1_growth_rate} value={g} min={-20} max={40} step={0.5} onChange={setG} />
          <Slider label="Growth after year 5" source={d.sources.terminal_growth_rate} value={tg} min={0} max={8} step={0.25} onChange={setTg} />
          <Slider label="Equity risk premium" source={d.sources.equity_risk_premium} value={erp} min={3} max={10} step={0.25} onChange={setErp} />
          <Slider label="Pre-tax cost of debt" source={d.sources.pretax_cost_of_debt} value={kd} min={5} max={15} step={0.25} onChange={setKd} />
          <p className="text-xs text-muted-foreground">
            Cost of equity {(costOfEquity * 100).toFixed(2)}% (risk-free + beta × premium) · debt weight {(debtWeight * 100).toFixed(1)}% at market value · tax 25.17%
            (Section 115BAA) · WACC <span className="font-mono text-foreground">{(wacc * 100).toFixed(2)}%</span>
          </p>
        </section>
      </div>

      <section aria-labelledby="dcf-result" className="border-t border-foreground/70 pt-3">
        <h2 id="dcf-result" className="text-sm font-semibold">What the model gives</h2>
        {value == null ? (
          <p className="mt-2 text-sm text-muted-foreground">No value: growth after year 5 must be below the WACC.</p>
        ) : value <= 0 ? (
          <p className="mt-2 text-sm">
            On these inputs the cash flows are worth less than the net debt of ₹{formatINR(netDebt, 0)} Cr, so the model leaves nothing for shareholders. The
            trailing free cash flow may be unusually low against investment; change the growth assumption to see what the price needs.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            <span className="font-mono text-2xl font-semibold tabular-nums">₹{formatINR(value)}</span>
            <span className="text-muted-foreground"> a share, against ₹{formatINR(d.current_price)} today </span>
            <span className={cn("font-mono", value >= d.current_price ? "text-up" : "text-down")}>({(((value - d.current_price) / d.current_price) * 100).toFixed(1)}%)</span>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {implied != null
            ? `Today's price implies ${(implied * 100).toFixed(1)}% a year of free-cash-flow growth over the next five years, on the same WACC and terminal growth.`
            : "No growth rate between −50% and 100% a year makes the model equal today's price on these assumptions."}{" "}
          A model, not a target: the value moves with every assumption above.
        </p>
      </section>

      <section aria-labelledby="dcf-grid">
        <h2 id="dcf-grid" className="text-sm font-semibold">Value a share as WACC and terminal growth change</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-1 pr-2 text-left font-medium">WACC \ g</th>
                {[-1, -0.5, 0, 0.5, 1].map((dg) => (
                  <th key={dg} scope="col" className="px-2 py-1 text-right font-medium">{(tg + dg).toFixed(2)}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row) => (
                <tr key={row.w} className="border-b border-border/50">
                  <th scope="row" className="py-1 pr-2 text-left font-normal">{(row.w * 100).toFixed(2)}%</th>
                  {row.cells.map((v, i) => (
                    <td key={i} className={cn("px-2 py-1 text-right tabular-nums", v == null || v <= 0 ? "text-muted-foreground" : v >= d.current_price ? "text-up" : "text-down")}>
                      {v == null ? "—" : v <= 0 ? "below 0" : formatINR(v, 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
