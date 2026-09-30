import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Signed percentage, always with an explicit sign and fixed precision. */
export function formatPct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** Signed absolute change. */
export function formatDelta(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

/** Indian digit grouping (lakh / crore) for currency figures. */
export function formatINR(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Compact crore/lakh rendering for large balance-sheet figures. */
export function formatCrore(value: number): string {
  if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(2)} L Cr`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)} K Cr`;
  return `${value.toFixed(2)} Cr`;
}

/** Tailwind text colour for a directional figure. */
export function deltaColor(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted-foreground";
}
