import { describe, it, expect } from "vitest";
import { cn, formatPct, formatDelta, formatINR, formatCrore, deltaColor } from "./utils";

describe("lib/utils", () => {
  describe("cn (tailwind merge + clsx)", () => {
    it("merges standard class names", () => {
      expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("resolves conflicting tailwind classes correctly", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("handles conditional classes and falsy values", () => {
      const active = true;
      const disabled = false;
      expect(cn("base", active && "active", disabled && "disabled", undefined, null)).toBe("base active");
    });
  });

  describe("formatPct", () => {
    it("formats positive percentages with leading plus", () => {
      expect(formatPct(4.5)).toBe("+4.50%");
      expect(formatPct(0.01)).toBe("+0.01%");
      expect(formatPct(0)).toBe("+0.00%");
    });

    it("formats negative percentages with minus sign", () => {
      expect(formatPct(-3.25)).toBe("-3.25%");
      expect(formatPct(-0.05)).toBe("-0.05%");
    });

    it("respects custom decimal digits", () => {
      expect(formatPct(5.12345, 4)).toBe("+5.1235%");
      expect(formatPct(-2.5, 1)).toBe("-2.5%");
      expect(formatPct(10, 0)).toBe("+10%");
    });

    it("handles null, undefined, and NaN gracefully", () => {
      expect(formatPct(null)).toBe("—");
      expect(formatPct(undefined)).toBe("—");
      expect(formatPct(Number.NaN)).toBe("—");
    });
  });

  describe("formatDelta", () => {
    it("formats positive deltas with leading plus", () => {
      expect(formatDelta(150.25)).toBe("+150.25");
      expect(formatDelta(0)).toBe("+0.00");
    });

    it("formats negative deltas with minus sign", () => {
      expect(formatDelta(-45.8)).toBe("-45.80");
    });

    it("respects custom decimal precision", () => {
      expect(formatDelta(99.999, 1)).toBe("+100.0");
      expect(formatDelta(-12.3456, 3)).toBe("-12.346");
    });

    it("handles null, undefined, and NaN gracefully", () => {
      expect(formatDelta(null)).toBe("—");
      expect(formatDelta(undefined)).toBe("—");
      expect(formatDelta(Number.NaN)).toBe("—");
    });
  });

  describe("formatINR", () => {
    it("formats Indian rupees with Indian grouping (lakh / crore)", () => {
      // 1,00,000 = 1 Lakh
      expect(formatINR(100000)).toBe("1,00,000.00");
      // 1,00,00,000 = 1 Crore
      expect(formatINR(10000000)).toBe("1,00,00,000.00");
      // 12,34,567.89
      expect(formatINR(1234567.89)).toBe("12,34,567.89");
    });

    it("formats small amounts and zero", () => {
      expect(formatINR(0)).toBe("0.00");
      expect(formatINR(45.5)).toBe("45.50");
      expect(formatINR(999)).toBe("999.00");
    });

    it("respects digits argument", () => {
      expect(formatINR(50000, 0)).toBe("50,000");
      expect(formatINR(1234.5678, 3)).toBe("1,234.568");
    });

    it("handles null, undefined, and NaN safely", () => {
      expect(formatINR(null)).toBe("—");
      expect(formatINR(undefined)).toBe("—");
      expect(formatINR(Number.NaN)).toBe("—");
    });
  });

  describe("formatCrore", () => {
    it("formats standard figures in Cr", () => {
      expect(formatCrore(450.5)).toBe("450.50 Cr");
      expect(formatCrore(0)).toBe("0.00 Cr");
    });

    it("scales figures >= 1,000 Cr to K Cr", () => {
      expect(formatCrore(1250)).toBe("1.25 K Cr");
      expect(formatCrore(15000)).toBe("15.00 K Cr");
    });

    it("scales figures >= 100,000 Cr to L Cr", () => {
      expect(formatCrore(120000)).toBe("1.20 L Cr");
      expect(formatCrore(1850000)).toBe("18.50 L Cr");
    });

    it("handles negative figures properly", () => {
      expect(formatCrore(-50.25)).toBe("-50.25 Cr");
      expect(formatCrore(-2500)).toBe("-2.50 K Cr");
      expect(formatCrore(-150000)).toBe("-1.50 L Cr");
    });

    it("handles null, undefined, and NaN safely", () => {
      expect(formatCrore(null)).toBe("—");
      expect(formatCrore(undefined)).toBe("—");
      expect(formatCrore(Number.NaN)).toBe("—");
    });
  });

  describe("deltaColor", () => {
    it("returns 'text-up' for positive numbers", () => {
      expect(deltaColor(0.01)).toBe("text-up");
      expect(deltaColor(150)).toBe("text-up");
    });

    it("returns 'text-down' for negative numbers", () => {
      expect(deltaColor(-0.01)).toBe("text-down");
      expect(deltaColor(-99)).toBe("text-down");
    });

    it("returns 'text-muted-foreground' for zero, null, undefined, or NaN", () => {
      expect(deltaColor(0)).toBe("text-muted-foreground");
      expect(deltaColor(null)).toBe("text-muted-foreground");
      expect(deltaColor(undefined)).toBe("text-muted-foreground");
      expect(deltaColor(Number.NaN)).toBe("text-muted-foreground");
    });
  });
});
