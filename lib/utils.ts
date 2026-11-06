import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names safely resolving conflicting Tailwind CSS utility classes.
 * Wraps clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value into a signed percentage with fixed decimal precision.
 * Safely falls back to an em-dash for null, undefined, or NaN.
 *
 * @param value The percentage value to format (e.g. 5.25 for +5.25%)
 * @param digits Decimal precision, defaults to 2
 * @returns e.g. "+5.25%", "-1.50%", "+0.00%", or "—"
 */
export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  return `${num >= 0 ? "+" : ""}${num.toFixed(digits)}%`;
}

/**
 * Formats a numeric value into a signed absolute delta with fixed decimal precision.
 * Safely falls back to an em-dash for null, undefined, or NaN.
 *
 * @param value The delta value to format (e.g. 120.5 for +120.50)
 * @param digits Decimal precision, defaults to 2
 * @returns e.g. "+120.50", "-45.00", "+0.00", or "—"
 */
export function formatDelta(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  return `${num >= 0 ? "+" : ""}${num.toFixed(digits)}`;
}

/**
 * Formats a currency value using Indian numbering conventions (lakh / crore separation).
 * Uses en-IN locale grouping: 3 digits for hundreds, then groups of 2 digits (e.g. 12,34,567.89).
 * Safely falls back to an em-dash for null, undefined, or NaN.
 *
 * @param value Number in INR
 * @param digits Number of decimal places, defaults to 2
 * @returns Formatted INR string, e.g. "12,34,567.89" or "—"
 */
export function formatINR(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

/**
 * Compact crore/lakh rendering for financial balance-sheet and market cap figures.
 * Scales figures >= 100,000 Cr to Lakh Crore (L Cr) and figures >= 1,000 Cr to Thousand Crore (K Cr).
 * Safely falls back to an em-dash for null, undefined, or NaN.
 *
 * @param value Figure in Crores (₹ Cr)
 * @returns Compact formatted string, e.g. "2.45 L Cr", "1.20 K Cr", "450.00 Cr", or "—"
 */
export function formatCrore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const num = Number(value);
  if (Math.abs(num) >= 1e5) return `${(num / 1e5).toFixed(2)} L Cr`;
  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)} K Cr`;
  return `${num.toFixed(2)} Cr`;
}

/**
 * Returns the semantic Tailwind text color token based on directional market sign.
 * Positive returns `text-up` (emerald), negative returns `text-down` (rose), and zero/null returns `text-muted-foreground`.
 *
 * @param value Directional indicator (e.g. % change or delta)
 * @returns Tailwind CSS utility class
 */
export function deltaColor(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "text-muted-foreground";
  const num = Number(value);
  if (num > 0) return "text-up";
  if (num < 0) return "text-down";
  return "text-muted-foreground";
}
