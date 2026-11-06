import { describe, it, expect } from "vitest";
import { evaluate, describeRule, type AlertRule } from "./alert-rules";

describe("lib/client/alert-rules", () => {
  describe("evaluate", () => {
    it("evaluates greater-than-or-equal (gte) comparator", () => {
      const rule = { comparator: "gte" as const, threshold: 3000 };
      expect(evaluate(rule, 3050)).toBe(true);
      expect(evaluate(rule, 3000)).toBe(true);
      expect(evaluate(rule, 2999.9)).toBe(false);
    });

    it("evaluates less-than-or-equal (lte) comparator", () => {
      const rule = { comparator: "lte" as const, threshold: -2.5 };
      expect(evaluate(rule, -3.0)).toBe(true);
      expect(evaluate(rule, -2.5)).toBe(true);
      expect(evaluate(rule, -2.49)).toBe(false);
      expect(evaluate(rule, 0)).toBe(false);
    });
  });

  describe("describeRule", () => {
    it("describes price rules in human readable INR format", () => {
      const rule: AlertRule = {
        id: "1",
        kind: "listed",
        target: "TCS",
        name: "Tata Consultancy Services",
        metric: "price",
        comparator: "gte",
        threshold: 3500,
        createdAt: "2026-01-01T00:00:00Z",
        triggeredAt: null,
        triggeredValue: null,
        seen: false,
      };
      expect(describeRule(rule)).toBe("Tata Consultancy Services price at or above ₹3500");
    });

    it("describes percentage change rules in human readable format", () => {
      const rule: AlertRule = {
        id: "2",
        kind: "listed",
        target: "INFY",
        name: "Infosys",
        metric: "dayChangePct",
        comparator: "lte",
        threshold: -5,
        createdAt: "2026-01-01T00:00:00Z",
        triggeredAt: null,
        triggeredValue: null,
        seen: false,
      };
      expect(describeRule(rule)).toBe("Infosys day change at or below -5%");
    });
  });
});
