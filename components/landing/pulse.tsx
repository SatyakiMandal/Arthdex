"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ApiPulse } from "@/lib/api/types";
import { cn, formatINR, formatPct } from "@/lib/utils";

type Stock = ApiPulse["stocks"][number];

/** One decimal, signed, and never "-0.0" for a move that rounds to nothing. */
function tileChange(change: number): string {
  const r = Math.round(change * 10) / 10;
  if (r === 0) return "0.0";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
}

/** Tint strength grows with the size of the move and saturates at three percent. */
function tint(change: number): string {
  const strength = Math.min(Math.abs(change) / 3, 1);
  if (change === 0) return "hsl(var(--muted))";
  const tone = change > 0 ? "--up" : "--down";
  return `hsl(var(${tone}) / ${(0.1 + strength * 0.38).toFixed(2)})`;
}

/**
 * Market pulse: every member of the index as one tile, largest company first,
 * coloured by today's move. Hovering a tile reads it out below the grid; hovering
 * a sector lights up its members. It is the market itself, not a decoration.
 */
export function Pulse({ pulse }: { pulse: ApiPulse }) {
  const [focus, setFocus] = useState<Stock | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const sectors = useMemo(() => pulse.sectors.slice(0, 8), [pulse.sectors]);
  const m = pulse.market;
  const advShare = m.total ? (m.advances / m.total) * 100 : 0;
  const decShare = m.total ? (m.declines / m.total) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{pulse.label}, every member</p>
        <p className="font-mono text-2xs text-muted-foreground tabular-nums">
          <span className="text-up">{pulse.advances} up</span>
          <span className="mx-1.5 text-border">/</span>
          <span className="text-down">{pulse.declines} down</span>
        </p>
      </div>

      <div
        className="grid grid-cols-7 gap-px bg-border p-px"
        role="group"
        aria-label={`${pulse.label} members by today's move`}
        onMouseLeave={() => setFocus(null)}
      >
        {pulse.stocks.map((s, i) => {
          const dim = sector !== null && s.industry !== sector;
          return (
            <Link
              key={s.symbol}
              href={`/company/${s.symbol}`}
              onMouseEnter={() => setFocus(s)}
              onFocus={() => setFocus(s)}
              className={cn(
                "pulse-tile group relative flex aspect-[2/1] flex-col justify-between bg-surface p-1.5 outline-none transition-opacity duration-200 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:p-2",
              )}
              style={{ ["--i" as string]: i }}
            >
              <span className="absolute inset-0 transition-colors" style={{ backgroundColor: tint(s.changePct) }} aria-hidden />
              <span className="absolute inset-0 ring-1 ring-inset ring-transparent transition-shadow group-hover:ring-foreground/70" aria-hidden />
              <span className="relative truncate font-mono text-[0.625rem] font-medium leading-none sm:text-2xs">{s.symbol}</span>
              <span className="relative font-mono text-[0.625rem] leading-none tabular-nums text-foreground sm:text-2xs">
                {tileChange(s.changePct)}
              </span>
              <span className="sr-only">, {s.name}</span>
              {/* Dimming sits on an overlay: the entrance animation owns the tile's own opacity */}
              <span className={cn("absolute inset-0 bg-surface transition-opacity duration-200", dim ? "opacity-80" : "opacity-0")} aria-hidden />
            </Link>
          );
        })}
      </div>

      {/* Read-out: fixed height so hovering never shifts the layout */}
      <div className="flex h-[3.25rem] items-center border-y border-border px-4 text-sm" aria-live="polite">
        {focus ? (
          <div className="flex w-full items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{focus.name}</p>
              <p className="truncate text-2xs text-muted-foreground">{focus.industry}</p>
            </div>
            <div className="shrink-0 text-right font-mono tabular-nums">
              <p>
                ₹{formatINR(focus.last, 2)}{" "}
                <span className={focus.changePct >= 0 ? "text-up" : "text-down"}>{formatPct(focus.changePct)}</span>
              </p>
              {focus.marketCapCr ? <p className="text-2xs text-muted-foreground">₹{formatINR(focus.marketCapCr, 0)} Cr</p> : null}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Point at a company for its price and size, or at a sector to light up its members.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-3" onMouseLeave={() => setSector(null)}>
        {sectors.map((s) => (
          <button
            key={s.industry}
            type="button"
            onMouseEnter={() => setSector(s.industry)}
            onFocus={() => setSector(s.industry)}
            onBlur={() => setSector(null)}
            onClick={() => setSector((v) => (v === s.industry ? null : s.industry))}
            aria-pressed={sector === s.industry}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 text-2xs transition-colors",
              sector === s.industry ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40",
            )}
          >
            {s.industry.replace(" & Consumable Fuels", "").replace("Fast Moving Consumer Goods", "FMCG")}
            <span className={cn("font-mono tabular-nums", sector === s.industry ? "" : s.changePct >= 0 ? "text-up" : "text-down")}>
              {formatPct(s.changePct, 1)}
            </span>
          </button>
        ))}
      </div>

      {/* Whole-market breadth, all NSE securities that traded today */}
      <div className="mt-auto border-t border-border px-4 py-3">
        <div className="flex h-1.5 overflow-hidden rounded-full" aria-hidden>
          <span className="bg-up" style={{ width: `${advShare}%` }} />
          <span className="bg-muted-foreground/30" style={{ width: `${100 - advShare - decShare}%` }} />
          <span className="bg-down" style={{ width: `${decShare}%` }} />
        </div>
        <p className="mt-2 flex justify-between font-mono text-2xs text-muted-foreground tabular-nums">
          <span>{formatINR(m.advances, 0)} advancing</span>
          <span>across {formatINR(m.total, 0)} NSE securities</span>
          <span>{formatINR(m.declines, 0)} declining</span>
        </p>
      </div>
    </div>
  );
}
