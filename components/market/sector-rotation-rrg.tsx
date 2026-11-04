"use client";

import { useId, useMemo, useState } from "react";
import { Check, Compass, Eye, EyeOff, RotateCw, Sparkles, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiSectorRotation, ApiSectorRotationSector } from "@/lib/api/types";

const QUADRANT_COLORS = {
  Leading: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    hex: "#22c55e",
  },
  Weakening: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-400",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    hex: "#eab308",
  },
  Lagging: {
    bg: "bg-rose-500/10",
    border: "border-rose-500/40",
    text: "text-rose-400",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    hex: "#ef4444",
  },
  Improving: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/40",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    hex: "#06b6d4",
  },
};

// Bloomberg color mapping per sector
const BLOOMBERG_SECTOR_COLORS: Record<string, string> = {
  it: "#e879f9", // Magenta (S5INFT)
  metal: "#ef4444", // Red (S5MATR)
  energy: "#f97316", // Orange/Red (S5ENRS)
  auto: "#ea580c", // Industrial orange (S5INDU)
  bank: "#eab308", // Yellow (S5FINL)
  pharma: "#84cc16", // Lime Green (S5HLTH)
  fmcg: "#10b981", // Emerald (S5CONS)
  realty: "#06b6d4", // Cyan (S5TELS)
  infra: "#38bdf8", // Sky blue
  pse: "#14b8a6", // Teal
};

function generateTicks(min: number, max: number, targetCount = 6): number[] {
  const range = max - min;
  if (range <= 0) return [100.0];
  const roughStep = range / targetCount;
  const steps = [0.5, 1.0, 1.5, 2.0, 2.5, 5.0, 10.0];
  const step = steps.find((s) => s >= roughStep) || 2.0;

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let val = first; val <= max + 0.001; val += step) {
    ticks.push(Number(val.toFixed(2)));
  }
  return ticks;
}

export function SectorRotationRrg({
  rotationData,
}: {
  rotationData: ApiSectorRotation;
}) {
  const rawSectors = useMemo(() => rotationData.sectors ?? [], [rotationData.sectors]);
  const maskId = useId();

  // State: Selected sector for inspection / hover highlight
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // State: Trail Length (4W, 8W, 12W)
  const [trailingWeeks, setTrailingWeeks] = useState<4 | 8 | 12>(12);

  // State: Quadrant Filter
  const [quadrantFilter, setQuadrantFilter] = useState<"ALL" | "Leading" | "Weakening" | "Lagging" | "Improving">("ALL");

  // State: Enabled Sectors (all enabled by default)
  const [enabledSectorIds, setEnabledSectorIds] = useState<Set<string>>(
    () => new Set(rawSectors.map((s) => s.id)),
  );

  // Toggle single sector
  function toggleSector(id: string) {
    setEnabledSectorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Quick selection presets
  function selectAll() {
    setEnabledSectorIds(new Set(rawSectors.map((s) => s.id)));
  }

  function clearAllExcept(id: string) {
    setEnabledSectorIds(new Set([id]));
  }

  // Filtered sectors list based on active checkboxes and quadrant filter
  const visibleSectors = useMemo(() => {
    return rawSectors.filter((s) => {
      if (!enabledSectorIds.has(s.id)) return false;
      if (quadrantFilter !== "ALL" && s.quadrant !== quadrantFilter) return false;
      return true;
    });
  }, [rawSectors, enabledSectorIds, quadrantFilter]);

  // SVG dimensions: widescreen aspect
  const svgWidth = 920;
  const svgHeight = 540;
  const paddingX = 65;
  const paddingY = 55;

  // Compute dynamic domain across visible sectors and their trails
  const allX: number[] = [98.5, 101.5];
  const allY: number[] = [98.5, 101.5];

  visibleSectors.forEach((s) => {
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

  // Dynamic axis boundaries framed evenly around 100
  const minX = Math.min(96.0, Math.floor(rawMinX * 2) / 2 - 0.5);
  const maxX = Math.max(104.0, Math.ceil(rawMaxX * 2) / 2 + 0.5);
  const minY = Math.min(96.0, Math.floor(rawMinY * 2) / 2 - 0.5);
  const maxY = Math.max(104.0, Math.ceil(rawMaxY * 2) / 2 + 0.5);

  function scaleX(val: number): number {
    return paddingX + ((val - minX) / (maxX - minX)) * (svgWidth - 2 * paddingX);
  }

  function scaleY(val: number): number {
    return svgHeight - paddingY - ((val - minY) / (maxY - minY)) * (svgHeight - 2 * paddingY);
  }

  const cx = scaleX(100.0);
  const cy = scaleY(100.0);

  // Dynamic non-overlapping tick intervals (5 to 7 clean ticks max)
  const xTicks = useMemo(() => generateTicks(minX, maxX, 6), [minX, maxX]);
  const yTicks = useMemo(() => generateTicks(minY, maxY, 6), [minY, maxY]);

  const activeFocusId = hoveredId || selectedId;
  const focusedSector = rawSectors.find((s) => s.id === activeFocusId);

  return (
    <div className="space-y-4 rounded-none">
      {/* Top Controls Bar: Trail Selector, Quadrant Filter, and Quick Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-black p-3 rounded-none">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-2 w-2 rounded-none bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold tracking-tight text-white font-mono uppercase">
            Relative Rotation Graph &middot; {trailingWeeks}W Trailing
          </h3>
          <span className="text-neutral-700">|</span>
          <span className="text-3xs font-mono text-neutral-400">
            Bench: <strong className="text-white">NIFTY 50 (^NSEI)</strong>
          </span>
        </div>

        {/* Trail Length Controls: Sharp buttons */}
        <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 p-0.5 rounded-none">
          <span className="text-3xs font-mono uppercase text-neutral-400 px-2 font-semibold">Trail:</span>
          {([4, 8, 12] as const).map((w) => (
            <button
              key={w}
              onClick={() => setTrailingWeeks(w)}
              className={cn(
                "px-2.5 py-0.5 font-mono text-2xs font-bold transition-all rounded-none",
                trailingWeeks === w
                  ? "bg-primary text-primary-foreground"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800",
              )}
            >
              {w}W
            </button>
          ))}
        </div>
      </div>

      {/* Sector Checkbox Chips: Allows users to turn individual sectors ON/OFF */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black border border-neutral-800 p-2.5 rounded-none">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-mono uppercase tracking-wider text-neutral-400 font-semibold mr-1">
            Sectors ({enabledSectorIds.size}/{rawSectors.length}):
          </span>

          {rawSectors.map((sec) => {
            const isEnabled = enabledSectorIds.has(sec.id);
            const isFocused = activeFocusId === sec.id;
            const bColor = BLOOMBERG_SECTOR_COLORS[sec.id] || sec.color;

            return (
              <button
                key={sec.id}
                onClick={() => toggleSector(sec.id)}
                onMouseEnter={() => setHoveredId(sec.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "flex items-center gap-1.5 border px-2 py-1 text-2xs font-mono font-bold transition-all rounded-none",
                  isEnabled
                    ? "border-neutral-700 bg-neutral-900 text-white"
                    : "border-neutral-800/60 bg-black text-neutral-600 line-through",
                  isFocused && "ring-1 ring-white border-white",
                )}
                style={{
                  borderLeftColor: isEnabled ? bColor : undefined,
                  borderLeftWidth: isEnabled ? "3px" : undefined,
                }}
              >
                <span>{sec.ticker || sec.id.toUpperCase()}</span>
                {isEnabled ? (
                  <span className="h-1.5 w-1.5 rounded-none" style={{ backgroundColor: bColor }} />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Quick select / clear buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={selectAll}
            className="border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-3xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-white rounded-none"
          >
            All
          </button>
          <button
            onClick={() => clearAllExcept("bank")}
            className="border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-3xs font-mono text-neutral-400 hover:bg-neutral-800 hover:text-white rounded-none"
          >
            Bank Only
          </button>
          <button
            onClick={() => clearAllExcept("it")}
            className="border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-3xs font-mono text-neutral-400 hover:bg-neutral-800 hover:text-white rounded-none"
          >
            IT Only
          </button>
        </div>
      </div>

      {/* Main Terminal Canvas: Pitch-Black Bloomberg Canvas (Zero Rounded Corners) */}
      <div className="relative w-full border border-neutral-800 bg-[#000000] p-1 overflow-hidden rounded-none shadow-2xl">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto select-none"
        >
          <defs>
            {/* Grid Pattern: 20x20 fine terminal grid */}
            <pattern id="bloomberg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#171717" strokeWidth="0.75" />
            </pattern>

            {/* Rotational sweep gradient for the 4 clockwise cycle arrows */}
            <linearGradient id="rot-leading" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="rot-weakening" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a16207" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="rot-lagging" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#be123c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="rot-improving" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#0e7490" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.22" />
            </linearGradient>
          </defs>

          {/* Canvas Background */}
          <rect width={svgWidth} height={svgHeight} fill="#000000" />
          <rect
            x={paddingX}
            y={paddingY}
            width={svgWidth - 2 * paddingX}
            height={svgHeight - 2 * paddingY}
            fill="url(#bloomberg-grid)"
          />

          {/* 4 Clockwise Curved Rotational Background Arrows (Improving -> Leading -> Weakening -> Lagging) */}
          <g className="pointer-events-none" opacity={0.65}>
            {/* Top-Right: Leading Clockwise Arc */}
            <path
              d={`M ${cx + 10} ${cy - 50} A ${svgWidth * 0.35} ${svgHeight * 0.35} 0 0 1 ${svgWidth - paddingX - 30} ${cy - 5} L ${svgWidth - paddingX - 18} ${cy - 5} L ${svgWidth - paddingX - 35} ${cy + 25} L ${svgWidth - paddingX - 52} ${cy - 5} L ${svgWidth - paddingX - 40} ${cy - 5} A ${svgWidth * 0.3} ${svgHeight * 0.3} 0 0 0 ${cx + 10} ${cy - 30} Z`}
              fill="url(#rot-leading)"
            />
            {/* Bottom-Right: Weakening Clockwise Arc */}
            <path
              d={`M ${svgWidth - paddingX - 40} ${cy + 10} A ${svgWidth * 0.35} ${svgHeight * 0.35} 0 0 1 ${cx + 30} ${svgHeight - paddingY - 15} L ${cx + 30} ${svgHeight - paddingY - 3} L ${cx - 5} ${svgHeight - paddingY - 20} L ${cx + 30} ${svgHeight - paddingY - 37} L ${cx + 30} ${svgHeight - paddingY - 25} A ${svgWidth * 0.3} ${svgHeight * 0.3} 0 0 0 ${svgWidth - paddingX - 55} ${cy + 10} Z`}
              fill="url(#rot-weakening)"
            />
            {/* Bottom-Left: Lagging Clockwise Arc */}
            <path
              d={`M ${cx - 10} ${cy + 40} A ${svgWidth * 0.35} ${svgHeight * 0.35} 0 0 1 ${paddingX + 30} ${cy + 5} L ${paddingX + 18} ${cy + 5} L ${paddingX + 35} ${cy - 25} L ${paddingX + 52} ${cy + 5} L ${paddingX + 40} ${cy + 5} A ${svgWidth * 0.3} ${svgHeight * 0.3} 0 0 0 ${cx - 10} ${cy + 25} Z`}
              fill="url(#rot-lagging)"
            />
            {/* Top-Left: Improving Clockwise Arc */}
            <path
              d={`M ${paddingX + 40} ${cy - 10} A ${svgWidth * 0.35} ${svgHeight * 0.35} 0 0 1 ${cx - 30} ${paddingY + 15} L ${cx - 30} ${paddingY + 3} L ${cx + 5} ${paddingY + 20} L ${cx - 30} ${paddingY + 37} L ${cx - 30} ${paddingY + 25} A ${svgWidth * 0.3} ${svgHeight * 0.3} 0 0 0 ${paddingX + 55} ${cy - 10} Z`}
              fill="url(#rot-improving)"
            />
          </g>

          {/* Quadrant Labels in Corners: Bloomberg Capital Letters */}
          <g className="pointer-events-none font-mono text-2xs font-bold tracking-widest uppercase">
            {/* Improving: Top-Left */}
            <text x={paddingX + 16} y={paddingY + 24} fill="#06b6d4" fillOpacity={0.65}>
              IMPROVING
            </text>
            {/* Leading: Top-Right */}
            <text x={svgWidth - paddingX - 16} y={paddingY + 24} fill="#22c55e" fillOpacity={0.65} textAnchor="end">
              LEADING
            </text>
            {/* Lagging: Bottom-Left */}
            <text x={paddingX + 16} y={svgHeight - paddingY - 14} fill="#ef4444" fillOpacity={0.65}>
              LAGGING
            </text>
            {/* Weakening: Bottom-Right */}
            <text x={svgWidth - paddingX - 16} y={svgHeight - paddingY - 14} fill="#eab308" fillOpacity={0.65} textAnchor="end">
              WEAKENING
            </text>
          </g>

          {/* Fine Grid Ticks: X-axis */}
          {xTicks.map((xVal) => {
            const xPos = scaleX(xVal);
            if (xPos < paddingX || xPos > svgWidth - paddingX) return null;
            return (
              <line
                key={`grid-x-${xVal}`}
                x1={xPos}
                y1={paddingY}
                x2={xPos}
                y2={svgHeight - paddingY}
                stroke="#1f1f1f"
                strokeWidth={0.75}
              />
            );
          })}

          {/* Fine Grid Ticks: Y-axis */}
          {yTicks.map((yVal) => {
            const yPos = scaleY(yVal);
            if (yPos < paddingY || yPos > svgHeight - paddingY) return null;
            return (
              <line
                key={`grid-y-${yVal}`}
                x1={paddingX}
                y1={yPos}
                x2={svgWidth - paddingX}
                y2={yPos}
                stroke="#1f1f1f"
                strokeWidth={0.75}
              />
            );
          })}

          {/* Center Crosshairs: Benchmark Zero Lines (RS-Ratio = 100, RS-Momentum = 100) */}
          <line
            x1={cx}
            y1={paddingY}
            x2={cx}
            y2={svgHeight - paddingY}
            stroke="#9ca3af"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
          <line
            x1={paddingX}
            y1={cy}
            x2={svgWidth - paddingX}
            y2={cy}
            stroke="#9ca3af"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />

          {/* Sector Trails and Vectors */}
          {visibleSectors.map((sec) => {
            const isFocused = activeFocusId === sec.id;
            const hasFocus = activeFocusId !== null;
            const trailPoints = (sec.trail || []).slice(-trailingWeeks);
            if (trailPoints.length < 2) return null;

            const bColor = BLOOMBERG_SECTOR_COLORS[sec.id] || sec.color;
            const strokeOpacity = hasFocus ? (isFocused ? 1.0 : 0.15) : 0.85;
            const strokeWidth = isFocused ? 2.5 : 1.4;

            // Generate SVG path for the trail
            const pathD = trailPoints
              .map((pt, i) => {
                const px = scaleX(pt.rsRatio);
                const py = scaleY(pt.rsMomentum);
                return `${i === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
              })
              .join(" ");

            // Calculate directional arrowheads along segment vectors
            const arrowheads: Array<{ x: number; y: number; angle: number }> = [];
            for (let i = 0; i < trailPoints.length - 1; i++) {
              const p1 = trailPoints[i];
              const p2 = trailPoints[i + 1];
              const x1 = scaleX(p1.rsRatio);
              const y1 = scaleY(p1.rsMomentum);
              const x2 = scaleX(p2.rsRatio);
              const y2 = scaleY(p2.rsMomentum);

              const dist = Math.hypot(x2 - x1, y2 - y1);
              if (dist > 12) {
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                arrowheads.push({ x: midX, y: midY, angle });
              }
            }

            // Head node (current latest position)
            const latest = trailPoints[trailPoints.length - 1];
            const headX = scaleX(latest.rsRatio);
            const headY = scaleY(latest.rsMomentum);
            const ticker = sec.ticker || sec.id.toUpperCase();

            return (
              <g
                key={sec.id}
                className="cursor-pointer transition-opacity duration-200"
                onClick={() => setSelectedId(selectedId === sec.id ? null : sec.id)}
                onMouseEnter={() => setHoveredId(sec.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Historical Trail Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={bColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Directional Arrowheads along trail */}
                {arrowheads.map((arr, i) => (
                  <polygon
                    key={i}
                    points="-4,-3 4,0 -4,3"
                    transform={`translate(${arr.x.toFixed(1)}, ${arr.y.toFixed(1)}) rotate(${arr.angle})`}
                    fill={bColor}
                    fillOpacity={strokeOpacity}
                  />
                ))}

                {/* Trail Historical Dots */}
                {trailPoints.slice(0, -1).map((pt, i) => (
                  <rect
                    key={i}
                    x={scaleX(pt.rsRatio) - 1.5}
                    y={scaleY(pt.rsMomentum) - 1.5}
                    width={3}
                    height={3}
                    fill={bColor}
                    fillOpacity={strokeOpacity * 0.7}
                  />
                ))}

                {/* Head Node: Sharp Square Marker (Zero rounded corners) */}
                <rect
                  x={headX - 4.5}
                  y={headY - 4.5}
                  width={9}
                  height={9}
                  fill={bColor}
                  stroke="#ffffff"
                  strokeWidth={isFocused ? 2 : 1}
                  opacity={hasFocus && !isFocused ? 0.25 : 1.0}
                />

                {/* Monospace Ticker Label beside the head square */}
                <text
                  x={headX + 7}
                  y={headY + 3.5}
                  fill={bColor}
                  className="font-mono text-3xs font-bold"
                  opacity={hasFocus && !isFocused ? 0.25 : 1.0}
                >
                  {ticker}
                </text>
              </g>
            );
          })}

          {/* Clean Non-Overlapping Axis Ticks: X-Axis (Bottom) */}
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#525252"
            strokeWidth={1}
          />
          {xTicks.map((xVal) => {
            const xPos = scaleX(xVal);
            if (xPos < paddingX - 10 || xPos > svgWidth - paddingX + 10) return null;
            return (
              <g key={`xtick-${xVal}`} transform={`translate(${xPos}, ${svgHeight - paddingY})`}>
                <line x1={0} y1={0} x2={0} y2={5} stroke="#a3a3a3" strokeWidth={1} />
                <text
                  x={0}
                  y={17}
                  fill="#d4d4d4"
                  className="font-mono text-3xs font-semibold"
                  textAnchor="middle"
                >
                  {xVal.toFixed(1)}
                </text>
              </g>
            );
          })}
          <text
            x={svgWidth / 2}
            y={svgHeight - 12}
            fill="#a3a3a3"
            className="font-mono text-2xs uppercase tracking-wider font-bold"
            textAnchor="middle"
          >
            JdK RS-Ratio (Relative Trend)
          </text>

          {/* Clean Non-Overlapping Axis Ticks: Y-Axis (Left) */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={svgHeight - paddingY}
            stroke="#525252"
            strokeWidth={1}
          />
          {yTicks.map((yVal) => {
            const yPos = scaleY(yVal);
            if (yPos < paddingY - 10 || yPos > svgHeight - paddingY + 10) return null;
            return (
              <g key={`ytick-${yVal}`} transform={`translate(${paddingX}, ${yPos})`}>
                <line x1={0} y1={0} x2={-5} y2={0} stroke="#a3a3a3" strokeWidth={1} />
                <text
                  x={-8}
                  y={3.5}
                  fill="#d4d4d4"
                  className="font-mono text-3xs font-semibold"
                  textAnchor="end"
                >
                  {yVal.toFixed(1)}
                </text>
              </g>
            );
          })}
          <text
            x={-svgHeight / 2}
            y={16}
            fill="#a3a3a3"
            className="font-mono text-2xs uppercase tracking-wider font-bold"
            textAnchor="middle"
            transform="rotate(-90)"
          >
            JdK RS-Momentum (Relative Velocity)
          </text>

          {/* Bottom Bloomberg Footer */}
          <text
            x={paddingX}
            y={svgHeight - 8}
            fill="#525252"
            className="font-mono text-3xs font-semibold"
          >
            Arthdex Bloomberg-Grade RRG Engine &middot; Real Closes
          </text>
        </svg>

        {/* Hover / Selection Detail HUD overlay */}
        {focusedSector && (
          <div className="absolute top-4 right-4 z-20 border border-neutral-700 bg-black/95 p-3 font-mono text-xs text-white shadow-xl min-w-[210px] rounded-none animate-in fade-in-50">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 mb-2">
              <span className="font-bold flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-none inline-block"
                  style={{ backgroundColor: BLOOMBERG_SECTOR_COLORS[focusedSector.id] || focusedSector.color }}
                />
                {focusedSector.ticker || focusedSector.id.toUpperCase()}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.5 text-3xs font-bold uppercase rounded-none border",
                  QUADRANT_COLORS[focusedSector.quadrant].badge,
                )}
              >
                {focusedSector.quadrant}
              </span>
            </div>
            <div className="space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">RS-Ratio:</span>
                <span className="font-bold">{focusedSector.rsRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">RS-Momentum:</span>
                <span className="font-bold">{focusedSector.rsMomentum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">1W Relative:</span>
                <span
                  className={cn(
                    "font-bold",
                    (focusedSector.change1w ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {(focusedSector.change1w ?? 0) >= 0 ? "+" : ""}
                  {(focusedSector.change1w ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">1M Relative:</span>
                <span
                  className={cn(
                    "font-bold",
                    (focusedSector.change1m ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {(focusedSector.change1m ?? 0) >= 0 ? "+" : ""}
                  {(focusedSector.change1m ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sector Performance Matrix Table (Zero Rounded Edges) */}
      <div className="border border-border bg-card p-3 rounded-none overflow-x-auto">
        <div className="flex items-center justify-between text-xs font-mono font-semibold pb-2 border-b border-border/60">
          <span className="uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-primary" /> Sector Rotation Ledger (10 NSE Sectors)
          </span>
          <span className="text-3xs text-muted-foreground">Click eye to toggle trail on chart</span>
        </div>

        <table className="w-full text-left text-xs border-collapse mt-2 font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-3xs text-muted-foreground uppercase tracking-wider">
              <th className="p-2 w-8 text-center">Show</th>
              <th className="p-2">Sector &amp; Ticker</th>
              <th className="p-2 text-center">Quadrant</th>
              <th className="p-2 text-right">RS-Ratio</th>
              <th className="p-2 text-right">RS-Momentum</th>
              <th className="p-2 text-right">1D Ret (%)</th>
              <th className="p-2 text-right">1W Ret (%)</th>
              <th className="p-2 text-right">1M Ret (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-2xs">
            {rawSectors.map((s) => {
              const isEnabled = enabledSectorIds.has(s.id);
              const bColor = BLOOMBERG_SECTOR_COLORS[s.id] || s.color;

              return (
                <tr
                  key={s.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    !isEnabled && "opacity-40",
                    activeFocusId === s.id && "bg-muted/50 font-semibold",
                  )}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <td className="p-2 text-center">
                    <button
                      onClick={() => toggleSector(s.id)}
                      className="p-1 hover:text-primary transition-colors"
                      title={isEnabled ? "Hide sector" : "Show sector"}
                    >
                      {isEnabled ? (
                        <Eye className="h-3.5 w-3.5 text-foreground" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-none inline-block shrink-0" style={{ backgroundColor: bColor }} />
                      <span className="font-bold text-foreground">{s.ticker || s.id.toUpperCase()}</span>
                      <span className="text-3xs text-muted-foreground font-sans truncate max-w-[130px] hidden sm:inline">
                        {s.label}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 text-3xs font-bold uppercase rounded-none border",
                        QUADRANT_COLORS[s.quadrant].badge,
                      )}
                    >
                      {s.quadrant}
                    </span>
                  </td>
                  <td className="p-2 text-right font-bold text-foreground">
                    {s.rsRatio.toFixed(2)}
                  </td>
                  <td className="p-2 text-right font-bold text-foreground">
                    {s.rsMomentum.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      "p-2 text-right font-medium",
                      (s.change1d ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {(s.change1d ?? 0) >= 0 ? "+" : ""}
                    {(s.change1d ?? 0).toFixed(2)}%
                  </td>
                  <td
                    className={cn(
                      "p-2 text-right font-medium",
                      (s.change1w ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {(s.change1w ?? 0) >= 0 ? "+" : ""}
                    {(s.change1w ?? 0).toFixed(2)}%
                  </td>
                  <td
                    className={cn(
                      "p-2 text-right font-medium",
                      (s.change1m ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {(s.change1m ?? 0) >= 0 ? "+" : ""}
                    {(s.change1m ?? 0).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
