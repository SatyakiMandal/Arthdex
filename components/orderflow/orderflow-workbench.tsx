"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Flame, Grid3x3, Layers, Loader2, Magnet, Waves } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import type { ApiOrderflow, OrderflowInterval, OrderflowMarket } from "@/lib/api/types";
import { FlowChart, type ProfileMode } from "./flow-chart";
import { FootprintChart } from "./footprint-chart";
import { GexPanel } from "./gex-panel";
import { RiskPlan } from "./risk-plan";

const INTERVALS: { id: OrderflowInterval; label: string }[] = [
  { id: "1m", label: "1 min" },
  { id: "5m", label: "5 min" },
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "1d", label: "Daily" },
];

const MARKETS: { id: OrderflowMarket; label: string }[] = [
  { id: "futures", label: "Futures" },
  { id: "us", label: "US ETFs" },
  { id: "nse", label: "NSE stocks" },
];

const FUTURES = ["NQ", "MNQ", "NNQ", "ES", "MES"];
const US = ["SPY", "QQQ"];
const GEX_SYMBOLS = new Set([...FUTURES, ...US]);

const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e7 ? `${(a / 1e7).toFixed(2)}Cr` : a >= 1e5 ? `${(a / 1e5).toFixed(2)}L` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`;
  return v < 0 ? `-${s}` : s;
};
const f2 = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (t: string, intraday: boolean) => (intraday ? `${t.slice(5, 10)} ${t.slice(11, 16)}` : t.slice(5));

export function OrderflowWorkbench({
  symbol: initialSymbol,
  market: initialMarket,
  selectable = false,
}: {
  symbol: string;
  market: OrderflowMarket;
  selectable?: boolean;
}) {
  const [market, setMarket] = useState<OrderflowMarket>(initialMarket);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [draft, setDraft] = useState(initialSymbol);
  const [interval, setInterval] = useState<OrderflowInterval>("5m");
  const [data, setData] = useState<ApiOrderflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ProfileMode>("volume");
  const [showAbsorption, setShowAbsorption] = useState(true);
  const [showBig, setShowBig] = useState(true);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/orderflow?symbol=${encodeURIComponent(symbol)}&market=${market}&interval=${interval}`, { signal: ctl.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load order flow.");
        setData(body as ApiOrderflow);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setData(null);
        setError(e instanceof Error ? e.message : "Could not load order flow.");
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
  }, [symbol, market, interval]);

  const pickMarket = (m: OrderflowMarket) => {
    setMarket(m);
    const next = m === "futures" ? "NQ" : m === "us" ? "SPY" : "RELIANCE";
    setSymbol(next);
    setDraft(next);
  };

  const chip = (active: boolean) =>
    cn("rounded-lg border px-2.5 py-1 text-2xs transition-colors", active ? "border-accent/50 bg-accent/10 text-accent" : "border-border bg-surface-muted text-muted-foreground hover:text-foreground");

  const symbols = market === "futures" ? FUTURES : market === "us" ? US : [];
  const stackedBuy = data ? data.imbalances.filter((i) => i.side === "buy").length : 0;
  const stackedSell = data ? data.imbalances.filter((i) => i.side === "sell").length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {selectable ? (
            <>
              <SegmentedControl options={MARKETS} value={market} onChange={pickMarket} layoutGroupId="of-market" />
              {symbols.length ? (
                <SegmentedControl options={symbols.map((s) => ({ id: s, label: s }))} value={symbol} onChange={(s) => setSymbol(s)} layoutGroupId="of-symbol" />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const s = draft.trim().toUpperCase();
                    if (s) setSymbol(s);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="NSE symbol" aria-label="NSE symbol" className="w-32 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-sm uppercase outline-none focus:border-accent/60" />
                  <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">
                    Load
                  </button>
                </form>
              )}
            </>
          ) : null}
          <SegmentedControl options={INTERVALS} value={interval} onChange={setInterval} layoutGroupId="of-interval" />
        </div>
        {data ? (
          <p className="font-mono text-2xs text-muted-foreground">
            {data.symbol} · {data.intervalLabel} bars · {data.bars.length} loaded · last {data.asOf.replace("T", " ").slice(0, 16)} · {f2(data.lastClose)}
          </p>
        ) : null}
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-flat/30 bg-flat/10 px-3 py-2 text-2xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flat" />
        <span>
          <strong className="text-foreground">Modelled from bars.</strong> {data?.method ?? "The free feed has no trade tape or order-book depth, so buy and sell volume are estimated from each bar."}
        </span>
      </p>

      {error ? (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 self-center text-2xs uppercase tracking-wider text-muted-foreground">Profile</span>
          <button type="button" aria-pressed={mode === "volume"} onClick={() => setMode("volume")} className={chip(mode === "volume")}>
            Volume profile
          </button>
          <button type="button" aria-pressed={mode === "delta"} onClick={() => setMode("delta")} className={chip(mode === "delta")}>
            Delta profile
          </button>
          <span className="ml-3 mr-1 self-center text-2xs uppercase tracking-wider text-muted-foreground">Markers</span>
          <button type="button" aria-pressed={showAbsorption} onClick={() => setShowAbsorption((v) => !v)} className={chip(showAbsorption)}>
            Absorption
          </button>
          <button type="button" aria-pressed={showBig} onClick={() => setShowBig((v) => !v)} className={chip(showBig)}>
            Big volume
          </button>
        </div>
        <div className="relative min-h-[420px]">
          {data ? (
            <div className={cn("transition-opacity", loading && "opacity-40")}>
              <FlowChart data={data} mode={mode} showAbsorption={showAbsorption} showBig={showBig} />
            </div>
          ) : !error ? (
            <div className="grid h-[420px] place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : null}
          {loading && data ? <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-accent" /> : null}
        </div>
      </section>

      {data ? (
        <>
          <DataCard
            title="Footprint"
            subtitle={`Modelled sell × buy per ${data.footprint.step} price row, last ${data.footprint.bars.length} bars`}
            icon={Grid3x3}
            badge={
              <span className="font-mono text-2xs text-muted-foreground">
                <span className="text-up">{stackedBuy} buy</span> · <span className="text-down">{stackedSell} sell</span> imbalances
              </span>
            }
            footnote="Bold green is a buy imbalance (buy volume at least 3× the sell volume one row below); bold red is the mirror. ▮ marks three or more in a row, a stacked imbalance. The amber outline is each bar's heaviest row."
          >
            <div className="p-2">
              <FootprintChart data={data} />
            </div>
          </DataCard>

          <div className="grid gap-4 xl:grid-cols-3">
            <DataCard title="Absorption" subtitle="Heavy volume that barely moved price" icon={Magnet} footnote="Volume at least 1.5× recent average inside a bar under 0.8 ATR. Near the lows it reads as demand soaking up selling; near the highs, supply soaking up buying.">
              <ul className="divide-y divide-border">
                {data.absorption.length === 0 ? <li className="p-4 text-sm text-muted-foreground">None in the loaded bars.</li> : null}
                {[...data.absorption].reverse().map((a) => (
                  <li key={a.at} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <div>
                      <p className={cn("font-medium", a.type === "bullish" ? "text-up" : "text-down")}>{a.type === "bullish" ? "Bullish" : "Bearish"} at {f2(a.price)}</p>
                      <p className="font-mono text-2xs text-muted-foreground">{when(data.bars[a.at].t, data.intraday)}</p>
                    </div>
                    <p className="text-right font-mono text-2xs text-muted-foreground">
                      {a.volRatio}× volume
                      <br />
                      {a.rangeAtr} ATR range
                    </p>
                  </li>
                ))}
              </ul>
            </DataCard>

            <DataCard title="Big volume" subtitle="Largest prints and how price reacted" icon={Flame} footnote="Without the tape a single large trade cannot be seen, only the bar it printed in. Shows bars at least 2.5 standard deviations above recent volume, with the move over the next 3 bars.">
              <ul className="divide-y divide-border">
                {data.bigTrades.length === 0 ? <li className="p-4 text-sm text-muted-foreground">None in the loaded bars.</li> : null}
                {[...data.bigTrades].reverse().map((t) => (
                  <li key={t.at} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <div>
                      <p className="font-mono font-medium">
                        {compact(t.volume)} <span className="text-2xs text-muted-foreground">({t.z}σ)</span>
                      </p>
                      <p className="font-mono text-2xs text-muted-foreground">
                        {when(data.bars[t.at].t, data.intraday)} · <span className={t.bias === "buy" ? "text-up" : "text-down"}>{t.bias}-biased</span>
                      </p>
                    </div>
                    <p className={cn("font-mono text-sm", t.fwdPct == null ? "text-muted-foreground" : t.fwdPct >= 0 ? "text-up" : "text-down")}>{t.fwdPct == null ? "—" : `${t.fwdPct >= 0 ? "+" : ""}${t.fwdPct}%`}</p>
                  </li>
                ))}
              </ul>
            </DataCard>

            <div className="space-y-4">
              <DataCard title="Value area" subtitle={`${Math.round(data.profile.valueAreaPct * 100)}% of volume`} icon={Layers}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-4 font-mono text-sm">
                  <dt className="text-muted-foreground">VAH</dt>
                  <dd className="text-right text-accent">{f2(data.profile.vah)}</dd>
                  <dt className="text-muted-foreground">POC</dt>
                  <dd className="text-right text-[#fbbf24]">{f2(data.profile.poc)}</dd>
                  <dt className="text-muted-foreground">VAL</dt>
                  <dd className="text-right text-accent">{f2(data.profile.val)}</dd>
                  <dt className="text-muted-foreground">Last</dt>
                  <dd className={cn("text-right", data.lastClose > data.profile.vah ? "text-up" : data.lastClose < data.profile.val ? "text-down" : "")}>
                    {f2(data.lastClose)} {data.lastClose > data.profile.vah ? "above value" : data.lastClose < data.profile.val ? "below value" : "inside value"}
                  </dd>
                </dl>
              </DataCard>
              <DataCard title="Liquidity heatmap" subtitle="Resting orders over time" icon={Waves}>
                <p className="p-4 text-sm text-muted-foreground">{data.heatmap.reason}</p>
              </DataCard>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RiskPlan data={data} />
            <DataCard title="Reading order flow" subtitle="Combine it with structure, location and risk" icon={BarChart3}>
              <ul className="space-y-2 p-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Location first.</strong> POC, value-area edges and order blocks or gaps on the Technicals tab are where reactions matter.
                </li>
                <li>
                  <strong className="text-foreground">Aggression second.</strong> Delta, CVD and imbalances show who is pressing at that level; absorption shows who is being soaked up.
                </li>
                <li>
                  <strong className="text-foreground">Risk always.</strong> Size from the stop, not from conviction.
                </li>
              </ul>
            </DataCard>
          </div>
        </>
      ) : null}

      {selectable && GEX_SYMBOLS.has(symbol) ? <GexPanel symbol={symbol} /> : null}
      {selectable && market === "nse" ? (
        <DataCard title="Options exposure" subtitle="Gamma, delta, theta, open interest and 0DTE" icon={Layers}>
          <p className="p-4 text-sm text-muted-foreground">
            Options analytics need a live NSE option chain, which the free data service does not have. They are available for SPY, QQQ and the NQ, MNQ, NNQ, ES and MES futures, using the ETF chains as proxies.
          </p>
        </DataCard>
      ) : null}
    </div>
  );
}
