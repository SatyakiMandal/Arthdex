"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sigma } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import type { ApiGex } from "@/lib/api/types";

type Metric = "gex" | "oi" | "dex" | "tex";

const METRICS: { id: Metric; label: string }[] = [
  { id: "gex", label: "Gamma (GEX)" },
  { id: "oi", label: "Open interest" },
  { id: "dex", label: "Delta" },
  { id: "tex", label: "Theta" },
];

const W = 1000;
const H = 300;

const n0 = (v: number | null | undefined, d = 0) => (v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const money = (m: number) => `${m < 0 ? "-" : ""}$${Math.abs(m) >= 1000 ? `${(Math.abs(m) / 1000).toFixed(2)}B` : `${Math.abs(m).toFixed(1)}M`}`;

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" | "flat" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2">
      <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm font-semibold", tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</p>
      {sub ? <p className="mt-0.5 text-2xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function GexPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<ApiGex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>("gex");

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/gex?symbol=${symbol}`, { signal: ctl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load options data.");
        setData(body as ApiGex);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load options data.");
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
  }, [symbol]);

  const chart = useMemo(() => {
    if (!data || data.strikes.length === 0) return null;
    const strikes = data.strikes;
    const min = strikes[0].strike;
    const max = strikes[strikes.length - 1].strike;
    const gap = strikes.length > 1 ? Math.min(...strikes.slice(1).map((s, i) => s.strike - strikes[i].strike)) : 1;
    const x = (k: number) => 14 + ((k - min) / (max - min || 1)) * (W - 28);
    const bw = Math.max(((gap / (max - min || 1)) * (W - 28)) * 0.7, 1.5);
    const vals = strikes.map((s) => {
      if (metric === "gex") return { pos: Math.max(s.callGex, 0), neg: Math.min(s.putGex, 0) };
      if (metric === "oi") return { pos: s.callOi, neg: -s.putOi };
      if (metric === "dex") return { pos: Math.max(s.dex, 0), neg: Math.min(s.dex, 0) };
      return { pos: 0, neg: Math.min(s.tex, 0) };
    });
    const top = Math.max(1e-9, ...vals.map((v) => v.pos));
    const bot = Math.max(1e-9, ...vals.map((v) => -v.neg));
    const span = top + bot;
    const zero = 10 + (top / span) * (H - 20);
    const scale = (H - 20) / span;
    return { strikes, vals, x, bw, zero, scale, min, max };
  }, [data, metric]);

  const lines = data
    ? ([
        { k: "Spot", v: data.spot, color: "hsl(var(--foreground))", dash: "2 2" },
        { k: "Flip", v: data.levels.gammaFlip, color: "#fbbf24", dash: "6 4" },
        { k: "Call wall", v: data.levels.callWall, color: "hsl(var(--up))", dash: "6 4" },
        { k: "Put wall", v: data.levels.putWall, color: "hsl(var(--down))", dash: "6 4" },
        { k: "Max pain", v: data.levels.maxPain, color: "#a78bfa", dash: "3 3" },
      ] as const)
    : [];

  const scaled = data?.proxy.ratio != null;
  const lvl = (name: "gammaFlip" | "callWall" | "putWall" | "maxPain") => (scaled ? data!.levels.scaled[name] : data!.levels[name]);
  const unit = scaled ? `${data!.symbol} pts` : "";

  return (
    <DataCard
      title="Options exposure: gamma, delta, theta and open interest"
      subtitle={data ? `${data.underlying} chain${scaled ? ` standing in for ${data.symbol} futures (levels scaled ×${data.proxy.ratio})` : ""} · expiries ${data.expiries.join(", ")}` : "Listed option chains"}
      icon={Sigma}
      badge={loading ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : null}
      footnote={data?.assumption}
    >
      <div className="space-y-4 p-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Net GEX / 1% move" value={money(data.totals.gexMillions)} sub={data.regime === "positive" ? "Dealers long gamma: moves tend to be damped" : "Dealers short gamma: moves tend to be amplified"} tone={data.regime === "positive" ? "up" : "down"} />
              <Tile label="Gamma flip" value={n0(lvl("gammaFlip"))} sub={unit || "Where net gamma changes sign"} />
              <Tile label="Call wall" value={n0(lvl("callWall"))} sub={unit || "Largest call open interest above spot"} tone="up" />
              <Tile label="Put wall" value={n0(lvl("putWall"))} sub={unit || "Largest put open interest below spot"} tone="down" />
              <Tile label="Max pain" value={n0(lvl("maxPain"))} sub={`${data.nearestExpiry} expiry`} />
              <Tile label="Put / call OI" value={data.totals.putCallOi.toFixed(2)} sub={`${n0(data.totals.putOi)} puts · ${n0(data.totals.callOi)} calls`} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Tile
                label="0DTE"
                value={data.zeroDte ? `${(data.zeroDte.oiShare * 100).toFixed(0)}% of OI` : "None today"}
                sub={data.zeroDte ? `${(data.zeroDte.gexShare * 100).toFixed(0)}% of gamma · ${money(data.zeroDte.gexMillions)}` : `Next expiry ${data.nearestExpiry}`}
              />
              <Tile label="Delta notional" value={money(data.totals.dexMillions)} sub="Open-interest weighted, long calls minus puts" />
              <Tile label="Theta / day" value={`$${n0(data.totals.thetaPerDay / 1e6, 2)}M`} sub="Premium decay across open interest" />
              <Tile label="Vega / vol point" value={`$${n0(data.totals.vegaPerPoint / 1e6, 2)}M`} sub="Sensitivity to implied volatility" />
              <Tile label="Spot" value={n0(scaled ? data.levels.scaled.spot : data.spot, 2)} sub={scaled ? `${data.symbol} (${data.underlying} ${n0(data.spot, 2)})` : data.underlying} />
              <Tile label="As of" value={data.asOf.slice(11, 16)} sub={`${data.asOf.slice(0, 10)} ET`} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl options={METRICS} value={metric} onChange={setMetric} layoutGroupId="gex-metric" />
              <p className="text-2xs text-muted-foreground">
                {metric === "gex" && "$ millions of delta dealers re-hedge per 1% move; calls up, puts down"}
                {metric === "oi" && "Contracts by strike; calls up, puts down"}
                {metric === "dex" && "$ millions of delta by strike (calls positive, puts negative)"}
                {metric === "tex" && "Premium decay per day by strike"}
              </p>
            </div>

            {chart ? (
              <div className="relative">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }} role="img" aria-label={`${metric} by strike`}>
                  <line x1={0} x2={W} y1={chart.zero} y2={chart.zero} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
                  {chart.strikes.map((s, i) => {
                    const v = chart.vals[i];
                    const cx = chart.x(s.strike);
                    return (
                      <g key={s.strike}>
                        {v.pos > 0 ? <rect x={cx - chart.bw / 2} y={chart.zero - v.pos * chart.scale} width={chart.bw} height={v.pos * chart.scale} fill="hsl(var(--up))" fillOpacity={0.8} /> : null}
                        {v.neg < 0 ? <rect x={cx - chart.bw / 2} y={chart.zero} width={chart.bw} height={-v.neg * chart.scale} fill="hsl(var(--down))" fillOpacity={0.8} /> : null}
                      </g>
                    );
                  })}
                  {lines.map((l) =>
                    l.v != null && l.v >= chart.min && l.v <= chart.max ? (
                      <line key={l.k} x1={chart.x(l.v)} x2={chart.x(l.v)} y1={0} y2={H} stroke={l.color} strokeWidth={1.3} strokeDasharray={l.dash} vectorEffect="non-scaling-stroke" />
                    ) : null,
                  )}
                </svg>
                {lines.map((l) =>
                  l.v != null && l.v >= chart.min && l.v <= chart.max ? (
                    <span key={l.k} className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded bg-surface/80 px-1 font-mono text-2xs" style={{ left: `${(chart.x(l.v) / W) * 100}%`, color: l.color }}>
                      {l.k}
                    </span>
                  ) : null,
                )}
                <div className="mt-1 flex justify-between font-mono text-2xs text-muted-foreground">
                  <span>{n0(chart.min)}</span>
                  <span>strike ({data.underlying})</span>
                  <span>{n0(chart.max)}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : !error ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
          </div>
        ) : null}
      </div>
    </DataCard>
  );
}
