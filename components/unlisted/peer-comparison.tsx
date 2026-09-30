"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SwapPanel } from "@/components/ui/swap-panel";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { cn, formatINR, formatPct } from "@/lib/utils";

export type ComparisonMetric = "pe" | "evEbitda";

export interface ComparisonPeer {
  symbol: string;
  name: string;
  cmp: number;
  peRatio: number;
  evToEbitda: number;
}

const METRIC_OPTIONS: { id: ComparisonMetric; label: string }[] = [
  { id: "pe", label: "P/E" },
  { id: "evEbitda", label: "EV/EBITDA" },
];

const METRIC_META: Record<ComparisonMetric, { label: string; get: (p: ComparisonPeer) => number }> = {
  pe: { label: "P/E", get: (p) => p.peRatio },
  evEbitda: { label: "EV/EBITDA", get: (p) => p.evToEbitda },
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Side-by-side of the unlisted multiple against its listed comparables. The
 * discount is quoted against the listed *median* rather than the mean so one
 * richly-valued peer can't drag the whole comparison.
 */
export function PeerComparison({
  unlistedName,
  unlistedPe,
  unlistedEvEbitda,
  peers,
}: {
  unlistedName: string;
  unlistedPe: number;
  unlistedEvEbitda: number;
  peers: ComparisonPeer[];
}) {
  const [metric, setMetric] = useState<ComparisonMetric>("pe");

  const meta = METRIC_META[metric];
  const unlistedValue = metric === "pe" ? unlistedPe : unlistedEvEbitda;
  const peerValues = peers.map(meta.get);
  const listedMedian = peerValues.length ? median(peerValues) : 0;

  // Negative = unlisted trades cheaper than the listed median
  const discountPct = listedMedian > 0 ? ((unlistedValue - listedMedian) / listedMedian) * 100 : 0;
  const scaleMax = Math.max(unlistedValue, ...peerValues, 1);

  const tone = discountPct <= -10 ? "up" : discountPct >= 10 ? "down" : "flat";
  const toneLabel =
    discountPct <= -10 ? "Discount to listed" : discountPct >= 10 ? "Premium to listed" : "In line with listed";

  return (
    <DataCard
      title="Listed Peer Comparison"
      subtitle={`${unlistedName} versus listed comparables in the same industry`}
      icon={Scale}
      badge={
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
            layoutGroupId="unlisted-comparison-metric"
          />
          <StatusPill label={toneLabel} tone={tone} />
        </div>
      }
      footnote="Unlisted multiples carry an illiquidity and disclosure discount that is not an arbitrage: exit depends on a secondary sale or a listing event, neither of which is guaranteed."
    >
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
        <div className="bg-surface px-4 py-3">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Unlisted {meta.label}
          </div>
          <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
            {unlistedValue.toFixed(1)}
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Listed median {meta.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-semibold tabular-nums">{listedMedian.toFixed(1)}</span>
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                discountPct <= 0 ? "text-up" : "text-down",
              )}
            >
              {formatPct(discountPct, 1)}
            </span>
          </div>
        </div>
      </div>

      <SwapPanel swapKey={metric} className="space-y-2.5 p-4">
          {/* Subject bar, then each listed comparable on the same scale */}
          <ComparisonBar
            label={unlistedName}
            sublabel="Unlisted · last deal"
            value={unlistedValue}
            scaleMax={scaleMax}
            subject
          />
          {peers.map((p) => (
            <ComparisonBar
              key={p.symbol}
              label={p.symbol}
              sublabel={`${p.name} · ₹${formatINR(p.cmp)}`}
              href={`/company/${p.symbol}`}
              value={meta.get(p)}
              scaleMax={scaleMax}
            />
          ))}
      </SwapPanel>
    </DataCard>
  );
}

function ComparisonBar({
  label,
  sublabel,
  value,
  scaleMax,
  subject,
  href,
}: {
  label: string;
  sublabel: string;
  value: number;
  scaleMax: number;
  subject?: boolean;
  href?: string;
}) {
  return (
    <div className={cn("rounded-lg px-2 py-1.5", subject && "bg-accent/[0.07]")}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="font-mono text-xs font-semibold hover:text-accent">
              {label}
            </Link>
          ) : (
            <span className="font-mono text-xs font-semibold">{label}</span>
          )}
          <span className="ml-2 text-2xs text-muted-foreground">{sublabel}</span>
        </div>
        <span className="shrink-0 font-mono text-xs font-medium tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", subject ? "bg-accent" : "bg-muted-foreground/45")}
          style={{ width: `${(value / scaleMax) * 100}%` }}
        />
      </div>
    </div>
  );
}
