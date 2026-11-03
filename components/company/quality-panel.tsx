import type { ApiForensics } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ReverseDcf } from "./reverse-dcf";

const BENEISH_WORDS: Record<string, string> = {
  DSRI: "receivables growing faster than sales",
  GMI: "gross margin falling",
  AQI: "more assets that are neither current nor fixed",
  SGI: "fast sales growth",
  DEPI: "depreciation slowing",
  SGAI: "overheads growing faster than sales",
  LVGI: "leverage rising",
  TATA: "profit running ahead of cash flow",
};

function Score({ label, value, verdict, tone, children }: { label: string; value: string; verdict: string; tone: "up" | "down" | "flat"; children?: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-medium tabular-nums">{value}</p>
      <p className={cn("mt-1 text-sm", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted-foreground")}>{verdict}</p>
      {children}
    </div>
  );
}

export function QualityPanel({ data }: { data: ApiForensics }) {
  if (data.withheld) {
    return <p className="max-w-[70ch] text-sm text-muted-foreground">{data.withheld}</p>;
  }
  if (data.lender) {
    return <p className="max-w-[70ch] text-sm text-muted-foreground">{data.note}</p>;
  }
  const f = data.piotroski;
  const z = data.altman;
  const m = data.beneish;
  const cc = data.cashConversion;
  // The two or three indices pushing the M-score up most, in words
  const drivers = m
    ? Object.entries(m.indices)
        .filter(([k, v]) => (k === "TATA" ? v > 0.03 : k === "SGAI" || k === "LVGI" ? false : v > 1.1))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => BENEISH_WORDS[k])
    : [];

  return (
    <div className="space-y-10">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {f ? (
          <Score
            label="Piotroski F-score"
            value={`${f.score} of ${f.of}`}
            verdict={f.score >= 7 ? "Fundamentals improving" : f.score <= 3 ? "Fundamentals weakening" : "Mixed"}
            tone={f.score >= 7 ? "up" : f.score <= 3 ? "down" : "flat"}
          >
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground underline decoration-border underline-offset-4">The nine tests</summary>
              <ul className="mt-2 space-y-1">
                {f.signals.map((s) => (
                  <li key={s.test} className="flex gap-2">
                    <span className={cn("font-mono", s.pass === true ? "text-up" : s.pass === false ? "text-down" : "text-muted-foreground")}>
                      {s.pass === true ? "✓" : s.pass === false ? "✗" : "–"}
                    </span>
                    <span>{s.test}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Score>
        ) : null}
        {z ? (
          <Score
            label="Altman Z-score"
            value={z.z.toFixed(2)}
            verdict={z.zone === "safe" ? "Above 2.99: low distress risk" : z.zone === "grey" ? "1.81 to 2.99: grey zone" : "Below 1.81: distress zone"}
            tone={z.zone === "safe" ? "up" : z.zone === "distress" ? "down" : "flat"}
          />
        ) : null}
        {m ? (
          <Score
            label="Beneish M-score"
            value={m.m.toFixed(2)}
            verdict={m.flag ? "Above −1.78: worth a closer look" : "Below −1.78: no flag"}
            tone={m.flag ? "down" : "up"}
          >
            {m.flag && drivers.length ? (
              <p className="mt-2 text-xs text-muted-foreground">Driven by {drivers.join(", ")}. A screen, not a finding: project businesses with large advances often trip it.</p>
            ) : null}
          </Score>
        ) : null}
        {cc ? (
          <Score
            label={`Cash conversion, ${cc.years} years`}
            value={`${cc.ratio.toFixed(2)}x`}
            verdict={cc.ratio >= 0.9 ? "Profit is turning into cash" : cc.ratio >= 0.5 ? "Some profit is tied up" : "Little profit is turning into cash"}
            tone={cc.ratio >= 0.9 ? "up" : cc.ratio >= 0.5 ? "flat" : "down"}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Computed from Yahoo Finance line items for the years to {data.years.join(", ")}, after their revenue, profit and total assets were checked against
        the vetted figures ({data.vetting.checks.filter((c) => c.agree).length} of {data.vetting.checks.length} agree). Altman&apos;s original model is calibrated on
        listed manufacturers. Money in ₹ crore.
      </p>

      {data.reverseDcf ? <ReverseDcf inputs={data.reverseDcf} /> : null}
    </div>
  );
}

