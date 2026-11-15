import type { ApiYieldCurveResponse, ApiYieldTenor } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const CORRIDOR: { key: keyof ApiYieldCurveResponse["rbiCorridor"]; label: string }[] = [
  { key: "repoRate", label: "Policy repo rate" },
  { key: "sdfRate", label: "Standing deposit facility" },
  { key: "msfRate", label: "Marginal standing facility" },
  { key: "bankRate", label: "Bank rate" },
  { key: "reverseRepoRate", label: "Fixed reverse repo" },
  { key: "crrPct", label: "Cash reserve ratio" },
  { key: "slrPct", label: "Statutory liquidity ratio" },
];

const W = 900;
const H = 300;
const PAD = { l: 44, r: 16, t: 16, b: 34 };

/** The RBI's published points only, joined by straight lines: no fitted or interpolated tenors. */
function Curve({ tenors, repo }: { tenors: ApiYieldTenor[]; repo: number | undefined }) {
  const ys = tenors.map((t) => t.yieldPct).concat(repo != null ? [repo] : []);
  const lo = Math.floor(Math.min(...ys) * 4) / 4 - 0.25;
  const hi = Math.ceil(Math.max(...ys) * 4) / 4 + 0.25;
  const maxYears = Math.max(...tenors.map((t) => t.years));
  // Square-root scale on maturity so the T-bills are not crushed against the axis
  const x = (years: number) => PAD.l + (Math.sqrt(years) / Math.sqrt(maxYears)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo * 2) / 2; v <= hi; v += 0.5) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Government bond yields by maturity, as published by the RBI">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="hsl(var(--border))" strokeDasharray="2 4" />
          <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
            {v.toFixed(1)}%
          </text>
        </g>
      ))}
      {repo != null ? (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(repo)} y2={y(repo)} stroke="hsl(var(--gold))" strokeWidth={1} />
          <text x={W - PAD.r} y={y(repo) - 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
            Repo {repo.toFixed(2)}%
          </text>
        </g>
      ) : null}
      <polyline
        points={tenors.map((t) => `${x(t.years)},${y(t.yieldPct)}`).join(" ")}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      {tenors.map((t) => (
        <g key={t.tenor}>
          <circle cx={x(t.years)} cy={y(t.yieldPct)} r={3.5} className={t.category === "T-Bill" ? "fill-muted-foreground" : "fill-foreground"} />
          <text x={x(t.years)} y={y(t.yieldPct) - 8} textAnchor="middle" className="fill-foreground font-mono text-[10px]">
            {t.yieldPct.toFixed(2)}
          </text>
          <text x={x(t.years)} y={H - PAD.b + 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            {t.tenor}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Change({ c }: { c: ApiYieldTenor["history"]["1w"] }) {
  if (!c) return <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">—</td>;
  return (
    <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", c.changeBps > 0 ? "text-down" : c.changeBps < 0 ? "text-up" : "")} title={`From ${c.yieldPct.toFixed(4)}% on ${c.asOf}`}>
      {c.changeBps > 0 ? "+" : ""}
      {c.changeBps.toFixed(1)} bps
    </td>
  );
}

export function YieldCurveDesk({ initialData: d }: { initialData: ApiYieldCurveResponse }) {
  const noHistory = d.tenors.every((t) => !t.history["1w"] && !t.history["1m"] && !t.history["1y"]);

  return (
    <div className="space-y-6 py-3">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Government bond yields</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The RBI&apos;s benchmark G-sec yields and T-bill cut-offs as on {d.asOf}, with the policy corridor.
          </p>
        </div>
        {d.benchmark ? (
          <p className="font-mono text-sm">
            <span className="text-muted-foreground">{d.benchmark.paper} </span>
            <span className="text-lg font-semibold">{d.benchmark.yieldPct.toFixed(4)}%</span>
          </p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <section aria-labelledby="curve">
          <h2 id="curve" className="text-sm font-semibold">The curve</h2>
          <div className="mt-3">
            <Curve tenors={d.tenors} repo={d.rbiCorridor.repoRate} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Eight points, exactly as the RBI publishes them: three T-bills and five benchmark government securities. Maturity is plotted on a
            square-root scale; lines between points are drawn straight, not fitted.
          </p>
        </section>

        <section aria-labelledby="corridor" className="space-y-6">
          <div>
            <h2 id="corridor" className="text-sm font-semibold">RBI policy corridor</h2>
            <dl className="mt-3 divide-y divide-border/60 text-sm">
              {CORRIDOR.filter((c) => d.rbiCorridor[c.key] != null).map((c) => (
                <div key={c.key} className="flex justify-between py-1.5">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="font-mono tabular-nums">{d.rbiCorridor[c.key]!.toFixed(2)}%</dd>
                </div>
              ))}
            </dl>
          </div>
          {d.spreads.length ? (
            <div>
              <h2 className="text-sm font-semibold">Spreads</h2>
              <dl className="mt-3 divide-y divide-border/60 text-sm">
                {d.spreads.map((s) => (
                  <div key={`${s.long}-${s.short}`} className="flex justify-between gap-3 py-1.5">
                    <dt className="text-muted-foreground">
                      {s.long} over {s.short}
                    </dt>
                    <dd className={cn("shrink-0 font-mono tabular-nums", s.bps < 0 && "text-down")}>{s.bps.toFixed(1)} bps</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="papers">
        <h2 id="papers" className="text-sm font-semibold">By paper</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 text-left font-medium">Paper</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Years left</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Yield</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">1 week</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">1 month</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">1 year</th>
              </tr>
            </thead>
            <tbody>
              {d.tenors.map((t) => (
                <tr key={t.tenor} className="border-b border-border/60">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal">
                    {t.paper}
                  </th>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                    {t.category === "T-Bill" ? t.years.toFixed(2) : `~${t.years}`}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">{t.yieldPct.toFixed(4)}%</td>
                  <Change c={t.history["1w"]} />
                  <Change c={t.history["1m"]} />
                  <Change c={t.history["1y"]} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {noHistory
            ? `Changes appear once Arthdex has its own earlier snapshot to compare with (${d.historyDays} day${d.historyDays === 1 ? "" : "s"} recorded so far); none are back-filled.`
            : "Changes are measured from Arthdex's own earlier snapshots of the same RBI figures."}{" "}
          The RBI gives each G-sec&apos;s maturity year, so years left is approximate. State loans and corporate bonds have no free published
          yields, so no spreads over them are shown.
        </p>
      </section>
    </div>
  );
}
