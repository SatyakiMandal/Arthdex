"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Info, Plus, Trash2, X } from "lucide-react";
import type { AlertCategory, AlertComparator, CustomAlert } from "@/types";
import { cn } from "@/lib/utils";

interface MetricOption {
  id: string;
  label: string;
  category: AlertCategory;
  unit: string;
  /** Current observed value, so a new alert can be evaluated immediately. */
  current?: number;
  /** Event metrics are dates, not thresholds, so they have no comparator. */
  isEvent?: boolean;
}

const COMPARATORS: { id: AlertComparator; label: string; symbol: string }[] = [
  { id: "lt", label: "drops below", symbol: "<" },
  { id: "lte", label: "is at or below", symbol: "≤" },
  { id: "gt", label: "rises above", symbol: ">" },
  { id: "gte", label: "is at or above", symbol: "≥" },
];

function compare(value: number, comparator: AlertComparator, threshold: number): boolean {
  switch (comparator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
  }
}

/**
 * Company-specific threshold alerts.
 *
 * Like the IPO subscription alerts, these are component state: not persisted,
 * not delivered. The drawer says so in a fixed notice rather than in a footnote
 * a reader might scroll past.
 */
export function CustomAlertEngine({
  symbol,
  metrics,
}: {
  symbol: string;
  metrics: MetricOption[];
}) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<CustomAlert[]>([]);
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? "");
  const [comparator, setComparator] = useState<AlertComparator>("lt");
  const [userThreshold, setUserThreshold] = useState<number | null>(null);

  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const threshold = userThreshold ?? (metric?.current !== undefined ? Number(metric.current.toFixed(2)) : 0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function addAlert() {
    if (!metric) return;
    setAlerts((prev) => [
      {
        id: `custom-${Date.now()}`,
        symbol,
        category: metric.category,
        metric: metric.id,
        comparator,
        threshold,
        note: metric.label,
        enabled: true,
        createdOn: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-none border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent"
      >
        <Bell className="h-3.5 w-3.5" />
        Alerts
        {alerts.length > 0 ? (
          <span className="ml-1 rounded-none bg-accent/20 px-1.5 py-0.2 font-mono text-2xs text-accent">
            {alerts.length}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold">Alerts · {symbol}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-start gap-2 border-b border-border bg-flat/[0.08] px-5 py-3">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flat" />
                <p className="text-2xs leading-relaxed text-muted-foreground">
                  Alerts are evaluated in this browser tab only. They do not persist across
                  sessions and will not notify you once the tab is closed.
                </p>
              </div>

              <div className="border-b border-border px-5 py-4">
                <div className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs text-muted-foreground">Metric</span>
                    <select
                      value={metricId}
                      onChange={(e) => {
                        setMetricId(e.target.value);
                        setUserThreshold(null);
                      }}
                      className="rounded-none border border-border bg-surface-muted px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {metrics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {metric?.isEvent ? (
                    <p className="rounded-none border border-border bg-surface-muted px-2.5 py-2 text-2xs text-muted-foreground">
                      This is a calendar event, not a threshold. The alert fires on the declaration
                      date once the backend supplies a results calendar.
                    </p>
                  ) : (
                    <div className="flex items-end gap-2">
                      <label className="flex flex-1 flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">
                          Condition
                        </span>
                        <select
                          value={comparator}
                          onChange={(e) => setComparator(e.target.value as AlertComparator)}
                          className="rounded-none border border-border bg-surface-muted px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {COMPARATORS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-2xs text-muted-foreground">
                          {metric?.unit ?? "Value"}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={threshold}
                          onChange={(e) => setUserThreshold(Number(e.target.value))}
                          className="w-28 rounded-none border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </label>
                    </div>
                  )}

                  {metric?.current !== undefined ? (
                    <p className="font-mono text-2xs text-muted-foreground">
                      Currently {metric.current.toFixed(2)} {metric.unit}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={addAlert}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-none bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-shadow hover:shadow-md hover:shadow-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add alert
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="px-4 py-8 text-2xs text-muted-foreground">
                    No alerts configured yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    <AnimatePresence initial={false}>
                      {alerts.map((a) => {
                        const m = metrics.find((x) => x.id === a.metric);
                        const cmp = COMPARATORS.find((c) => c.id === a.comparator);
                        const met =
                          m?.current !== undefined && !m.isEvent
                            ? compare(m.current, a.comparator, a.threshold)
                            : undefined;

                        return (
                          <motion.li
                            key={a.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex items-start gap-3 px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-xs">
                                  <span className="font-semibold">{m?.label ?? a.metric}</span>{" "}
                                  {m?.isEvent ? (
                                    <span className="text-muted-foreground">on declaration</span>
                                  ) : (
                                    <>
                                      <span className="text-muted-foreground">{cmp?.symbol}</span>{" "}
                                      <span className="tabular-nums">{a.threshold}</span>{" "}
                                      <span className="text-muted-foreground">{m?.unit}</span>
                                    </>
                                  )}
                                </p>
                                <span
                                  className={cn(
                                    "mt-1 inline-block rounded-none border px-2 py-0.5 font-mono text-2xs uppercase tracking-wide",
                                    !a.enabled
                                      ? "border-border bg-surface-muted text-muted-foreground"
                                      : met === undefined
                                        ? "border-border bg-surface-muted text-muted-foreground"
                                        : met
                                          ? "border-up/40 bg-up/10 text-up"
                                          : "border-border bg-surface-muted text-muted-foreground",
                                  )}
                                >
                                  {!a.enabled
                                    ? "Paused"
                                    : met === undefined
                                      ? "Awaiting calendar"
                                      : met
                                        ? "Condition met"
                                        : "Not met"}
                                </span>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAlerts((prev) =>
                                      prev.map((x) =>
                                        x.id === a.id ? { ...x, enabled: !x.enabled } : x,
                                      ),
                                    )
                                  }
                                  className="rounded border border-border px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  {a.enabled ? "Pause" : "Resume"}
                                </button>
                                <button
                                  type="button"
                                  aria-label="Delete alert"
                                  onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
                                  className="rounded border border-border p-1 text-muted-foreground transition-colors hover:border-down/50 hover:text-down"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export type { MetricOption };
