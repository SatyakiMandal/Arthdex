"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, CheckCircle2, ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { CompanyPicker, type PickedCompany } from "@/components/search/company-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { describeRule, useAlertRules, type RuleComparator, type RuleMetric } from "@/lib/client/alert-rules";
import { cn, formatINR } from "@/lib/utils";

const COMPARATORS = [
  { id: "gte" as const, label: "At or above" },
  { id: "lte" as const, label: "At or below" },
];

const METRICS = [
  { id: "price" as const, label: "Price" },
  { id: "dayChangePct" as const, label: "Day change %" },
];

const label = "mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground";

export function MyAlerts() {
  const params = useSearchParams();
  const { rules, add, remove, rearm, markAllSeen, ready } = useAlertRules();
  const [company, setCompany] = useState<PickedCompany | null>(null);
  const [metric, setMetric] = useState<RuleMetric>("price");
  const [comparator, setComparator] = useState<RuleComparator>("gte");
  const [threshold, setThreshold] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [error, setError] = useState<string | null>(null);

  // Arriving from a watchlist row pre-fills the company
  useEffect(() => {
    const kind = params.get("kind");
    const target = params.get("target");
    const name = params.get("name");
    if ((kind === "listed" || kind === "unlisted") && target && name) setCompany({ kind, id: target, name });
  }, [params]);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  // Opening this page counts as having seen the fired alerts
  useEffect(() => {
    if (ready) markAllSeen();
  }, [ready, markAllSeen]);

  // Unlisted names only have a price, never a daily change
  const unlisted = company?.kind === "unlisted";
  useEffect(() => {
    if (unlisted) setMetric("price");
  }, [unlisted]);

  function submit() {
    setError(null);
    const value = Number(threshold);
    if (!company) return setError("Choose a company first.");
    if (!threshold.trim() || !Number.isFinite(value)) return setError("Enter a number for the threshold.");
    if (metric === "price" && value <= 0) return setError("A price threshold must be above zero.");
    add({ kind: company.kind, target: company.id, name: company.name, metric, comparator, threshold: value });
    setThreshold("");
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
            <BellRing className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">My price alerts</h2>
            <p className="text-2xs text-muted-foreground">Listed and unlisted companies, checked every minute</p>
          </div>
        </div>
        {permission === "default" ? (
          <button type="button" onClick={enableNotifications} className="btn-ghost h-8 px-3 py-0 text-xs">
            Turn on browser notifications
          </button>
        ) : permission === "granted" ? (
          <span className="inline-flex items-center gap-1 text-2xs text-up">
            <CheckCircle2 className="h-3.5 w-3.5" /> Browser notifications on
          </span>
        ) : permission === "denied" ? (
          <span className="text-2xs text-muted-foreground">Notifications are blocked in this browser. Alerts still show here and on the bell.</span>
        ) : null}
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_auto_auto_minmax(0,0.7fr)_auto] lg:items-end">
        <CompanyPicker id="alert-company" value={company} onPick={setCompany} />
        <div>
          <span className={label}>Watch</span>
          <SegmentedControl
            options={unlisted ? METRICS.slice(0, 1) : METRICS}
            value={metric}
            onChange={setMetric}
            layoutGroupId="alert-metric"
          />
        </div>
        <div>
          <span className={label}>When it is</span>
          <SegmentedControl options={COMPARATORS} value={comparator} onChange={setComparator} layoutGroupId="alert-comparator" />
        </div>
        <div>
          <label htmlFor="alert-threshold" className={label}>
            {metric === "price" ? "Price (₹)" : "Percent"}
          </label>
          <input
            id="alert-threshold"
            inputMode="decimal"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={metric === "price" ? "e.g. 1250" : "e.g. -3"}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
          />
        </div>
        <button type="button" onClick={submit} className="btn-primary h-10 px-5 py-0 active:scale-[0.98]">
          Add alert
        </button>
      </div>
      {error ? (
        <p role="alert" className="mx-4 mb-3 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          {error}
        </p>
      ) : null}

      {!ready ? null : rules.length === 0 ? (
        <p className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No alerts yet. Pick a company above, or press the bell on a row of your{" "}
          <Link href="/watchlist" className="text-accent hover:underline">
            watchlist
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{describeRule(r)}</p>
                <p className={cn("mt-0.5 text-2xs", r.triggeredAt ? "text-flat" : "text-muted-foreground")}>
                  {r.triggeredAt
                    ? `Triggered ${new Date(r.triggeredAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} at ${
                        r.metric === "price" ? `₹${formatINR(r.triggeredValue ?? 0, 2)}` : `${(r.triggeredValue ?? 0).toFixed(2)}%`
                      }`
                    : "Watching"}
                  {r.kind === "unlisted" ? " · unlisted, indicative price" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {r.triggeredAt ? (
                  <button
                    type="button"
                    onClick={() => rearm(r.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Re-arm
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Delete alert for ${r.name}`}
                  onClick={() => remove(r.id)}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-down/10 hover:text-down"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="group border-t border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-2xs text-muted-foreground hover:text-foreground">
          How these alerts work
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <p className="px-4 pb-3 text-2xs leading-relaxed text-muted-foreground">
          Rules are saved in this browser. While any Arthdex tab is open, they are checked once a minute against prices
          that are about 15 minutes delayed. A rule fires once, then waits until you re-arm it. Nothing is sent when every
          Arthdex tab is closed, and there is no email or phone push yet. That needs the site to run around the clock.
        </p>
      </details>
    </section>
  );
}
