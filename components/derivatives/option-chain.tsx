"use client";

import { useMemo, useState } from "react";
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

  // Identify institutional strike walls
  const primaryCallWall = chain.resistance?.[0]?.strike ?? null;
  const secondaryCallWall = chain.resistance?.[1]?.strike ?? null;
  const primaryPutWall = chain.support?.[0]?.strike ?? null;
  const secondaryPutWall = chain.support?.[1]?.strike ?? null;

  const wallStrikes = useMemo(() => {
    const set = new Set<number>();
    if (chain.atmStrike) set.add(chain.atmStrike);
    if (chain.maxPain) set.add(chain.maxPain);
    if (primaryCallWall) set.add(primaryCallWall);
    if (secondaryCallWall) set.add(secondaryCallWall);
    if (primaryPutWall) set.add(primaryPutWall);
    if (secondaryPutWall) set.add(secondaryPutWall);

    // Top 3 Call & Put OI strikes if not already covered
    const topCe = [...chain.rows].sort((a, b) => (b.ce?.oi ?? 0) - (a.ce?.oi ?? 0)).slice(0, 3);
    const topPe = [...chain.rows].sort((a, b) => (b.pe?.oi ?? 0) - (a.pe?.oi ?? 0)).slice(0, 3);
    topCe.forEach((r) => set.add(r.strike));
    topPe.forEach((r) => set.add(r.strike));
    return set;
  }, [chain, primaryCallWall, secondaryCallWall, primaryPutWall, secondaryPutWall]);

  const baseRows =
    strikeDepth === 0
      ? chain.rows
      : chain.rows.slice(Math.max(0, safeAtmIndex - strikeDepth), safeAtmIndex + strikeDepth + 1);

  // If in "walls" mode, filter table strictly to institutional walls
  const rows = chainMode === "walls"
    ? chain.rows.filter((r) => wallStrikes.has(r.strike))
    : baseRows;

  const maxOi = Math.max(1, ...rows.flatMap((r) => [r.ce?.oi ?? 0, r.pe?.oi ?? 0]));

  // Total OI & Market Balance Calculations
  const totalCeOi = chain.rows.reduce((acc, r) => acc + (r.ce?.oi ?? 0), 0);
  const totalPeOi = chain.rows.reduce((acc, r) => acc + (r.pe?.oi ?? 0), 0);
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

  // Call Wall distance metrics
  const callWallDist = primaryCallWall ? primaryCallWall - chain.underlying : null;
  const putWallDist = primaryPutWall ? chain.underlying - primaryPutWall : null;
  const corridorWidth = primaryCallWall && primaryPutWall ? primaryCallWall - primaryPutWall : null;

  return (
    <div className="space-y-3">
      {/* Expiry Bar, Mode Switcher, and Depth Controls */}
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
                onClick={() => setChainMode(m.id as "core" | "greeks" | "walls")}
                className={cn(
                  "px-2.5 py-1 font-bold uppercase rounded-none transition-colors",
                  chainMode === m.id
                    ? "bg-foreground text-background shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
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
                    ? "bg-accent text-accent-foreground border-accent shadow-xs"
                    : "bg-surface-muted/50 border-border text-muted-foreground hover:text-foreground",
                  chainMode === "walls" && "opacity-50 cursor-not-allowed",
                )}
                disabled={chainMode === "walls"}
                title={chainMode === "walls" ? "Depth auto-managed in Strike Walls mode" : undefined}
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

      {/* STRIKE WALLS SPECIALIZED DEFENSE PERIMETER HUD (Shown when in 'walls' mode) */}
      {chainMode === "walls" && (
        <div className="border border-gold/40 bg-gold/[0.03] p-2.5 rounded-none font-mono text-2xs animate-in fade-in-50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-1.5 mb-2">
            <span className="font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Strike Walls Defense Perimeter & Open Interest Concentration</span>
            </span>
            <span className="text-3xs text-muted-foreground">
              Filtering to {rows.length} Primary Institutional Concentration Levels
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
            <div className="border border-border/80 bg-surface/70 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">Primary Call Wall (Ceiling)</span>
              <div className="text-sm font-bold text-down font-mono">
                {primaryCallWall ? `₹${formatINR(primaryCallWall, 0)}` : "—"}
              </div>
              <div className="text-3xs text-muted-foreground">
                {callWallDist != null ? `+₹${callWallDist.toFixed(1)} (+${((callWallDist / chain.underlying) * 100).toFixed(1)}% above CMP)` : "—"}
              </div>
            </div>

            <div className="border border-border/80 bg-surface/70 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">Primary Put Wall (Floor)</span>
              <div className="text-sm font-bold text-up font-mono">
                {primaryPutWall ? `₹${formatINR(primaryPutWall, 0)}` : "—"}
              </div>
              <div className="text-3xs text-muted-foreground">
                {putWallDist != null ? `-₹${putWallDist.toFixed(1)} (-${((putWallDist / chain.underlying) * 100).toFixed(1)}% below CMP)` : "—"}
              </div>
            </div>

            <div className="border border-border/80 bg-surface/70 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">Wall Defense Corridor</span>
              <div className="text-sm font-bold text-accent font-mono">
                {corridorWidth != null ? `₹${formatINR(corridorWidth, 0)} pts` : "—"}
              </div>
              <div className="text-3xs text-muted-foreground">
                {corridorWidth != null ? `Span: ${((corridorWidth / chain.underlying) * 100).toFixed(1)}% of CMP` : "—"}
              </div>
            </div>

            <div className="border border-border/80 bg-surface/70 p-2 rounded-none">
              <span className="text-3xs text-muted-foreground uppercase">Max Pain Settlement</span>
              <div className="text-sm font-bold text-gold font-mono">
                {chain.maxPain != null ? `₹${formatINR(chain.maxPain, 0)}` : "—"}
              </div>
              <div className="text-3xs text-muted-foreground">
                {maxPainDiff != null ? `${maxPainDiff >= 0 ? "+" : ""}₹${maxPainDiff.toFixed(1)} gravity bias` : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL GREEKS CONTEXT BANNER (Shown when in 'greeks' mode) */}
      {chainMode === "greeks" && (
        <div className="border border-accent/40 bg-accent/[0.03] px-3 py-1.5 rounded-none font-mono text-2xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in-50">
          <span className="text-accent font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>Black-Scholes Greek Sensitivity Matrix (Δ Delta, Γ Gamma, Θ Theta/day, ν Vega/%IV)</span>
          </span>
          <span className="text-3xs text-muted-foreground">
            Interest Rate: 6.50% · Implied Volatility: Out-of-the-money fitted
          </span>
        </div>
      )}

      {/* OPTION CHAIN DYNAMIC DATA TABLE */}
      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full min-w-[920px] border-collapse text-xs font-mono">
          <caption className="sr-only">Calls on the left, puts on the right, strikes in the middle</caption>
          <thead>
            {/* Top Table Classification Bar */}
            <tr className="text-3xs text-muted-foreground font-mono uppercase tracking-wider bg-surface-muted/50 border-b border-border/80">
              <th colSpan={chainMode === "greeks" ? 5 : chainMode === "walls" ? 4 : 4} scope="colgroup" className="px-2.5 py-1 text-left font-bold text-accent">
                Calls (CE) · {chainMode === "greeks" ? "Risk Sensitivities" : chainMode === "walls" ? "Resistance Perimeter" : "Buyer/Writer Ledger"}
              </th>
              <th scope="col" className="px-2.5 py-1 text-center font-bold text-foreground">
                Strike Price
              </th>
              <th colSpan={chainMode === "greeks" ? 5 : chainMode === "walls" ? 4 : 4} scope="colgroup" className="px-2.5 py-1 text-right font-bold text-gold">
                Puts (PE) · {chainMode === "greeks" ? "Risk Sensitivities" : chainMode === "walls" ? "Support Perimeter" : "Buyer/Writer Ledger"}
              </th>
            </tr>

            {/* Column Headers by Active Mode */}
            <tr className="border-b border-border text-3xs text-muted-foreground font-mono uppercase tracking-wider bg-surface/80">
              {chainMode === "core" && (
                <>
                  <th scope="col" className="px-2 py-1 text-right font-medium">OI Bar</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Δ OI</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">IV</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">LTP</th>
                  <th scope="col" className="px-2.5 py-1 text-center font-bold text-foreground">Strike</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">LTP</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">IV</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Δ OI</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">OI Bar</th>
                </>
              )}

              {chainMode === "greeks" && (
                <>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Delta (Δ)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Gamma (Γ)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Theta (Θ)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Vega (ν)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">IV</th>
                  <th scope="col" className="px-2.5 py-1 text-center font-bold text-foreground">Strike</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">IV</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Vega (ν)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Theta (Θ)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Gamma (Γ)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Delta (Δ)</th>
                </>
              )}

              {chainMode === "walls" && (
                <>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Call OI</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">OI Share %</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Δ OI</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">LTP</th>
                  <th scope="col" className="px-2.5 py-1 text-center font-bold text-foreground">Strike Level</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">LTP</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Δ OI</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">OI Share %</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Put OI</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const atm = r.strike === chain.atmStrike;
              const itmCall = r.strike < chain.underlying;
              const isMaxPain = chain.maxPain === r.strike;
              const isCallWall1 = primaryCallWall === r.strike;
              const isCallWall2 = secondaryCallWall === r.strike;
              const isPutWall1 = primaryPutWall === r.strike;
              const isPutWall2 = secondaryPutWall === r.strike;

              const ceSharePct = totalCeOi > 0 && r.ce?.oi ? ((r.ce.oi / totalCeOi) * 100).toFixed(1) : "—";
              const peSharePct = totalPeOi > 0 && r.pe?.oi ? ((r.pe.oi / totalPeOi) * 100).toFixed(1) : "—";

              return (
                <tr
                  key={r.strike}
                  className={cn(
                    "border-b border-border/50 hover:bg-surface-muted/60 transition-colors group",
                    atm && "bg-accent/[0.04]",
                    isMaxPain && "bg-gold/[0.03]",
                  )}
                >
                  {/* LEFT WING: CALLS */}
                  {chainMode === "core" && (
                    <>
                      <OiCell oi={r.ce?.oi ?? null} max={maxOi} side="ce" />
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", (r.ce?.oiChange ?? 0) > 0 ? "text-up" : (r.ce?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                        {lakh(r.ce?.oiChange)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.ce?.iv != null ? `${r.ce.iv.toFixed(1)}%` : "—"}{r.ce?.stale ? "*" : ""}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", itmCall && "font-semibold text-foreground", r.ce?.stale && "text-muted-foreground")}>
                        {n(r.ce?.ltp, 2)}
                      </td>
                    </>
                  )}

                  {chainMode === "greeks" && (
                    <>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", (r.ce?.greeks?.delta ?? 0) > 0.5 && "font-bold text-accent")}>
                        {r.ce?.greeks?.delta != null ? r.ce.greeks.delta.toFixed(3) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.ce?.greeks?.gamma != null ? r.ce.greeks.gamma.toFixed(4) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-down cell-glow">
                        {r.ce?.greeks?.theta != null ? r.ce.greeks.theta.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.ce?.greeks?.vega != null ? r.ce.greeks.vega.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.ce?.iv != null ? `${r.ce.iv.toFixed(1)}%` : "—"}
                      </td>
                    </>
                  )}

                  {chainMode === "walls" && (
                    <>
                      <OiCell oi={r.ce?.oi ?? null} max={maxOi} side="ce" />
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold text-muted-foreground cell-glow">
                        {ceSharePct !== "—" ? `${ceSharePct}%` : "—"}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", (r.ce?.oiChange ?? 0) > 0 ? "text-up" : (r.ce?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                        {lakh(r.ce?.oiChange)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", itmCall && "font-semibold")}>
                        {n(r.ce?.ltp, 2)}
                      </td>
                    </>
                  )}

                  {/* CENTER: STRIKE WITH WALL TAGS */}
                  <th
                    scope="row"
                    className={cn(
                      "px-2 py-1 text-center font-mono tabular-nums group-hover:bg-surface-muted transition-colors border-x border-border/40",
                      atm ? "font-extrabold text-foreground bg-accent/15 border-x-2 border-accent" : "font-semibold text-foreground/90",
                      isMaxPain && "bg-gold/15 text-gold",
                      isCallWall1 && "bg-down/10",
                      isPutWall1 && "bg-up/10",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="flex items-center gap-1 text-xs">
                        {atm ? <span className="inline-block h-2 w-1 bg-gold" aria-hidden /> : null}
                        {n(r.strike)}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-0.5 mt-0.5">
                        {isCallWall1 && (
                          <span className="px-1 py-0.2 bg-down/20 text-down text-3xs font-extrabold border border-down/40 rounded-none">
                            CALL WALL 1
                          </span>
                        )}
                        {isCallWall2 && (
                          <span className="px-1 py-0.2 bg-down/15 text-down/80 text-3xs font-bold border border-down/30 rounded-none">
                            WALL 2
                          </span>
                        )}
                        {isPutWall1 && (
                          <span className="px-1 py-0.2 bg-up/20 text-up text-3xs font-extrabold border border-up/40 rounded-none">
                            PUT WALL 1
                          </span>
                        )}
                        {isPutWall2 && (
                          <span className="px-1 py-0.2 bg-up/15 text-up/80 text-3xs font-bold border border-up/30 rounded-none">
                            WALL 2
                          </span>
                        )}
                        {isMaxPain && (
                          <span className="px-1 py-0.2 bg-gold/20 text-gold text-3xs font-extrabold border border-gold/40 rounded-none">
                            MAX PAIN
                          </span>
                        )}
                        {atm && (
                          <span className="px-1 py-0.2 bg-accent/20 text-accent text-3xs font-extrabold border border-accent/40 rounded-none">
                            ATM
                          </span>
                        )}
                      </div>
                    </div>
                  </th>

                  {/* RIGHT WING: PUTS */}
                  {chainMode === "core" && (
                    <>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", !itmCall && "font-semibold text-foreground", r.pe?.stale && "text-muted-foreground")}>
                        {n(r.pe?.ltp, 2)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.pe?.iv != null ? `${r.pe.iv.toFixed(1)}%` : "—"}{r.pe?.stale ? "*" : ""}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", (r.pe?.oiChange ?? 0) > 0 ? "text-up" : (r.pe?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                        {lakh(r.pe?.oiChange)}
                      </td>
                      <OiCell oi={r.pe?.oi ?? null} max={maxOi} side="pe" />
                    </>
                  )}

                  {chainMode === "greeks" && (
                    <>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.pe?.iv != null ? `${r.pe.iv.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.pe?.greeks?.vega != null ? r.pe.greeks.vega.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-down cell-glow">
                        {r.pe?.greeks?.theta != null ? r.pe.greeks.theta.toFixed(2) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground cell-glow">
                        {r.pe?.greeks?.gamma != null ? r.pe.greeks.gamma.toFixed(4) : "—"}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", Math.abs(r.pe?.greeks?.delta ?? 0) > 0.5 && "font-bold text-gold")}>
                        {r.pe?.greeks?.delta != null ? r.pe.greeks.delta.toFixed(3) : "—"}
                      </td>
                    </>
                  )}

                  {chainMode === "walls" && (
                    <>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", !itmCall && "font-semibold")}>
                        {n(r.pe?.ltp, 2)}
                      </td>
                      <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums cell-glow", (r.pe?.oiChange ?? 0) > 0 ? "text-up" : (r.pe?.oiChange ?? 0) < 0 ? "text-down" : "")}>
                        {lakh(r.pe?.oiChange)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums font-semibold text-muted-foreground cell-glow">
                        {peSharePct !== "—" ? `${peSharePct}%` : "—"}
                      </td>
                      <OiCell oi={r.pe?.oi ?? null} max={maxOi} side="pe" />
                    </>
                  )}
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
        Greeks are Black-Scholes at each strike&apos;s out-of-the-money implied volatility, with a 6.5% rate. Open interest in contracts.
      </p>
    </div>
  );
}
