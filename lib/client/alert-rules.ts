"use client";

import { useCallback } from "react";
import { useLocalStore } from "./use-local-store";
import type { WatchKind } from "./watchlist";

export type RuleMetric = "price" | "dayChangePct";
export type RuleComparator = "gte" | "lte";

export interface AlertRule {
  id: string;
  kind: WatchKind;
  /** NSE symbol or unlisted directory id. */
  target: string;
  name: string;
  metric: RuleMetric;
  comparator: RuleComparator;
  threshold: number;
  createdAt: string;
  /** Set when the rule fired; a fired rule stays quiet until it is re-armed. */
  triggeredAt: string | null;
  triggeredValue: number | null;
  seen: boolean;
}

const KEY = "arthdex:alerts:v1";
const EMPTY: AlertRule[] = [];

export function evaluate(rule: Pick<AlertRule, "comparator" | "threshold">, value: number): boolean {
  return rule.comparator === "gte" ? value >= rule.threshold : value <= rule.threshold;
}

export function describeRule(rule: AlertRule): string {
  const metric = rule.metric === "price" ? "price" : "day change";
  const op = rule.comparator === "gte" ? "at or above" : "at or below";
  const value = rule.metric === "price" ? `₹${rule.threshold}` : `${rule.threshold}%`;
  return `${rule.name} ${metric} ${op} ${value}`;
}

export function useAlertRules() {
  const [rules, setRules, ready] = useLocalStore<AlertRule[]>(KEY, EMPTY);

  const add = useCallback(
    (rule: Omit<AlertRule, "id" | "createdAt" | "triggeredAt" | "triggeredValue" | "seen">) =>
      setRules((prev) => [
        ...prev,
        { ...rule, id: crypto.randomUUID(), createdAt: new Date().toISOString(), triggeredAt: null, triggeredValue: null, seen: true },
      ]),
    [setRules],
  );
  const remove = useCallback((id: string) => setRules((prev) => prev.filter((r) => r.id !== id)), [setRules]);
  const rearm = useCallback(
    (id: string) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, triggeredAt: null, triggeredValue: null, seen: true } : r))),
    [setRules],
  );
  const markAllSeen = useCallback(() => setRules((prev) => prev.map((r) => (r.seen ? r : { ...r, seen: true }))), [setRules]);

  return { rules, setRules, add, remove, rearm, markAllSeen, ready, unseen: rules.filter((r) => r.triggeredAt && !r.seen).length };
}
