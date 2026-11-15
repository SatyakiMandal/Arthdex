import type { ApiYieldCurveResponse } from "@/lib/api/types";

const num = (v: number, digits = 2) => v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** The quoted points joined by straight lines on a square-root time axis, so the short end is readable. */
function CurveChart({ curve }: { curve: ApiYieldCurveResponse["curve"] }) {
  const W = 720, H = 260, L = 44, R = 16, T = 16, B = 34;
  const xs = curve.map((p) => Math.sqrt(p.years));
  const ys = curve.map((p) => p.yieldPct);
  const xMax = Math.max(...xs);
  const lo = Math.floor(Math.min(...ys) * 4) / 4 - 0.25;
  const hi = Math.ceil(Math.max(...ys) * 4) / 4 + 0.25;
  const x = (v: number) => L + (v / xMax) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const path = curve.map((p, i) => `${i ? "L" : "M"}${x(xs[i]).toFixed(1)},${y(p.yieldPct).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: Math.round((hi - lo) / 0.5) + 1 }, (_, i) => lo + i * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Yield by tenor: ${curve.map((p) => `${p.tenor} ${num(p.yieldPct)}%`).join(", ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth="1" />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">{t.toFixed(1)}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="hsl(var(--accent))" strokeWidth="2" />
      {curve.map((p, i) => (
        <g key={p.tenor}>
          <circle cx={x(xs[i])} cy={y(p.yieldPct)} r="3.5" fill="hsl(var(--accent))" />
          <text x={x(xs[i])} y={H - B + 14} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{p.tenor}</text>
        </g>
      ))}
    </svg>
  );
}

export function YieldCurveDesk({ initialData }: { initialData: ApiYieldCurveResponse }) {
  const { curve, stateBonds, spreads, policyRates, asOf, shape, method } = initialData;

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h1 className="text-base font-bold uppercase tracking-wider text-foreground">Government securities yield curve</h1>
        <span className="text-3xs text-muted-foreground">CCIL indicative yields • {asOf}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="border border-border bg-surface p-3 lg:col-span-2" aria-label="Yield curve chart">
          <CurveChart curve={curve} />
          <p className="mt-1 text-3xs text-muted-foreground">{shape}. The time axis is compressed towards the long end.</p>
        </section>

        <section className="space-y-3 border border-border bg-surface p-3" aria-label="Spreads">
          <h2 className="border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">Spreads (basis points)</h2>
          <dl className="space-y-1.5 text-2xs">
            {spreads.map((s) => (
              <div key={s.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="font-bold text-foreground">{s.bps > 0 ? "+" : ""}{num(s.bps, 1)}</dd>
              </div>
            ))}
          </dl>
          {policyRates?.repo !== undefined ? (
            <p className="border-t border-border/60 pt-2 text-3xs text-muted-foreground">
              RBI policy repo rate {num(policyRates.repo)}%
              {policyRates.sdf !== undefined && policyRates.msf !== undefined ? `, corridor ${num(policyRates.sdf)}% to ${num(policyRates.msf)}%` : ""}.
            </p>
          ) : null}
        </section>
      </div>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left text-2xs">
          <caption className="sr-only">Central government securities by tenor</caption>
          <thead>
            <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
              <th className="px-2 py-1.5" scope="col">Tenor</th>
              <th className="px-2 py-1.5" scope="col">Benchmark security</th>
              <th className="px-2 py-1.5" scope="col">Type</th>
              <th className="px-2 py-1.5 text-right" scope="col">Yield</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {curve.map((p) => (
              <tr key={p.tenor}>
                <th className="px-2 py-1.5 font-bold" scope="row">{p.tenor}</th>
                <td className="px-2 py-1.5">{p.security}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{p.kind}</td>
                <td className="px-2 py-1.5 text-right font-bold">{num(p.yieldPct, 4)}%</td>
              </tr>
            ))}
            {stateBonds.map((p) => (
              <tr key={p.security} className="text-muted-foreground">
                <th className="px-2 py-1.5 font-normal" scope="row">{p.tenor}</th>
                <td className="px-2 py-1.5">{p.security}</td>
                <td className="px-2 py-1.5">State government bond</td>
                <td className="px-2 py-1.5 text-right">{num(p.yieldPct, 4)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-3xs text-muted-foreground">{method} Indicative yields are CCIL&apos;s end-of-day estimates, not traded prices.</p>
    </div>
  );
}
