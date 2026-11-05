"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApiOptionChain } from "@/lib/api/types";
import { cn, formatINR } from "@/lib/utils";
import { Activity, BarChart2, Compass, Layers, ShieldAlert, Sparkles, Target, Zap } from "lucide-react";

const STRIKES_EACH_SIDE = 10;
const n = (v: number | null | undefined, d = 0) => (v == null ? "—" : formatINR(v, d));
const lakh = (v: number | null | undefined) => (v == null ? "—" : v >= 1e5 ? `${(v / 1e5).toFixed(2)} L` : formatINR(v, 0));
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Open interest as a bar behind the figure, so the walls show at a glance. */
function OiCell({ oi, max, side }: { oi: number | null; max: number; side: "ce" | "pe" }) {
  const w = oi && max ? Math.max(2, (oi / max) * 100) : 0;
  return (
    <td className="relative px-2 py-1.5 text-right font-mono tabular-nums">
      <span
        aria-hidden
        className={cn("absolute inset-y-1", side === "ce" ? "right-0 bg-down/15" : "left-0 bg-up/15")}
        style={{ width: `${w}%` }}
      />
      <span className="relative">{lakh(oi)}</span>
    </td>
  );
}

export function OptionChainView({ chain }: { chain: ApiOptionChain }) {
  const [strikeDepth, setStrikeDepth] = useState<number>(15);
  const [chainMode, setChainMode] = useState<"core" | "greeks" | "walls">("core");
  let atmIndex = chain.rows.findIndex((r) => r.strike === chain.atmStrike);
  if (atmIndex < 0 && chain.rows.length > 0) {
    let bestDist = Infinity;
    chain.rows.forEach((r, i) => {
      const dist = Math.abs(r.strike - (chain.atmStrike || chain.underlying));
      if (dist < bestDist) {
        bestDist = dist;
        atmIndex = i;
      }
    });
  }
  const safeAtmIndex = Math.max(0, atmIndex);
  const rows = strikeDepth === 0 ? chain.rows : chain.rows.slice(Math.max(0, safeAtmIndex - strikeDepth), safeAtmIndex + strikeDepth + 1);
  const maxOi = Math.max(1, ...rows.flatMap((r) => [r.ce?.oi ?? 0, r.pe?.oi ?? 0]));
  // Total OI & Market Balance Calculations
  const totalCeOi = rows.reduce((acc, r) => acc + (r.ce?.oi ?? 0), 0);
  const totalPeOi = rows.reduce((acc, r) => acc + (r.pe?.oi ?? 0), 0);
  const totalOi = totalCeOi + totalPeOi;
  const peRatioPct = totalOi > 0 ? (totalPeOi / totalOi) * 100 : 50;

  // ATM Straddle Breakeven Corridor
  const atmRow = chain.rows.find((r) => r.strike === chain.atmStrike);
  const straddlePrice = (atmRow?.ce?.ltp ?? 0) + (atmRow?.pe?.ltp ?? 0);
  const upperBreakeven = chain.underlying + straddlePrice;
  const lowerBreakeven = chain.underlying - straddlePrice;

  // Max Pain Gravitational Pull
  const maxPainDiff = chain.maxPain != null ? chain.maxPain - chain.underlying : null;
  const maxPainPct = maxPainDiff != null ? (maxPainDiff / chain.underlying) * 100 : null;

  // Daily Implied Move from IV (IV / sqrt(252))
  const dailyImpliedMovePct = chain.atmIv != null ? chain.atmIv / 15.874 : null;

  const pcrValue = chain.pcr ?? 1.0;
  const pcrBias = pcrValue >= 1.25 ? "Bullish (Put Heavy)" : pcrValue <= 0.8 ? "Bearish (Call Heavy)" : "Balanced";

  const ledger = [
    {
      label: "Underlying CMP",
      value: `₹${formatINR(chain.underlying, 2)}`,
      detail: `ATM Strike: ₹${formatINR(chain.atmStrike || chain.underlying, 0)}`,
      tone: "neutral",
    },
    {
      label: "Put-Call Ratio (OI)",
      value: chain.pcr?.toFixed(2) ?? "—",
      detail: pcrBias,
      tone: pcrValue >= 1.25 ? "up" : pcrValue <= 0.8 ? "down" : "gold",
    },
    {
      label: "Max Pain Settlement",
      value: chain.maxPain != null ? `₹${formatINR(chain.maxPain, 0)}` : "—",
      detail: maxPainDiff != null ? `${maxPainDiff >= 0 ? "+" : ""}₹${maxPainDiff.toFixed(1)} (${maxPainPct?.toFixed(1)}%) Gravity` : "—",
      tone: "gold",
    },
    {
      label: "ATM Straddle Premium",
      value: straddlePrice > 0 ? `₹${straddlePrice.toFixed(1)}` : "—",
      detail: straddlePrice > 0 ? `Corridor: ₹${lowerBreakeven.toFixed(0)} – ₹${upperBreakeven.toFixed(0)}` : "—",
      tone: "accent",
    },
    {
      label: "ATM Implied Volatility",
      value: chain.atmIv != null ? `${chain.atmIv.toFixed(1)}%` : "—",
      detail: dailyImpliedMovePct != null ? `1-Day Move: ±${dailyImpliedMovePct.toFixed(2)}%` : "—",
      tone: "neutral",
    },
    {
      label: "Move Priced In",
      value: chain.impliedMove ? `±₹${formatINR(chain.impliedMove.points, 1)}` : "—",
      detail: chain.impliedMove ? `±${chain.impliedMove.pct.toFixed(2)}% by Expiry` : "—",
      tone: "neutral",
    },
    {
      label: "Market Open Interest",
      value: lakh(totalOi),
      detail: `${peRatioPct.toFixed(0)}% PE / ${(100 - peRatioPct).toFixed(0)}% CE`,
      tone: "neutral",
    },
    {
      label: "Days to Expiry",
      value: `${chain.daysToExpiry}D`,
      detail: `Expiry: ${day(chain.expiry)}`,
      tone: chain.daysToExpiry <= 2 ? "down" : "neutral",
    },
  ];
  const failed = chain.vetting.checks.filter((c) => !c.ok);
  const sym = encodeURIComponent(chain.symbol);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/70 pb-2">
        <nav aria-label="Expiry" className="flex flex-wrap items-center gap-1">
          <span className="text-3xs font-mono font-bold uppercase tracking-wider text-muted-foreground mr-1">Expiry:</span>
          {chain.expiries.slice(0, 8).map((e) => (
          <Link
            key={e}
            href={`/derivatives?symbol=${sym}&expiry=${e}`}
            aria-current={e === chain.expiry ? "page" : undefined}
            className={cn(
              "rounded-none px-2.5 py-1 font-mono text-xs",
              e === chain.expiry ? "bg-surface-muted text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {day(e)}
          </Link>
        ))}
        </nav>

        {/* View Mode & Strike Depth Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-3xs font-mono">
          {/* View Mode Chips */}
          <div className="flex items-center border border-border bg-surface-muted p-0.5 rounded-none">
            <span className="text-muted-foreground uppercase font-semibold px-1.5 hidden sm:inline">Mode:</span>
            {[
              { id: "core", label: "Core Chain" },
              { id: "greeks", label: "Full Greeks" },
              { id: "walls", label: "Strike Walls" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setChainMode(m.id as any)}
                className={cn(
                  "px-2 py-0.5 font-bold uppercase rounded-none transition-colors",
                  chainMode === m.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Strike Depth Selector */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground uppercase tracking-wider font-semibold mr-1">Depth:</span>
            {[
              { n: 10, label: "±10" },
              { n: 15, label: "±15" },
              { n: 25, label: "±25" },
              { n: 0, label: "All" },
            ].map((d) => (
              <button
                key={d.n}
                onClick={() => setStrikeDepth(d.n)}
                className={cn(
                  "px-2 py-0.5 border rounded-none font-bold uppercase transition-colors",
                  strikeDepth === d.n
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-surface-muted/50 border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 8-METRIC INSTITUTIONAL DERIVATIVES COMMAND RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono">
        {ledger.map((item) => (
          <div
            key={item.label}
            className={cn(
              "border border-border bg-surface p-2 rounded-none shadow-xs cell-glow space-y-0.5",
              item.tone === "up" && "border-up/40 bg-up/[0.02]",
              item.tone === "down" && "border-down/40 bg-down/[0.02]",
              item.tone === "gold" && "border-gold/40 bg-gold/[0.02]",
              item.tone === "accent" && "border-accent/40 bg-accent/[0.02]",
            )}
          >
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold truncate" title={item.label}>
              {item.label}
            </div>
            <div
              className={cn(
                "font-mono text-xs sm:text-sm font-black tabular-nums truncate",
                item.tone === "up" && "text-up",
                item.tone === "down" && "text-down",
                item.tone === "gold" && "text-gold",
                item.tone === "accent" && "text-accent",
                item.tone === "neutral" && "text-foreground",
              )}
            >
              {item.value}
            </div>
            <div className="text-3xs text-muted-foreground truncate" title={item.detail}>
              {item.detail}
            </div>
          </div>
        ))}
      </div>

      <p className="max-w-[75ch] text-xs text-muted-foreground mt-1">
        Call writers are most heavily positioned at {chain.resistance.map((r) => n(r.strike)).join(", ")}, and put writers at{" "}
        {chain.support.map((r) => n(r.strike)).join(", ")}: the levels the market is defending on either side for the {day(chain.expiry)} expiry.
        {chain.impliedMove
          ? ` The at-the-money straddle prices a move of about ${chain.impliedMove.pct.toFixed(1)}% either way by then.`
          : ""}
      </p>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <caption className="sr-only">Calls on the left, puts on the right, strikes in the middle</caption>
          <thead>
            <tr className="text-3xs text-muted-foreground font-mono uppercase tracking-wider bg-surface-muted/40">
              <th colSpan={5} scope="colgroup" className="px-2 py-1 text-left font-bold text-accent">Calls</th>
              <th scope="col" className="px-2 py-1 text-center font-bold">Strike</th>
              <th colSpan={5} scope="colgroup" className="px-2 py-1 text-right font-bold text-gold">Puts</th>
            </tr>
            <tr className="border-b border-border text-3xs text-muted-foreground font-mono uppercase tracking-wider">
              {["OI", "Δ OI", "IV", "Delta", "LTP"].map((h) => (
                <th key={`c-${h}`} scope="col" className="px-2 py-1 text-right font-medium">{h}</th>
              ))}
              <th scope="col" className="px-2 py-1 text-center font-bold text-foreground">Strike</th>
              {["LTP", "Delta", "IV", "Δ OI", "OI"].map((h) => (
                <th key={`p-${h}`} scope="col" className="px-2 py-1 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const atm = r.strike === chain.atmStrike;
              const itmCall = r.strike < chain.underlying;
              return (
                <tr key={r.strike} className={cn("border-b border-border/50 hover:bg-surface-muted/60 transition-colors group", atm && "bg-accent/5")}>
                  <OiCell oi={r.ce?.oi ?? null} max={maxOi} side="ce" />
                  <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", (r.ce?.oiChange ?? 0) > 0 ? "text-up" : (r.ce?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                    {lakh(r.ce?.oiChange)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{r.ce?.iv != null ? r.ce.iv.toFixed(1) : "—"}{r.ce?.stale ? "*" : ""}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{r.ce?.greeks ? r.ce.greeks.delta.toFixed(2) : "—"}</td>
                  <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", itmCall && "font-medium", r.ce?.stale && "text-muted-foreground")}>{n(r.ce?.ltp, 2)}</td>
                  {(() => {
                    const isMaxPain = chain.maxPain === r.strike;
                    const isCallWall = chain.resistance?.[0]?.strike === r.strike;
                    const isPutWall = chain.support?.[0]?.strike === r.strike;

                    return (
                      <th
                        scope="row"
                        className={cn(
                          "px-2 py-1 text-center font-mono tabular-nums group-hover:bg-surface-muted transition-colors",
                          atm ? "font-extrabold text-foreground bg-accent/10 border-x-2 border-accent" : "font-semibold text-foreground/90",
                          isMaxPain && "bg-gold/10 text-gold",
                        )}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="flex items-center gap-1 text-xs">
                            {atm ? <span className="inline-block h-2.5 w-1 bg-gold" aria-hidden /> : null}
                            {n(r.strike)}
                          </span>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {isMaxPain && (
                              <span className="px-1 py-0.2 bg-gold/20 text-gold text-3xs font-extrabold border border-gold/40">
                                PAIN
                              </span>
                            )}
                            {isCallWall && (
                              <span className="px-1 py-0.2 bg-down/20 text-down text-3xs font-extrabold border border-down/40">
                                RESIST
                              </span>
                            )}
                            {isPutWall && (
                              <span className="px-1 py-0.2 bg-up/20 text-up text-3xs font-extrabold border border-up/40">
                                SUPPORT
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })()}
                  <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", !itmCall && "font-medium", r.pe?.stale && "text-muted-foreground")}>{n(r.pe?.ltp, 2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{r.pe?.greeks ? r.pe.greeks.delta.toFixed(2) : "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">{r.pe?.iv != null ? r.pe.iv.toFixed(1) : "—"}{r.pe?.stale ? "*" : ""}</td>
                  <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", (r.pe?.oiChange ?? 0) > 0 ? "text-up" : (r.pe?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                    {lakh(r.pe?.oiChange)}
                  </td>
                  <OiCell oi={r.pe?.oi ?? null} max={maxOi} side="pe" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {chain.vetting.ok
          ? `Checked: ${chain.vetting.checks.map((c) => c.check).join("; ")}.`
          : `Not consistent: ${failed.map((c) => `${c.check} (${c.gapPct}% apart)`).join("; ")}.`}{" "}
        {chain.staleLegs
          ? `${chain.staleLegs} quotes, marked * and dimmed, carry an implied volatility far from their strike's: their last trade is old, so read their prices with care. `
          : ""}
        Greeks are Black-Scholes at each strike&apos;s out-of-the-money implied volatility, with a 6.5% rate. Strikes {STRIKES_EACH_SIDE} either side of the
        money; open interest in contracts.
      </p>
    </div>
  );
}
