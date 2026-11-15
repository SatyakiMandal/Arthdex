import { cn } from "@/lib/utils";
import type { ApiMacroDashboardResponse } from "@/lib/api/types";

const DASH = "—";
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;

const RATE_LABELS: [string, string][] = [
  ["repo", "Policy repo rate"],
  ["sdf", "Standing deposit facility"],
  ["msf", "Marginal standing facility"],
  ["bankRate", "Bank rate"],
  ["reverseRepo", "Fixed reverse repo"],
  ["crr", "Cash reserve ratio"],
  ["slr", "Statutory liquidity ratio"],
];

export function MacroEconomicDesk({ initialData }: { initialData: ApiMacroDashboardResponse }) {
  const { indicators, policyRates, unavailable } = initialData;

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h1 className="text-base font-bold uppercase tracking-wider text-foreground">India macro indicators</h1>
        <span className="text-3xs text-muted-foreground">MOSPI and RBI figures as published; each shows the period it covers</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {indicators.map((ind) => (
          <section key={ind.id} className="border border-border bg-surface p-3" aria-label={ind.label}>
            <h2 className="text-3xs font-bold uppercase text-muted-foreground">{ind.label}</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{num(ind.value)}%</span>
              <span className="text-3xs text-muted-foreground">{ind.unit.replace("% ", "")}</span>
            </div>
            <p className="text-3xs text-accent">{ind.period}</p>
            <p className="mt-1 text-3xs text-muted-foreground">
              Previous: {ind.previous === null ? DASH : `${num(ind.previous)}%`} • {ind.detail}
            </p>
            <table className="mt-2 w-full text-left text-3xs">
              <caption className="sr-only">{ind.label}, recent periods</caption>
              <tbody className="divide-y divide-border/40">
                {ind.series.slice(-6).reverse().map((point) => {
                  const value = point.inflationPct ?? point.growthPct ?? null;
                  return (
                    <tr key={point.period}>
                      <th className="py-0.5 font-normal text-muted-foreground" scope="row">{point.period}</th>
                      <td className={cn("py-0.5 text-right", value === null ? "text-muted-foreground" : "text-foreground")}>{value === null ? DASH : `${num(value)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-3xs text-muted-foreground">Source: {ind.source}</p>
          </section>
        ))}
      </div>

      {policyRates ? (
        <section className="border border-border bg-surface p-3" aria-label="RBI policy rates">
          <h2 className="border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">Reserve Bank of India: current rates</h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-2xs sm:grid-cols-4 lg:grid-cols-7">
            {RATE_LABELS.filter(([key]) => typeof policyRates[key] === "number").map(([key, label]) => (
              <div key={key}>
                <dt className="text-3xs uppercase text-muted-foreground">{label}</dt>
                <dd className="text-sm font-bold text-foreground">{num(policyRates[key])}%</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-3xs text-muted-foreground">Read from the rates panel on rbi.org.in.</p>
        </section>
      ) : null}

      <div className="space-y-1 text-3xs text-muted-foreground">
        <p className="font-bold uppercase">Not shown</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {Object.values(unavailable).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
