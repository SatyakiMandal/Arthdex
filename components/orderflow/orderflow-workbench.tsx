"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Flame,
  Grid3x3,
  Layers,
  Loader2,
  Magnet,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
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
  const s =
    a >= 1e7
      ? `${(a / 1e7).toFixed(2)}Cr`
      : a >= 1e5
        ? `${(a / 1e5).toFixed(2)}L`
        : a >= 1e3
          ? `${(a / 1e3).toFixed(1)}K`
          : `${Math.round(a)}`;
  return v < 0 ? `-${s}` : s;
};
const f2 = (v: number) =>
  v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (t: string, intraday: boolean) =>
  intraday ? `${t.slice(5, 10)} ${t.slice(11, 16)}` : t.slice(5);

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
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);
    fetch(
      `/api/orderflow?symbol=${encodeURIComponent(symbol)}&market=${market}&interval=${interval}`,
      { signal: ctl.signal },
    )
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
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [symbol, market, interval]);

  const pickMarket = (m: OrderflowMarket) => {
    setMarket(m);
    const next = m === "futures" ? "NQ" : m === "us" ? "SPY" : "RELIANCE";
    setSymbol(next);
    setDraft(next);
  };

  const chip = (active: boolean) =>
    cn(
      "rounded-none border px-2.5 py-0.5 font-mono text-2xs uppercase font-bold transition-colors shadow-xs",
      active
        ? "border-accent bg-accent/15 text-accent"
        : "border-border/80 bg-surface-muted text-muted-foreground hover:text-foreground",
    );

  const symbols = market === "futures" ? FUTURES : market === "us" ? US : [];
  const stackedBuy = data ? data.imbalances.filter((i) => i.side === "buy").length : 0;
  const stackedSell = data ? data.imbalances.filter((i) => i.side === "sell").length : 0;

  // Orderflow Microstructure Telemetry Computations
  const telemetry = useMemo(() => {
    if (!data) return null;
    const lastCvd = data.cvd.length > 0 ? data.cvd[data.cvd.length - 1] : 0;
    const prevCvd = data.cvd.length > 1 ? data.cvd[data.cvd.length - 2] : 0;
    const cvdDelta = lastCvd - prevCvd;
    const isAboveVah = data.lastClose > data.profile.vah;
    const isBelowVal = data.lastClose < data.profile.val;
    const auctionState = isAboveVah
      ? "ABOVE VALUE (BULL BREAKOUT)"
      : isBelowVal
        ? "BELOW VALUE (BEAR BREAKDOWN)"
        : "INSIDE VALUE (BALANCED ROTATION)";
    const auctionTone = isAboveVah ? "up" : isBelowVal ? "down" : "gold";
    const valSpan = data.profile.vah - data.profile.val;
    const valSpanPct = (valSpan / data.lastClose) * 100;

    return {
      lastCvd,
      cvdDelta,
      auctionState,
      auctionTone,
      valSpan,
      valSpanPct,
    };
  }, [data]);

  return (
    <div className="space-y-2.5">
      {/* Top Filter and Symbol Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {selectable ? (
            <>
              <SegmentedControl
                options={MARKETS}
                value={market}
                onChange={pickMarket}
                layoutGroupId="of-market"
              />
              {symbols.length ? (
                <SegmentedControl
                  options={symbols.map((s) => ({ id: s, label: s }))}
                  value={symbol}
                  onChange={(s) => setSymbol(s)}
                  layoutGroupId="of-symbol"
                />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const s = draft.trim().toUpperCase();
                    if (s) setSymbol(s);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="NSE symbol"
                    aria-label="NSE symbol"
                    className="h-7 w-28 rounded-none border border-border bg-surface-muted px-2 font-mono text-xs uppercase outline-none focus:border-accent/80"
                  />
                  <button type="submit" className="btn-ghost h-7 px-2.5 text-xs font-mono">
                    Load
                  </button>
                </form>
              )}
            </>
          ) : null}
          <SegmentedControl
            options={INTERVALS}
            value={interval}
            onChange={setInterval}
            layoutGroupId="of-interval"
          />
        </div>
        {data ? (
          <p className="font-mono text-2xs text-muted-foreground">
            <strong className="text-foreground">{data.symbol}</strong> · {data.intervalLabel} bars ·{" "}
            {data.bars.length} loaded · last {data.asOf.replace("T", " ").slice(0, 16)} ·{" "}
            <span className="font-bold text-foreground">₹{f2(data.lastClose)}</span>
          </p>
        ) : null}
      </div>

      {/* INSTITUTIONAL MICROSTRUCTURE TELEMETRY RIBBON */}
      {telemetry && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono">
          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Net CVD Flow
            </div>
            <div
              className={cn(
                "text-xs sm:text-sm font-bold tabular-nums",
                telemetry.lastCvd >= 0 ? "text-up" : "text-down",
              )}
            >
              {compact(telemetry.lastCvd)}
            </div>
            <div className="text-3xs text-muted-foreground">
              {telemetry.cvdDelta >= 0 ? `+${compact(telemetry.cvdDelta)}` : compact(telemetry.cvdDelta)} latest bar
            </div>
          </div>

          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Auction Value State
            </div>
            <div
              className={cn(
                "text-xs sm:text-sm font-bold truncate",
                telemetry.auctionTone === "up" && "text-up",
                telemetry.auctionTone === "down" && "text-down",
                telemetry.auctionTone === "gold" && "text-gold",
              )}
              title={telemetry.auctionState}
            >
              {telemetry.auctionState.split(" ")[0]}
            </div>
            <div className="text-3xs text-muted-foreground truncate">
              {telemetry.auctionState.split("(")[1]?.replace(")", "") ?? "Balanced"}
            </div>
          </div>

          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Volume POC
            </div>
            <div className="text-xs sm:text-sm font-bold text-gold tabular-nums">
              ₹{f2(data.profile.poc)}
            </div>
            <div className="text-3xs text-muted-foreground">
              {((data.lastClose - data.profile.poc) / data.profile.poc * 100).toFixed(1)}% from CMP
            </div>
          </div>

          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Value Area (70%)
            </div>
            <div className="text-xs sm:text-sm font-bold text-accent tabular-nums">
              ₹{f2(data.profile.val)} – ₹{f2(data.profile.vah)}
            </div>
            <div className="text-3xs text-muted-foreground">
              Span: ₹{f2(telemetry.valSpan)} ({telemetry.valSpanPct.toFixed(1)}%)
            </div>
          </div>

          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Stacked Imbalances
            </div>
            <div className="text-xs sm:text-sm font-bold tabular-nums">
              <span className="text-up">{stackedBuy} Buy</span> · <span className="text-down">{stackedSell} Sell</span>
            </div>
            <div className="text-3xs text-muted-foreground">
              {stackedBuy > stackedSell ? "Buyer Pressing" : stackedSell > stackedBuy ? "Seller Pressing" : "Symmetric"}
            </div>
          </div>

          <div className="border border-border bg-surface p-2 rounded-none cell-glow space-y-0.5">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
              Absorption & Big Prints
            </div>
            <div className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
              {data.absorption.length} Abs · {data.bigTrades.length} Big
            </div>
            <div className="text-3xs text-muted-foreground">
              Institutional Footprint
            </div>
          </div>
        </div>
      )}

      {/* Method Provenance Note */}
      <p className="flex items-start gap-2 rounded-none border border-flat/30 bg-flat/5 px-2.5 py-1.5 font-mono text-2xs text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flat" />
        <span>
          <strong className="text-foreground">Modelled from bars.</strong>{" "}
          {data?.method ??
            "The free feed has no trade tape or order-book depth, so buy and sell volume are estimated from each bar."}
        </span>
      </p>

      {error ? (
        <p role="alert" className="rounded-none border border-down/40 bg-down/10 px-3 py-2 text-xs text-down font-mono">
          {error}
        </p>
      ) : null}

      {/* Volume Profile & CVD Flow Chart Section */}
      <section className="rounded-none border border-border bg-surface p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono">
          <span className="mr-1 text-3xs uppercase font-bold text-muted-foreground">Profile:</span>
          <button
            type="button"
            aria-pressed={mode === "volume"}
            onClick={() => setMode("volume")}
            className={chip(mode === "volume")}
          >
            Volume profile
          </button>
          <button
            type="button"
            aria-pressed={mode === "delta"}
            onClick={() => setMode("delta")}
            className={chip(mode === "delta")}
          >
            Delta profile
          </button>
          <span className="ml-3 mr-1 text-3xs uppercase font-bold text-muted-foreground">Markers:</span>
          <button
            type="button"
            aria-pressed={showAbsorption}
            onClick={() => setShowAbsorption((v) => !v)}
            className={chip(showAbsorption)}
          >
            Absorption
          </button>
          <button
            type="button"
            aria-pressed={showBig}
            onClick={() => setShowBig((v) => !v)}
            className={chip(showBig)}
          >
            Big volume
          </button>
        </div>
        <div className="relative min-h-[420px]">
          {data ? (
            <div className={cn("transition-opacity", loading && "opacity-40")}>
              <FlowChart
                data={data}
                mode={mode}
                showAbsorption={showAbsorption}
                showBig={showBig}
              />
            </div>
          ) : !error ? (
            <div className="grid h-[420px] place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
          ) : null}
          {loading && data ? (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-accent" />
          ) : null}
        </div>
      </section>

      {/* Footprint Chart and Lower Microstructure Panels */}
      {data ? (
        <>
          <DataCard
            title="Footprint"
            subtitle={`Modelled sell × buy per ${data.footprint.step} price row, last ${data.footprint.bars.length} bars`}
            icon={Grid3x3}
            badge={
              <span className="font-mono text-2xs text-muted-foreground">
                <span className="text-up font-bold">{stackedBuy} buy</span> ·{" "}
                <span className="text-down font-bold">{stackedSell} sell</span> imbalances
              </span>
            }
            footnote="Bold green is a buy imbalance (buy volume at least 3× the sell volume one row below); bold red is the mirror. ▮ marks three or more in a row, a stacked imbalance. The amber outline is each bar's heaviest row."
          >
            <div className="p-1.5">
              <FootprintChart data={data} />
            </div>
          </DataCard>

          <div className="grid gap-2.5 xl:grid-cols-3">
            <DataCard
              title="Absorption"
              subtitle="Heavy volume that barely moved price"
              icon={Magnet}
              footnote="Volume at least 1.5× recent average inside a bar under 0.8 ATR. Near the lows it reads as demand soaking up selling; near the highs, supply soaking up buying."
            >
              <ul className="divide-y divide-border/70 font-mono text-xs">
                {data.absorption.length === 0 ? (
                  <li className="p-3 text-xs text-muted-foreground font-mono">None in the loaded bars.</li>
                ) : null}
                {[...data.absorption].reverse().map((a) => (
                  <li
                    key={a.at}
                    className="flex items-center justify-between gap-2.5 px-3 py-1.5 cell-glow transition-colors"
                  >
                    <div>
                      <p
                        className={cn(
                          "font-semibold text-2xs",
                          a.type === "bullish" ? "text-up" : "text-down",
                        )}
                      >
                        {a.type === "bullish" ? "▲ Bullish Abs" : "▼ Bearish Abs"} at ₹{f2(a.price)}
                      </p>
                      <p className="font-mono text-3xs text-muted-foreground">
                        {when(data.bars[a.at].t, data.intraday)}
                      </p>
                    </div>
                    <p className="text-right font-mono text-2xs tabular-nums text-muted-foreground">
                      <strong className="text-foreground">{a.volRatio}×</strong> vol
                      <br />
                      {a.rangeAtr} ATR
                    </p>
                  </li>
                ))}
              </ul>
            </DataCard>

            <DataCard
              title="Big Volume Prints"
              subtitle="Largest prints and reaction"
              icon={Flame}
              footnote="Without the tape a single large trade cannot be seen, only the bar it printed in. Shows bars at least 2.5 standard deviations above recent volume, with the move over the next 3 bars."
            >
              <ul className="divide-y divide-border/70 font-mono text-xs">
                {data.bigTrades.length === 0 ? (
                  <li className="p-3 text-xs text-muted-foreground font-mono">None in the loaded bars.</li>
                ) : null}
                {[...data.bigTrades].reverse().map((t) => (
                  <li
                    key={t.at}
                    className="flex items-center justify-between gap-2.5 px-3 py-1.5 cell-glow transition-colors"
                  >
                    <div>
                      <p className="font-mono text-2xs font-bold text-foreground">
                        {compact(t.volume)}{" "}
                        <span className="text-3xs text-muted-foreground">({t.z}σ)</span>
                      </p>
                      <p className="font-mono text-3xs text-muted-foreground">
                        {when(data.bars[t.at].t, data.intraday)} ·{" "}
                        <span className={t.bias === "buy" ? "text-up font-semibold" : "text-down font-semibold"}>
                          {t.bias}-biased
                        </span>
                      </p>
                    </div>
                    <p
                      className={cn(
                        "font-mono text-2xs tabular-nums font-bold",
                        t.fwdPct == null
                          ? "text-muted-foreground"
                          : t.fwdPct >= 0
                            ? "text-up"
                            : "text-down",
                      )}
                    >
                      {t.fwdPct == null ? "—" : `${t.fwdPct >= 0 ? "+" : ""}${t.fwdPct}%`}
                    </p>
                  </li>
                ))}
              </ul>
            </DataCard>

            <div className="space-y-2.5">
              <DataCard
                title="Value Area Profile"
                subtitle={`${Math.round(data.profile.valueAreaPct * 100)}% of total auction volume`}
                icon={Layers}
              >
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 p-2.5 font-mono text-xs">
                  <dt className="text-3xs text-muted-foreground uppercase">Value Area High (VAH)</dt>
                  <dd className="text-right text-accent font-bold tabular-nums">₹{f2(data.profile.vah)}</dd>
                  <dt className="text-3xs text-muted-foreground uppercase">Point of Control (POC)</dt>
                  <dd className="text-right text-gold font-bold tabular-nums">₹{f2(data.profile.poc)}</dd>
                  <dt className="text-3xs text-muted-foreground uppercase">Value Area Low (VAL)</dt>
                  <dd className="text-right text-accent font-bold tabular-nums">₹{f2(data.profile.val)}</dd>
                  <dt className="text-3xs text-muted-foreground uppercase">Last Close</dt>
                  <dd
                    className={cn(
                      "text-right font-bold tabular-nums",
                      data.lastClose > data.profile.vah
                        ? "text-up"
                        : data.lastClose < data.profile.val
                          ? "text-down"
                          : "text-foreground",
                    )}
                  >
                    ₹{f2(data.lastClose)}
                  </dd>
                  <dt className="col-span-2 mt-1 border-t border-border/60 pt-1 font-mono text-3xs text-muted-foreground">
                    {data.lastClose > data.profile.vah || data.lastClose < data.profile.val
                      ? "Outside value: auction is out of balance. Trends start from these excursions."
                      : "Inside value: auction is balanced. Expect rotation around the POC."}
                  </dt>
                </dl>
              </DataCard>
              <DataCard title="Liquidity Heatmap" subtitle="Resting orders over time" icon={Waves}>
                <p className="p-2.5 font-mono text-2xs text-muted-foreground">{data.heatmap.reason}</p>
              </DataCard>
            </div>
          </div>

          <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RiskPlan data={data} />
            <DataCard
              title="Reading Order Flow"
              subtitle="Combine structure, location and risk"
              icon={BarChart3}
            >
              <ul className="space-y-1.5 p-3 text-2xs text-muted-foreground font-mono">
                <li className="cell-glow p-1">
                  <strong className="text-foreground">1. Location first.</strong> POC, value-area edges, and high-volume nodes are where reactions matter.
                </li>
                <li className="cell-glow p-1">
                  <strong className="text-foreground">2. Aggression second.</strong> Delta, CVD, and imbalances show who is pressing; absorption shows who is being soaked up.
                </li>
                <li className="cell-glow p-1">
                  <strong className="text-foreground">3. Risk always.</strong> Size trades strictly from the stop distance, not from conviction.
                </li>
              </ul>
            </DataCard>
          </div>
        </>
      ) : null}

      {selectable && GEX_SYMBOLS.has(symbol) ? <GexPanel symbol={symbol} /> : null}
      {selectable && market === "nse" ? (
        <DataCard
          title="Options Exposure"
          subtitle="Gamma, delta, theta, open interest and 0DTE"
          icon={Layers}
        >
          <p className="p-3 text-xs text-muted-foreground font-mono">
            For NSE indices and F&amp;O stocks, the option chain, Greeks, max pain and open-interest
            walls are on the{" "}
            <Link
              href="/derivatives"
              className="underline underline-offset-4 text-accent hover:text-foreground"
            >
              Derivatives Desk
            </Link>
            . Dealer gamma exposure here covers SPY, QQQ and NQ/ES futures proxies.
          </p>
        </DataCard>
      ) : null}
    </div>
  );
}
