"use client";

import { useState } from "react";
import { Compass, RotateCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiSectorRotation, ApiSectorRotationSector } from "@/lib/api/types";

const QUADRANT_COLORS = {
  Leading: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    dot: "#10b981",
  },
  Weakening: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-500",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    dot: "#f59e0b",
  },
  Lagging: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-500",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    dot: "#f43f5e",
  },
  Improving: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-500",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    dot: "#3b82f6",
  },
};

export function SectorRotationRrg({
  rotationData,
}: {
  rotationData: ApiSectorRotation;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sectors = rotationData.sectors ?? [];

  // SVG coordinate dimensions
  const svgWidth = 600;
  const svgHeight = 440;
  const padding = 50;

  // Calculate dynamic domain based on RS-Ratio and RS-Momentum across sectors and trails
  const allX: number[] = [100];
  const allY: number[] = [100];

  sectors.forEach((s) => {
    allX.push(s.rsRatio);
    allY.push(s.rsMomentum);
    s.trail.forEach((t) => {
      allX.push(t.rsRatio);
      allY.push(t.rsMomentum);
    });
  });

  const minX = Math.min(94, Math.floor(Math.min(...allX) - 1));
  const maxX = Math.max(106, Math.ceil(Math.max(...allX) + 1));
  const minY = Math.min(94, Math.floor(Math.min(...allY) - 1));
  const maxY = Math.max(106, Math.ceil(Math.max(...allY) + 1));

  function scaleX(val: number): number {
    return padding + ((val - minX) / (maxX - minX)) * (svgWidth - 2 * padding);
  }

  function scaleY(val: number): number {
    // Invert SVG Y axis so higher momentum is at top
    return svgHeight - padding - ((val - minY) / (maxY - minY)) * (svgHeight - 2 * padding);
  }

  const cx = scaleX(100);
  const cy = scaleY(100);

  const selectedSector = sectors.find((s) => s.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Intro info bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span>
            Benchmark: <strong className="text-foreground">{rotationData.benchmark} ({rotationData.benchmarkSymbol})</strong>
          </span>
          <span className="text-border">|</span>
          <span>Center: <strong>(100, 100)</strong></span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <RotateCw className="h-3 w-3 text-primary animate-spin-slow" /> Clockwise Rotation Cycle
          </span>
        </div>
        <div className="text-2xs font-mono">
          Last Calculated: {new Date(rotationData.calculatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RRG Scatter Canvas (8 cols) */}
        <div className="lg:col-span-8 rounded-lg border border-border bg-card/60 p-4 relative overflow-hidden">
          <div className="absolute top-3 left-4 text-3xs font-semibold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Relative Rotation Graph (JdK RRG®)
          </div>

          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none"
            style={{ maxHeight: "480px" }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="6"
                markerHeight="6"
                refX="4"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 6 3, 0 6" fill="currentColor" opacity="0.8" />
              </marker>
            </defs>

            {/* Quadrant Background Shading */}
            {/* Top-Right: Leading (Green) */}
            <rect
              x={cx}
              y={padding}
              width={svgWidth - padding - cx}
              height={cy - padding}
              fill="#10b981"
              fillOpacity="0.04"
            />
            {/* Bottom-Right: Weakening (Amber) */}
            <rect
              x={cx}
              y={cy}
              width={svgWidth - padding - cx}
              height={svgHeight - padding - cy}
              fill="#f59e0b"
              fillOpacity="0.04"
            />
            {/* Bottom-Left: Lagging (Rose) */}
            <rect
              x={padding}
              y={cy}
              width={cx - padding}
              height={svgHeight - padding - cy}
              fill="#f43f5e"
              fillOpacity="0.04"
            />
            {/* Top-Left: Improving (Blue) */}
            <rect
              x={padding}
              y={padding}
              width={cx - padding}
              height={cy - padding}
              fill="#3b82f6"
              fillOpacity="0.04"
            />

            {/* Crosshairs at (100, 100) */}
            <line
              x1={cx}
              y1={padding}
              x2={cx}
              y2={svgHeight - padding}
              stroke="currentColor"
              strokeDasharray="4,4"
              strokeWidth="1.5"
              className="text-border"
            />
            <line
              x1={padding}
              y1={cy}
              x2={svgWidth - padding}
              y2={cy}
              stroke="currentColor"
              strokeDasharray="4,4"
              strokeWidth="1.5"
              className="text-border"
            />

            {/* Quadrant Watermark Labels */}
            <text
              x={svgWidth - padding - 10}
              y={padding + 22}
              textAnchor="end"
              className="fill-emerald-500/70 text-2xs font-bold tracking-wider uppercase font-sans"
            >
              LEADING (RS+ / Mom+)
            </text>
            <text
              x={svgWidth - padding - 10}
              y={svgHeight - padding - 14}
              textAnchor="end"
              className="fill-amber-500/70 text-2xs font-bold tracking-wider uppercase font-sans"
            >
              WEAKENING (RS+ / Mom-)
            </text>
            <text
              x={padding + 10}
              y={svgHeight - padding - 14}
              textAnchor="start"
              className="fill-rose-500/70 text-2xs font-bold tracking-wider uppercase font-sans"
            >
              LAGGING (RS- / Mom-)
            </text>
            <text
              x={padding + 10}
              y={padding + 22}
              textAnchor="start"
              className="fill-blue-500/70 text-2xs font-bold tracking-wider uppercase font-sans"
            >
              IMPROVING (RS- / Mom+)
            </text>

            {/* Axes Labels */}
            <text
              x={svgWidth / 2}
              y={svgHeight - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-3xs font-mono font-medium"
            >
              RS-Ratio (Trend vs Nifty 50) →
            </text>
            <text
              x={14}
              y={svgHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${svgHeight / 2})`}
              className="fill-muted-foreground text-3xs font-mono font-medium"
            >
              RS-Momentum (Acceleration) →
            </text>

            {/* Historical Trails & Vectors */}
            {sectors.map((s) => {
              const isSelected = selectedId === s.id;
              const points = [...s.trail, { date: "today", rsRatio: s.rsRatio, rsMomentum: s.rsMomentum }];
              const pathD = points
                .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.rsRatio).toFixed(1)} ${scaleY(p.rsMomentum).toFixed(1)}`)
                .join(" ");

              const quadColor = QUADRANT_COLORS[s.quadrant] || QUADRANT_COLORS.Leading;

              return (
                <g key={`trail-${s.id}`}>
                  {/* Trail line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={quadColor.dot}
                    strokeWidth={isSelected ? "2.5" : "1.2"}
                    strokeOpacity={isSelected ? 1.0 : selectedId ? 0.2 : 0.65}
                    strokeDasharray={isSelected ? "none" : "2,2"}
                  />

                  {/* Trail history dots */}
                  {s.trail.map((t, idx) => (
                    <circle
                      key={`dot-${s.id}-${idx}`}
                      cx={scaleX(t.rsRatio)}
                      cy={scaleY(t.rsMomentum)}
                      r={isSelected ? 3 : 2}
                      fill={quadColor.dot}
                      fillOpacity={isSelected ? 0.8 : 0.35}
                    />
                  ))}
                </g>
              );
            })}

            {/* Current Positions & Labels */}
            {sectors.map((s) => {
              const isSelected = selectedId === s.id;
              const currX = scaleX(s.rsRatio);
              const currY = scaleY(s.rsMomentum);
              const quadColor = QUADRANT_COLORS[s.quadrant] || QUADRANT_COLORS.Leading;
              const label = s.name.replace(/^Nifty\s+/i, "");

              return (
                <g
                  key={s.id}
                  className="cursor-pointer transition-all"
                  onClick={() => setSelectedId(isSelected ? null : s.id)}
                >
                  {/* Outer halo if selected */}
                  {isSelected && (
                    <circle
                      cx={currX}
                      cy={currY}
                      r={14}
                      fill={quadColor.dot}
                      fillOpacity="0.25"
                      stroke={quadColor.dot}
                      strokeWidth="1.5"
                    />
                  )}

                  {/* Main current dot */}
                  <circle
                    cx={currX}
                    cy={currY}
                    r={isSelected ? 6 : 5}
                    fill={quadColor.dot}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="drop-shadow-sm"
                  />

                  {/* Sector Tag */}
                  <g transform={`translate(${currX + 8}, ${currY - 8})`}>
                    <rect
                      x={-2}
                      y={-10}
                      width={label.length * 6.5 + 8}
                      height={16}
                      rx={3}
                      fill="#0f172a"
                      fillOpacity={isSelected ? 0.95 : 0.8}
                      stroke={isSelected ? quadColor.dot : "currentColor"}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                      className={cn(isSelected ? "" : "text-border")}
                    />
                    <text
                      x={2}
                      y={2}
                      className={cn(
                        "text-3xs font-mono font-bold tracking-tight",
                        isSelected ? quadColor.text : "fill-foreground",
                      )}
                    >
                      {label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Sector Ledger / Quadrant Detail List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Sectors by Quadrant</span>
            <span className="font-mono text-3xs">{sectors.length} Sectors</span>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {sectors.map((s) => {
              const isSelected = selectedId === s.id;
              const quad = QUADRANT_COLORS[s.quadrant] || QUADRANT_COLORS.Leading;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(isSelected ? null : s.id)}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-all",
                    isSelected
                      ? cn("border-primary/80 bg-primary/10 shadow-sm ring-1 ring-primary/40")
                      : "border-border/80 bg-card hover:border-border hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-foreground font-sans">
                      {s.name}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider border",
                        quad.badge,
                      )}
                    >
                      {s.quadrant}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-2xs font-mono border-t border-border/40 pt-2">
                    <div>
                      <div className="text-3xs text-muted-foreground font-sans">RS-Ratio</div>
                      <div className="font-medium text-foreground">{s.rsRatio.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-3xs text-muted-foreground font-sans">Momentum</div>
                      <div className="font-medium text-foreground">{s.rsMomentum.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-3xs text-muted-foreground font-sans">1W Return</div>
                      <div
                        className={cn(
                          "font-medium",
                          s.change1wPct !== null && s.change1wPct >= 0
                            ? "text-emerald-500"
                            : "text-rose-500",
                        )}
                      >
                        {s.change1wPct !== null
                          ? `${s.change1wPct >= 0 ? "+" : ""}${s.change1wPct.toFixed(2)}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSector && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs text-foreground">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">{selectedSector.name} Rotation Vector</span>
            <button
              onClick={() => setSelectedId(null)}
              className="text-2xs text-muted-foreground hover:text-foreground"
            >
              Clear Focus
            </button>
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">
            Currently in the <strong className="text-foreground">{selectedSector.quadrant}</strong> quadrant against Nifty 50.
            {selectedSector.quadrant === "Leading" && " Outperforming Nifty with positive relative momentum. Candidate for trend-following overweights."}
            {selectedSector.quadrant === "Weakening" && " Outperforming Nifty overall, but relative momentum is slowing down. Look for topping signs."}
            {selectedSector.quadrant === "Lagging" && " Underperforming Nifty with negative relative momentum. Candidate for underweights or hedging."}
            {selectedSector.quadrant === "Improving" && " Still underperforming overall, but relative momentum is accelerating upwards. Candidate for early rotation entries."}
          </p>
        </div>
      )}
    </div>
  );
}
