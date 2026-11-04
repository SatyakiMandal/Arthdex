"use client";

import { useId, useState } from "react";
import { Compass, RotateCw, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiSectorRotation, ApiSectorRotationSector } from "@/lib/api/types";

const QUADRANT_COLORS = {
  Leading: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    hex: "#22c55e",
  },
  Weakening: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    hex: "#eab308",
  },
  Lagging: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    hex: "#ef4444",
  },
  Improving: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    hex: "#06b6d4",
  },
};

// Bloomberg color mapping per sector
const BLOOMBERG_SECTOR_COLORS: Record<string, string> = {
  it: "#e879f9", // Magenta (like S5INFT)
  metal: "#ef4444", // Red (like S5MATR)
  energy: "#f97316", // Orange/Red (like S5ENRS)
  auto: "#ea580c", // Industrial orange (like S5INDU)
  bank: "#eab308", // Yellow (like S5FINL)
  pharma: "#84cc16", // Lime Green (like S5HLTH)
  fmcg: "#10b981", // Emerald (like S5CONS)
  realty: "#06b6d4", // Cyan (like S5TELS)
  infra: "#38bdf8", // Sky blue
  pse: "#14b8a6", // Teal
};

export function SectorRotationRrg({
  rotationData,
}: {
  rotationData: ApiSectorRotation;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trailingWeeks, setTrailingWeeks] = useState<4 | 8 | 12>(12);

  const rawSectors = rotationData.sectors ?? [];
  const maskId = useId();

  // SVG dimensions: matching Bloomberg terminal widescreen aspect
  const svgWidth = 820;
  const svgHeight = 520;
  const paddingX = 60;
  const paddingY = 50;

  // Compute dynamic domain across sectors and their trails
  const allX: number[] = [100.0];
  const allY: number[] = [100.0];

  rawSectors.forEach((s) => {
    allX.push(s.rsRatio);
    allY.push(s.rsMomentum);
    (s.trail || []).slice(-trailingWeeks).forEach((t) => {
      allX.push(t.rsRatio);
      allY.push(t.rsMomentum);
    });
  });

  const rawMinX = Math.min(...allX);
  const rawMaxX = Math.max(...allX);
  const rawMinY = Math.min(...allY);
  const rawMaxY = Math.max(...allY);

  // Pad evenly so 100 is nicely framed
  const minX = Math.min(96.0, Math.floor(rawMinX - 0.5));
  const maxX = Math.max(103.5, Math.ceil(rawMaxX + 0.5));
  const minY = Math.min(97.0, Math.floor(rawMinY - 0.5));
  const maxY = Math.max(103.0, Math.ceil(rawMaxY + 0.5));

  function scaleX(val: number): number {
    return paddingX + ((val - minX) / (maxX - minX)) * (svgWidth - 2 * paddingX);
  }

  function scaleY(val: number): number {
    // Invert Y so higher momentum is at top
    return svgHeight - paddingY - ((val - minY) / (maxY - minY)) * (svgHeight - 2 * paddingY);
  }

  const cx = scaleX(100.0);
  const cy = scaleY(100.0);

  // Grid tick intervals
  const xTicks: number[] = [];
  for (let x = Math.ceil(minX * 2) / 2; x <= maxX; x += 0.5) {
    xTicks.push(Math.round(x * 100) / 100);
  }

  const yTicks: number[] = [];
  for (let y = Math.ceil(minY); y <= maxY; y += 1.0) {
    yTicks.push(y);
  }

  const selectedSector = rawSectors.find((s) => s.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Top terminal bar with trailing window selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-bold tracking-tight text-foreground font-mono">
            Relative Rotation Graph - {trailingWeeks} week trailing
          </h3>
          <span className="text-border">|</span>
          <span className="text-2xs text-muted-foreground font-mono">
            Benchmark: <strong className="text-foreground">NIFTY 50 (^NSEI)</strong>
          </span>
        </div>

        {/* Trail Length Controls */}
        <div className="flex items-center gap-1.5 bg-black/60 border border-neutral-800 rounded-lg p-1">
          <span className="text-3xs font-mono uppercase text-muted-foreground px-2">Trail:</span>
          {([4, 8, 12] as const).map((w) => (
            <button
              key={w}
              onClick={() => setTrailingWeeks(w)}
              className={cn(
                "rounded px-2.5 py-0.5 font-mono text-2xs font-bold transition-all",
                trailingWeeks === w
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800",
              )}
            >
              {w}W
            </button>
          ))}
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="ml-1 text-3xs font-mono text-neutral-400 hover:text-white px-1.5"
            >
              [Reset Focus]
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Screen */}
      <div className="rounded-xl border border-neutral-800 bg-[#000000] p-3 sm:p-5 shadow-2xl relative overflow-hidden">
        {/* SVG RRG Graph */}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none font-mono"
          style={{ maxHeight: "580px" }}
        >
          <defs>
            {/* Generic Arrowhead for segment direction */}
            <marker
              id="rrg-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" opacity="0.9" />
            </marker>

            {/* Subtle glow filter for square node endpoints */}
            <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Background Lines */}
          {xTicks.map((xVal) => (
            <line
              key={`x-grid-${xVal}`}
              x1={scaleX(xVal)}
              y1={paddingY}
              x2={scaleX(xVal)}
              y2={svgHeight - paddingY}
              stroke="#1a202c"
              strokeWidth="0.8"
              strokeDasharray={xVal === 100 ? "none" : "2,3"}
            />
          ))}

          {yTicks.map((yVal) => (
            <line
              key={`y-grid-${yVal}`}
              x1={paddingX}
              y1={scaleY(yVal)}
              x2={svgWidth - paddingX}
              y2={scaleY(yVal)}
              stroke="#1a202c"
              strokeWidth="0.8"
              strokeDasharray={yVal === 100 ? "none" : "2,3"}
            />
          ))}

          {/* Large Semi-Transparent Rotational Arrows in the 4 Quadrants (Universal Clockwise Rotation) */}
          {/* 1. Top-Left: Improving -> Leading (Blue sweep curving up & right) */}
          <path
            d={`M ${paddingX + 40} ${cy - 10} C ${paddingX + 40} ${paddingY + 80}, ${cx - 90} ${paddingY + 40}, ${cx - 20} ${paddingY + 40} L ${cx - 20} ${paddingY + 20} L ${cx + 15} ${paddingY + 45} L ${cx - 20} ${paddingY + 70} L ${cx - 20} ${paddingY + 52} C ${cx - 80} ${paddingY + 52}, ${paddingX + 55} ${paddingY + 90}, ${paddingX + 55} ${cy - 10} Z`}
            fill="#0284c7"
            fillOpacity="0.08"
          />

          {/* 2. Top-Right: Leading -> Weakening (Green sweep curving right & down) */}
          <path
            d={`M ${cx + 10} ${paddingY + 40} C ${svgWidth - paddingX - 90} ${paddingY + 40}, ${svgWidth - paddingX - 40} ${paddingY + 90}, ${svgWidth - paddingX - 40} ${cy - 20} L ${svgWidth - paddingX - 60} ${cy - 20} L ${svgWidth - paddingX - 35} ${cy + 15} L ${svgWidth - paddingX - 10} ${cy - 20} L ${svgWidth - paddingX - 28} ${cy - 20} C ${svgWidth - paddingX - 28} ${paddingY + 80}, ${svgWidth - paddingX - 80} ${paddingY + 52}, ${cx + 10} ${paddingY + 52} Z`}
            fill="#16a34a"
            fillOpacity="0.08"
          />

          {/* 3. Bottom-Right: Weakening -> Lagging (Yellow/Olive sweep curving down & left) */}
          <path
            d={`M ${svgWidth - paddingX - 40} ${cy + 10} C ${svgWidth - paddingX - 40} ${svgHeight - paddingY - 80}, ${cx + 90} ${svgHeight - paddingY - 40}, ${cx + 20} ${svgHeight - paddingY - 40} L ${cx + 20} ${svgHeight - paddingY - 20} L ${cx - 15} ${svgHeight - paddingY - 45} L ${cx + 20} ${svgHeight - paddingY - 70} L ${cx + 20} ${svgHeight - paddingY - 52} C ${cx + 80} ${svgHeight - paddingY - 52}, ${svgWidth - paddingX - 55} ${svgHeight - paddingY - 90}, ${svgWidth - paddingX - 55} ${cy + 10} Z`}
            fill="#ca8a04"
            fillOpacity="0.08"
          />

          {/* 4. Bottom-Left: Lagging -> Improving (Red sweep curving left & up) */}
          <path
            d={`M ${cx - 10} ${svgHeight - paddingY - 40} C ${paddingX + 90} ${svgHeight - paddingY - 40}, ${paddingX + 40} ${svgHeight - paddingY - 90}, ${paddingX + 40} ${cy + 20} L ${paddingX + 60} ${cy + 20} L ${paddingX + 35} ${cy - 15} L ${paddingX + 10} ${cy + 20} L ${paddingX + 28} ${cy + 20} C ${paddingX + 28} ${svgHeight - paddingY - 80}, ${paddingX + 80} ${svgHeight - paddingY - 52}, ${cx - 10} ${svgHeight - paddingY - 52} Z`}
            fill="#dc2626"
            fillOpacity="0.08"
          />

          {/* Center Benchmark Crosshairs at (100.00, 100.00) */}
          <line
            x1={cx}
            y1={paddingY - 10}
            x2={cx}
            y2={svgHeight - paddingY + 10}
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray="6,4"
            strokeOpacity="0.75"
          />
          <line
            x1={paddingX - 10}
            y1={cy}
            x2={svgWidth - paddingX + 10}
            y2={cy}
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeDasharray="6,4"
            strokeOpacity="0.75"
          />

          {/* Quadrant Corner Labels (Bloomberg style) */}
          <text
            x={paddingX + 10}
            y={paddingY + 18}
            className="fill-neutral-500 font-bold text-xs tracking-wider uppercase"
          >
            Improving
          </text>
          <text
            x={svgWidth - paddingX - 10}
            y={paddingY + 18}
            textAnchor="end"
            className="fill-neutral-500 font-bold text-xs tracking-wider uppercase"
          >
            Leading
          </text>
          <text
            x={paddingX + 10}
            y={svgHeight - paddingY - 10}
            className="fill-neutral-500 font-bold text-xs tracking-wider uppercase"
          >
            Lagging
          </text>
          <text
            x={svgWidth - paddingX - 10}
            y={svgHeight - paddingY - 10}
            textAnchor="end"
            className="fill-neutral-500 font-bold text-xs tracking-wider uppercase"
          >
            Weakening
          </text>

          {/* Tick Labels on Left Axis (JdK RS-Momentum) */}
          {yTicks.map((yVal) => (
            <text
              key={`ytick-${yVal}`}
              x={paddingX - 8}
              y={scaleY(yVal) + 4}
              textAnchor="end"
              className={cn(
                "text-2xs font-bold",
                yVal === 100 ? "fill-white" : "fill-neutral-400",
              )}
            >
              {yVal}
            </text>
          ))}

          {/* Tick Labels on Bottom Axis (JdK RS-Ratio) */}
          {xTicks.filter((_, i) => i % 2 === 0).map((xVal) => (
            <text
              key={`xtick-${xVal}`}
              x={scaleX(xVal)}
              y={svgHeight - paddingY + 18}
              textAnchor="middle"
              className={cn(
                "text-2xs font-bold",
                xVal === 100 ? "fill-white" : "fill-neutral-400",
              )}
            >
              {xVal.toFixed(2)}
            </text>
          ))}

          {/* Outer Border Axis Scale Lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={svgHeight - paddingY}
            stroke="#4a5568"
            strokeWidth="1.2"
          />
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#4a5568"
            strokeWidth="1.2"
          />

          {/* Axis Title Labels */}
          <text
            x={svgWidth / 2}
            y={svgHeight - 12}
            textAnchor="middle"
            className="fill-neutral-300 font-bold text-xs tracking-wide"
          >
            JdK RS-Ratio
          </text>
          <text
            x={16}
            y={svgHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${svgHeight / 2})`}
            className="fill-neutral-300 font-bold text-xs tracking-wide"
          >
            JdK RS-Momentum
          </text>

          {/* Sector Trails with Directional Arrowheads (Bloomberg Trajectory) */}
          {rawSectors.map((s) => {
            const isSelected = selectedId === s.id;
            const isAnySelected = selectedId !== null;
            const opacity = isSelected ? 1.0 : isAnySelected ? 0.15 : 0.85;

            const sectorColor = BLOOMBERG_SECTOR_COLORS[s.id] || QUADRANT_COLORS[s.quadrant]?.hex || "#ffffff";
            const fullTrail = s.trail || [];
            const activeTrail = fullTrail.slice(-trailingWeeks);

            // Connect from first trail point to current position
            const points = [...activeTrail, { date: "today", rsRatio: s.rsRatio, rsMomentum: s.rsMomentum }];
            if (points.length < 2) return null;

            return (
              <g
                key={`trail-grp-${s.id}`}
                className="cursor-pointer"
                onClick={() => setSelectedId(isSelected ? null : s.id)}
              >
                {/* Continuous curve path */}
                {points.map((p, idx) => {
                  if (idx === 0) return null;
                  const prev = points[idx - 1];
                  const x1 = scaleX(prev.rsRatio);
                  const y1 = scaleY(prev.rsMomentum);
                  const x2 = scaleX(p.rsRatio);
                  const y2 = scaleY(p.rsMomentum);

                  return (
                    <g key={`seg-${s.id}-${idx}`}>
                      {/* Segment line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={sectorColor}
                        strokeWidth={isSelected ? 2.5 : 1.4}
                        strokeOpacity={opacity}
                      />

                      {/* Directional Arrowhead along segment */}
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r={0.1}
                        stroke="none"
                        markerEnd="url(#rrg-arrow)"
                        color={sectorColor}
                        opacity={opacity}
                      />
                    </g>
                  );
                })}

                {/* Trail Historical dots */}
                {points.slice(0, -1).map((pt, idx) => (
                  <circle
                    key={`dot-${s.id}-${idx}`}
                    cx={scaleX(pt.rsRatio)}
                    cy={scaleY(pt.rsMomentum)}
                    r={isSelected ? 2.8 : 1.8}
                    fill={sectorColor}
                    fillOpacity={opacity * 0.9}
                  />
                ))}
              </g>
            );
          })}

          {/* Current Active Coordinates: Square Marker + Ticker Label (Bloomberg Terminal Standard) */}
          {rawSectors.map((s) => {
            const isSelected = selectedId === s.id;
            const isAnySelected = selectedId !== null;
            const opacity = isSelected ? 1.0 : isAnySelected ? 0.2 : 1.0;

            const currX = scaleX(s.rsRatio);
            const currY = scaleY(s.rsMomentum);
            const sectorColor = BLOOMBERG_SECTOR_COLORS[s.id] || QUADRANT_COLORS[s.quadrant]?.hex || "#ffffff";
            const ticker = s.ticker || s.symbol.replace(/^(\^|NIFTY_)/i, "").slice(0, 5);

            return (
              <g
                key={`node-${s.id}`}
                className="cursor-pointer transition-transform"
                onClick={() => setSelectedId(isSelected ? null : s.id)}
              >
                {/* Focus Halo Ring if selected */}
                {isSelected && (
                  <circle
                    cx={currX}
                    cy={currY}
                    r={16}
                    fill="none"
                    stroke={sectorColor}
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                    className="animate-spin-slow"
                  />
                )}

                {/* Bright Square Terminal Marker (6x6 px) */}
                <rect
                  x={currX - 4}
                  y={currY - 4}
                  width={8}
                  height={8}
                  fill={sectorColor}
                  stroke="#000000"
                  strokeWidth="1"
                  filter={isSelected ? "url(#bloom)" : undefined}
                  opacity={opacity}
                />

                {/* Monospace Ticker Label next to square */}
                <text
                  x={currX + 8}
                  y={currY + 4}
                  fill={sectorColor}
                  opacity={opacity}
                  className={cn(
                    "font-bold text-2xs tracking-tighter drop-shadow-md",
                    isSelected ? "text-xs font-black underline" : "",
                  )}
                >
                  {ticker}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Bloomberg Terminal Status Footer */}
        <div className="mt-2 flex flex-wrap items-center justify-between text-3xs font-mono text-neutral-400 border-t border-neutral-900 pt-2 px-1">
          <div>
            <span>Bloomberg RRG® Model · Trailing: {trailingWeeks} Weeks · Bench: Nifty 50</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-sm bg-emerald-500 inline-block" /> Leading (RS+ Mom+)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="h-2 w-2 rounded-sm bg-amber-500 inline-block" /> Weakening (RS+ Mom-)
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="h-2 w-2 rounded-sm bg-rose-500 inline-block" /> Lagging (RS- Mom-)
            </span>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="h-2 w-2 rounded-sm bg-cyan-500 inline-block" /> Improving (RS- Mom+)
            </span>
          </div>
        </div>
      </div>

      {/* Sector Details Ledger */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
        {rawSectors.map((s) => {
          const isSelected = selectedId === s.id;
          const qColor = QUADRANT_COLORS[s.quadrant] || QUADRANT_COLORS.Leading;
          const sColor = BLOOMBERG_SECTOR_COLORS[s.id] || qColor.hex;

          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(isSelected ? null : s.id)}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                  : "border-border/80 bg-card hover:border-neutral-700",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground font-mono flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: sColor }} />
                  {s.ticker || s.label}
                </span>
                <span className={cn("text-3xs font-semibold px-1.5 py-0.2 rounded border", qColor.badge)}>
                  {s.quadrant}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-3xs font-mono text-muted-foreground border-t border-border/40 pt-1.5">
                <div>RS: <strong className="text-foreground">{s.rsRatio.toFixed(2)}</strong></div>
                <div>Mom: <strong className="text-foreground">{s.rsMomentum.toFixed(2)}</strong></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
