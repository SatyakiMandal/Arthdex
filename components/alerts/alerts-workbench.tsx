"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Info, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn } from "@/lib/utils";

interface Hit {
  symbol: string;
  name: string;
}

interface WatchAlert {
  id: string;
  symbol: string;
  name: string;
  metric: string;
  comparator: "lt" | "lte" | "gt" | "gte";
  threshold: number;
  current: number | null;
  createdOn: string;
}

const METRICS = [
  { id: "cmp", label: "Market price", unit: "₹" },
  { id: "peRatio", label: "P/E ratio", unit: "x" },
  { id: "pbRatio", label: "P/B ratio", unit: "x" },
];

const COMPARATORS = [
  { id: "lt", label: "drops below", symbol: "<" },
  { id: "lte", label: "is at or below", symbol: "≤" },
  { id: "gt", label: "rises above", symbol: ">" },
  { id: "gte", label: "is at or above", symbol: "≥" },
] as const;

function compare(value: number, comparator: WatchAlert["comparator"], threshold: number): boolean {
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
 * Threshold alert builder over the full listed universe.
 *
 * Conditions are evaluated against the live value at the moment the alert is
 * created. There is no persistence and no delivery channel behind this — the
 * notice says so, because a finance tool implying an alert will fire when it
 * cannot is worse than having no alerts at all.
 */
export function AlertsWorkbench() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [searching, setSearching] = useState(false);

  const [metric, setMetric] = useState("cmp");
  const [comparator, setComparator] = useState<WatchAlert["comparator"]>("lt");
  const [threshold, setThreshold] = useState<string>("");
  const [current, setCurrent] = useState<number | null>(null);
  const [loadingValue, setLoadingValue] = useState(false);

  const [alerts, setAlerts] = useState<WatchAlert[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || selected) {
      setHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const body = await response.json();
        setHits(body.results ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selected]);

  // Pull the live value so the threshold defaults to something meaningful
  useEffect(() => {
    if (!selected) {
      setCurrent(null);
      return;
    }
    let cancelled = false;
    setLoadingValue(true);
    (async () => {
      try {
        const response = await fetch(`/api/metric?symbol=${selected.symbol}&metric=${metric}`);
        const body = await response.json();
        if (cancelled) return;
        const value = typeof body.value === "number" ? body.value : null;
        setCurrent(value);
        if (value !== null) setThreshold(value.toFixed(2));
      } catch {
        if (!cancelled) setCurrent(null);
      } finally {
        if (!cancelled) setLoadingValue(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, metric]);

  function addAlert() {
    const numeric = Number(threshold);
    if (!selected || Number.isNaN(numeric)) return;
    setAlerts((prev) => [
      {
        id: `alert-${Date.now()}`,
        symbol: selected.symbol,
        name: selected.name,
        metric,
        comparator,
        threshold: numeric,
        current,
        createdOn: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
  }

  const metricMeta = METRICS.find((m) => m.id === metric);

  return (
    <DataCard
      title="Threshold Alerts"
      subtitle="Any listed company, any of three metrics"
      icon={Bell}
      footnote="Alerts live in this page only. Nothing is saved and nothing will notify you. Delivery needs a scheduler and a notification channel, neither of which is built."
    >
      <div className="flex items-start gap-2 border-b border-border bg-flat/[0.08] px-4 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-flat" />
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Conditions are evaluated against the live value when you add them. They are not
          monitored afterwards.
        </p>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-4">
        {/* Company picker */}
        <div className="relative">
          <label className="text-2xs uppercase tracking-wide text-muted-foreground">Company</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5">
            {searching ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
            ) : (
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <input
              value={selected ? `${selected.symbol} · ${selected.name}` : query}
              onChange={(e) => {
                setSelected(null);
                setQuery(e.target.value);
              }}
              placeholder="Search any listed company…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            {selected ? (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                }}
                className="shrink-0 text-2xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            ) : null}
          </div>

          {hits.length > 0 && !selected ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-xl">
              {hits.map((hit) => (
                <li key={hit.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(hit);
                      setHits([]);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-muted"
                  >
                    <span className="font-mono text-xs font-semibold">{hit.symbol}</span>
                    <span className="truncate text-2xs text-muted-foreground">{hit.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Metric</span>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Condition</span>
            <select
              value={comparator}
              onChange={(e) => setComparator(e.target.value as WatchAlert["comparator"])}
              className="rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COMPARATORS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">
              {metricMeta?.unit ?? "Value"}
            </span>
            <input
              type="number"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-28 rounded-lg border border-border bg-surface-muted px-2.5 py-1.5 font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <button
            type="button"
            disabled={!selected || threshold === ""}
            onClick={addAlert}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add alert
          </button>
        </div>

        {selected ? (
          <p className="font-mono text-2xs text-muted-foreground">
            {loadingValue ? (
              "Loading current value…"
            ) : current === null ? (
              `${metricMeta?.label} is not reported for ${selected.symbol}.`
            ) : (
              <>
                {selected.symbol} {metricMeta?.label} is currently{" "}
                <span className="text-foreground">
                  {current.toFixed(2)} {metricMeta?.unit}
                </span>
              </>
            )}
          </p>
        ) : null}
      </div>

      {alerts.length === 0 ? (
        <p className="px-4 py-6 text-2xs text-muted-foreground">
          No conditions set. Pick a company above to start.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {alerts.map((alert) => {
              const meta = METRICS.find((m) => m.id === alert.metric);
              const cmp = COMPARATORS.find((c) => c.id === alert.comparator);
              const met =
                alert.current !== null
                  ? compare(alert.current, alert.comparator, alert.threshold)
                  : null;

              return (
                <motion.li
                  key={alert.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Link
                      href={`/company/${alert.symbol}`}
                      className="font-mono text-xs font-semibold hover:text-accent"
                    >
                      {alert.symbol}
                    </Link>
                    <span className="font-mono text-xs">
                      {meta?.label} <span className="text-muted-foreground">{cmp?.symbol}</span>{" "}
                      <span className="tabular-nums">{alert.threshold}</span>
                    </span>
                    <span className="font-mono text-2xs text-muted-foreground">
                      {alert.current === null
                        ? "value not reported"
                        : `was ${alert.current.toFixed(2)} when added`}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-2xs uppercase tracking-wide",
                        met === null
                          ? "border-border bg-surface-muted text-muted-foreground"
                          : met
                            ? "border-up/40 bg-up/10 text-up"
                            : "border-border bg-surface-muted text-muted-foreground",
                      )}
                    >
                      {met === null ? "No value" : met ? "Condition met" : "Not met"}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete alert"
                      onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                      className="ml-auto rounded border border-border p-1 text-muted-foreground transition-colors hover:border-down/50 hover:text-down"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </DataCard>
  );
}
