"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Half-circle gauge for a 0–100 score. The arc draws in on mount and the colour
 * follows the score band, so a reader sees strength before reading the number.
 */
export function Gauge({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 60 ? "hsl(var(--up))" : v >= 40 ? "hsl(var(--flat))" : "hsl(var(--down))";
  const R = 80;
  const arc = `M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`;
  const angle = Math.PI * (1 - v / 100);
  const tx = 100 + R * Math.cos(angle);
  const ty = 100 - R * Math.sin(angle);

  return (
    <div className={cn("relative mx-auto w-full max-w-[260px]", className)}>
      <svg viewBox="0 0 200 118" className="w-full overflow-visible" role="img" aria-label={`${label ?? "Score"} ${v.toFixed(1)} out of 100`}>
        <defs>
          <linearGradient id="gauge-track" x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(var(--down))" stopOpacity="0.25" />
            <stop offset="50%" stopColor="hsl(var(--flat))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--up))" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke="url(#gauge-track)" strokeWidth={14} strokeLinecap="round" />
        <motion.path
          d={arc}
          fill="none"
          stroke={tone}
          strokeWidth={14}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: v / 100 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${tone})` }}
        />
        <motion.circle
          r={6}
          fill="hsl(var(--background))"
          stroke={tone}
          strokeWidth={3}
          initial={{ cx: 100 - R, cy: 100, opacity: 0 }}
          animate={{ cx: tx, cy: ty, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
        <p className="font-mono text-4xl font-semibold leading-none tabular-nums">{v.toFixed(1)}</p>
        <p className="mt-1 text-2xs uppercase tracking-[0.18em] text-muted-foreground">{label ?? "Conviction"}</p>
      </div>
    </div>
  );
}

/** Diverging bar for a −100…+100 score: fills left of centre when negative, right when positive. */
export function ScoreBar({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const s = Math.max(-100, Math.min(100, score));
  const pos = s >= 0;
  return (
    <div className={cn("relative h-1.5 w-24 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <motion.span
        className={cn("absolute inset-y-0 rounded-full", pos ? "left-1/2 bg-up" : "right-1/2 bg-down")}
        initial={{ width: 0 }}
        animate={{ width: `${Math.abs(s) / 2}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
