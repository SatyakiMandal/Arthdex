"use client";

import { useEffect, useState } from "react";
import { Compass, Info, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiSectorRotation, ApiSectorRotationSector } from "@/lib/api/types";

const W = 460;
const H = 290;
const PAD_X = 36;
const PAD_Y = 26;

// RS-Ratio (X) range: 94 to 106
// RS-Momentum (Y) range: 96 to 104
const X_MIN = 95.0;
const X_MAX = 104.5;
const Y_MIN = 96.5;
const Y_MAX = 103.5;

function toScreenX(rsRatio: number): number {
  const norm = (rsRatio - X_MIN) / (X_MAX - X_MIN);
  return PAD_X + Math.max(0, Math.min(1, norm)) * (W - 2 * PAD_X);
}

function toScreenY(rsMom: number): number {
  const norm = (rsMom - Y_MIN) / (Y_MAX - Y_MIN);
  return H - PAD_Y - Math.max(0, Math.min(1, norm)) * (H - 2 * PAD_Y);
}

export function SectorRrgChart() {
  const [data, setData] = useState<ApiSectorRotation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredSector, setHoveredSector] = useState<ApiSectorRotationSector | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/sector-rotation")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.data) {
          setData(json.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center border border-border bg-surface-muted/30 text-3xs font-mono text-muted-foreground space-y-2">
        <RefreshCw className="h-4 w-4 animate-spin text-accent" />
        <span>Computing JdK Sector Rotation Relative Strength Vectors...</span>
      </div>
    );
  }

  if (!data || !data.sectors || data.sectors.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-border bg-surface-muted/20 text-3xs font-mono text-muted-foreground">
        Sector rotation data unavailable
      </div>
    );
  }

  const centerX = toScreenX(100.0);
  const centerY = toScreenY(100.0);

  return (
    <div className="space-y-1.5 font-mono text-2xs">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1 text-3xs">
        <span className="font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
          <Compass className="h-3 w-3 text-gold" />
          <span>JdK Sector Rotation Relative Rotation Graph (MB-03)</span>
        </span>
        <span className="text-muted-foreground">
          Benchmark: <strong className="text-foreground">{data.benchmark}</strong> · 4-Session Trails
        </span>
      </div>

      {/* SVG 2D Cartesian Quadrant Chart */}
      <div className="relative border border-border bg-surface rounded-none overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto overflow-visible select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Quadrant Background Shading */}
          {/* Top-Right: Leading (RS >= 100, Mom >= 100) */}
          <rect
            x={centerX}
            y={PAD_Y}
            width={W - PAD_X - centerX}
            height={centerY - PAD_Y}
            fill="hsl(var(--up) / 0.05)"
          />
          {/* Bottom-Right: Weakening (RS >= 100, Mom < 100) */}
          <rect
            x={centerX}
            y={centerY}
            width={W - PAD_X - centerX}
            height={H - PAD_Y - centerY}
            fill="hsl(var(--gold) / 0.05)"
          />
          {/* Bottom-Left: Lagging (RS < 100, Mom < 100) */}
          <rect
            x={PAD_X}
            y={centerY}
            width={centerX - PAD_X}
            height={H - PAD_Y - centerY}
            fill="hsl(var(--down) / 0.05)"
          />
          {/* Top-Left: Improving (RS < 100, Mom >= 100) */}
          <rect
            x={PAD_X}
            y={PAD_Y}
            width={centerX - PAD_X}
            height={centerY - PAD_Y}
            fill="hsl(var(--accent) / 0.05)"
          />

          {/* Quadrant Watermark Labels */}
          <text
            x={W - PAD_X - 6}
            y={PAD_Y + 12}
            textAnchor="end"
            className="fill-up/60 font-mono text-[9px] font-bold tracking-wider"
          >
            LEADING (RS↑ Mom↑)
          </text>
          <text
            x={W - PAD_X - 6}
            y={H - PAD_Y - 6}
            textAnchor="end"
            className="fill-gold/60 font-mono text-[9px] font-bold tracking-wider"
          >
            WEAKENING (RS↑ Mom↓)
          </text>
          <text
            x={PAD_X + 6}
            y={H - PAD_Y - 6}
            textAnchor="start"
            className="fill-down/60 font-mono text-[9px] font-bold tracking-wider"
          >
            LAGGING (RS↓ Mom↓)
          </text>
          <text
            x={PAD_X + 6}
            y={PAD_Y + 12}
            textAnchor="start"
            className="fill-accent/70 font-mono text-[9px] font-bold tracking-wider"
          >
            IMPROVING (RS↓ Mom↑)
          </text>

          {/* 100 Center Crosshair Lines */}
          <line
            x1={PAD_X}
            y1={centerY}
            x2={W - PAD_X}
            y2={centerY}
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <line
            x1={centerX}
            y1={PAD_Y}
            x2={centerX}
            y2={H - PAD_Y}
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Center Benchmark Label */}
          <text
            x={centerX + 4}
            y={centerY - 4}
            className="fill-muted-foreground font-mono text-[8px] font-bold"
          >
            NIFTY 100
          </text>

          {/* Sector Trails and Vectors */}
          {data.sectors.map((sec) => {
            const isHovered = hoveredSector?.id === sec.id;
            const currentX = toScreenX(sec.rsRatio);
            const currentY = toScreenY(sec.rsMomentum);

            // Trail points
            const trail = (sec.trail || []).slice(-4);
            const trailPoints = trail
              .map((pt) => `${toScreenX(pt.rsRatio)},${toScreenY(pt.rsMomentum)}`)
              .join(" ");

            const color =
              sec.quadrant === "Leading"
                ? "hsl(var(--up))"
                : sec.quadrant === "Weakening"
                  ? "hsl(var(--gold))"
                  : sec.quadrant === "Lagging"
                    ? "hsl(var(--down))"
                    : "hsl(var(--accent))";

            return (
              <g
                key={sec.id}
                onMouseEnter={() => setHoveredSector(sec)}
                onMouseLeave={() => setHoveredSector(null)}
                className="cursor-pointer transition-opacity"
                opacity={hoveredSector && !isHovered ? 0.35 : 1}
              >
                {/* Trail polyline */}
                {trail.length > 1 && (
                  <polyline
                    points={trailPoints}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 1.25}
                    strokeOpacity={isHovered ? 0.9 : 0.45}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Trail historical dots */}
                {trail.map((pt, i) => (
                  <circle
                    key={i}
                    cx={toScreenX(pt.rsRatio)}
                    cy={toScreenY(pt.rsMomentum)}
                    r={1.5}
                    fill={color}
                    opacity={0.4}
                  />
                ))}

                {/* Current node dot */}
                <circle
                  cx={currentX}
                  cy={currentY}
                  r={isHovered ? 5 : 3.5}
                  fill={color}
                  stroke="hsl(var(--surface))"
                  strokeWidth={1.5}
                />

                {/* Node Ticker Badge */}
                <text
                  x={currentX + 6}
                  y={currentY + 3}
                  className="font-mono text-[9px] font-extrabold"
                  fill={isHovered ? "hsl(var(--foreground))" : color}
                >
                  {sec.ticker || sec.label?.replace("Nifty ", "")}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Inspector Pill */}
        <div className="border-t border-border/70 bg-surface-muted/50 p-1.5 flex items-center justify-between text-3xs font-mono">
          {hoveredSector ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{hoveredSector.label}</span>
              <span
                className={cn(
                  "px-1 py-0.2 font-bold border rounded-none text-3xs",
                  hoveredSector.quadrant === "Leading"
                    ? "border-up/40 bg-up/15 text-up"
                    : hoveredSector.quadrant === "Weakening"
                      ? "border-gold/40 bg-gold/15 text-gold"
                      : hoveredSector.quadrant === "Lagging"
                        ? "border-down/40 bg-down/15 text-down"
                        : "border-accent/40 bg-accent/15 text-accent",
                )}
              >
                {hoveredSector.quadrant}
              </span>
              <span>RS-Ratio: <strong>{hoveredSector.rsRatio.toFixed(2)}</strong></span>
              <span>RS-Momentum: <strong>{hoveredSector.rsMomentum.toFixed(2)}</strong></span>
              <span>1W: <strong className={hoveredSector.change1w && hoveredSector.change1w >= 0 ? "text-up" : "text-down"}>{hoveredSector.change1w && hoveredSector.change1w >= 0 ? "+" : ""}{hoveredSector.change1w?.toFixed(2)}%</strong></span>
              <span>LTP: <strong>₹{hoveredSector.lastClose?.toLocaleString("en-IN")}</strong></span>
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" /> Hover any sector node to view RS momentum vector, quadrant, and 1-week relative drift.
            </span>
          )}
          <span className="text-muted-foreground shrink-0">JdK Standardized</span>
        </div>
      </div>
    </div>
  );
}
