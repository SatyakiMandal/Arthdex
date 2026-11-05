"use client";

import { useState } from "react";
import Link from "next/link";
import type { ApiOptionChain } from "@/lib/api/types";
import { cn, formatINR } from "@/lib/utils";

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
  const ledger = [
    { label: "Underlying", value: n(chain.underlying, 2) },
    { label: "Put-call ratio (OI)", value: chain.pcr?.toFixed(2) ?? "—" },
    { label: "Max pain", value: n(chain.maxPain) },
    { label: "ATM implied volatility", value: chain.atmIv != null ? `${chain.atmIv.toFixed(1)}%` : "—" },
    { label: "Move priced in", value: chain.impliedMove ? `±${n(chain.impliedMove.points)} (${chain.impliedMove.pct.toFixed(2)}%)` : "—" },
    { label: "Days to expiry", value: String(chain.daysToExpiry) },
  ];
  const failed = chain.vetting.checks.filter((c) => !c.ok);
  const sym = encodeURIComponent(chain.symbol);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
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

        {/* Strike Depth Selector */}
        <div className="flex items-center gap-1 text-3xs font-mono">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 font-mono">
        {ledger.map((item) => (
          <div key={item.label} className="border border-border bg-surface p-2.5 rounded-none shadow-xs">
            <div className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">{item.label}</div>
            <div className="mt-1 font-mono text-sm sm:text-base font-extrabold text-foreground tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>

      <p className="max-w-[75ch] text-sm text-muted-foreground">
        Call writers are most heavily positioned at {chain.resistance.map((r) => n(r.strike)).join(", ")}, and put writers at{" "}
        {chain.support.map((r) => n(r.strike)).join(", ")}: the levels the market is defending on either side for the {day(chain.expiry)} expiry.
        {chain.impliedMove
          ? ` The at-the-money straddle prices a move of about ${chain.impliedMove.pct.toFixed(1)}% either way by then.`
          : ""}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Calls on the left, puts on the right, strikes in the middle</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th colSpan={5} scope="colgroup" className="pb-1 text-left font-medium">Calls</th>
              <th scope="col" className="pb-1" />
              <th colSpan={5} scope="colgroup" className="pb-1 text-right font-medium">Puts</th>
            </tr>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {["OI", "Change in OI", "IV", "Delta", "Last"].map((h) => (
                <th key={`c-${h}`} scope="col" className="px-2 py-2 text-right font-medium">{h}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-center font-medium">Strike</th>
              {["Last", "Delta", "IV", "Change in OI", "OI"].map((h) => (
                <th key={`p-${h}`} scope="col" className="px-2 py-2 text-right font-medium">{h}</th>
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
