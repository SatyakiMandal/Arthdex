import { cn, deltaColor } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { Pill, dash, frac, inr, num, pct, stanceTone } from "./shared";

function Tile({ label, value, sub, tone, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string; className?: string }) {
  return (
    <div className={cn("min-w-0 border-l border-border/70 px-3 py-1.5 first:border-l-0", className)}>
      <p className="truncate text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate font-mono text-sm font-semibold leading-tight tabular-nums", tone)}>{value}</p>
      {sub ? <p className="truncate font-mono text-[0.625rem] leading-tight text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** The figures an analyst scans first, on one always-visible strip above the dossier tabs. */
export function KeyStrip({ s }: { s: ListedSummary }) {
  const v = s.verdict;
  const tiles: React.ReactNode[] = [];

  if (v) {
    tiles.push(
      <div key="call" className="col-span-2 flex min-w-0 flex-col justify-center gap-1 px-3 py-1.5">
        <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Call</p>
        {v.call ? <Pill label={v.call} tone={stanceTone(v.call)} /> : dash}
      </div>,
      <Tile key="conv" label="Conviction" value={`${num(v.conviction, 1)}`} sub="of 100" />,
      <Tile key="px" label="Price" value={inr(v.price)} />,
      <Tile key="entry" label="Entry zone" value={v.entryLow != null ? `${num(v.entryLow, 0)}–${num(v.entryHigh, 0)}` : dash} />,
      <Tile key="t1" label="Target 1" value={inr(v.target1, 0)} sub={pct(v.target1Pct, 1)} tone="text-up" />,
      <Tile key="t2" label="Target 2" value={inr(v.target2, 0)} sub={pct(v.target2Pct, 1)} tone="text-up" />,
      <Tile key="stop" label="Stop" value={inr(v.stop, 0)} sub={v.stopPct != null ? `−${v.stopPct.toFixed(1)}%` : undefined} tone="text-down" />,
      <Tile key="rr" label="Risk / reward" value={v.riskReward ?? dash} />,
    );
  }
  tiles.push(
    <Tile key="tech" label="Technical" value={s.technical.rating ?? dash} sub={s.technical.score != null ? `score ${num(s.technical.score, 0)}` : undefined} tone={s.technical.score != null ? deltaColor(s.technical.score) : undefined} />,
    <Tile key="rsi" label="RSI · ADX" value={`${num(s.technical.rsi, 0)} · ${num(s.technical.adx, 0)}`} />,
    <Tile key="val" label="P/E · P/B" value={`${num(s.fundamental.pe, 1)} · ${num(s.fundamental.pb, 1)}`} sub={s.fundamental.evEbitda != null ? `EV/EBITDA ${num(s.fundamental.evEbitda, 1)}` : undefined} />,
    <Tile key="vol" label="Volatility" value={frac(s.risk.consensusVol ?? s.risk.annualisedVol, 1)} sub="annualised" />,
    <Tile key="var" label="1-day VaR 95" value={frac(s.risk.var1d95.historical, 2)} tone="text-down" />,
    <Tile key="beta" label="Beta · R²" value={`${num(s.market.beta, 2)} · ${num(s.market.rSquared, 2)}`} />,
    <Tile key="dd" label="Dist. to default" value={s.risk.distanceToDefault != null ? `${s.risk.distanceToDefault.toFixed(1)}σ` : dash} />,
    <Tile key="reg" label="Regime" value={(s.risk.regime ?? dash).split("(")[0]} sub={s.risk.regimeProbability != null ? `${(s.risk.regimeProbability * 100).toFixed(0)}% prob.` : undefined} />,
  );

  return (
    <div className="mb-3 grid grid-cols-2 gap-y-1 rounded-xl border border-border bg-surface sm:grid-cols-4 lg:grid-cols-8 2xl:grid-cols-[repeat(17,minmax(0,1fr))]">
      {tiles}
    </div>
  );
}
