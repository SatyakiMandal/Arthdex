"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FlaskConical, Loader2, RotateCw } from "lucide-react";
import { ListedDossier } from "@/components/analyzer/dossier";
import type { AnalyzerRun, AnalyzerSummary } from "@/types/analyzer";

const POLL_MS = 3000;

function elapsed(from: string | null, now: number): string {
  if (!from) return "0:00";
  const secs = Math.max(0, Math.floor((now - Date.parse(from)) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/**
 * The full quantitative dossier for one company, without news scraping.
 *
 * Opening the tab asks the data service for a snapshot. A recent one is served
 * instantly; otherwise the engine runs in the background (a few minutes) and
 * this panel polls it. Everything here comes from prices, filings and macro
 * series, so it needs no crawl and is shared by every visitor.
 */
export function ResearchPanel({ symbol }: { symbol: string }) {
  const [run, setRun] = useState<AnalyzerRun | null>(null);
  const [summary, setSummary] = useState<AnalyzerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const start = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/analyzer/snapshots/${symbol}`, { method: "POST", body: "{}" });
      const body = (await res.json()) as AnalyzerRun & { detail?: string };
      if (!res.ok) throw new Error(body.detail ?? "Could not start the analysis.");
      setRun(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the analysis.");
    }
  }, [symbol]);

  useEffect(() => {
    void start();
  }, [start]);

  const id = run?.id;
  const status = run?.status;

  useEffect(() => {
    if (!id || (status !== "QUEUED" && status !== "RUNNING")) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      try {
        const res = await fetch(`/api/analyzer/runs/${id}`, { cache: "no-store" });
        if (res.ok) setRun((await res.json()) as AnalyzerRun);
      } catch {
        // transient; the next tick retries
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [id, status]);

  useEffect(() => {
    if (!id || status !== "COMPLETED" || summary) return;
    (async () => {
      try {
        const res = await fetch(`/api/analyzer/runs/${id}/summary`);
        if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? "Could not load results.");
        setSummary((await res.json()) as AnalyzerSummary);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load results.");
      }
    })();
  }, [id, status, summary]);

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-5">
        <p className="text-sm font-semibold text-down">The research dossier could not be produced.</p>
        <p className="mt-2 break-words font-mono text-2xs text-foreground/80">{error}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-muted"
        >
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  if (run && (run.status === "FAILED" || run.status === "CANCELLED")) {
    return (
      <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-5">
        <p className="text-sm font-semibold text-down">The analysis did not finish for {symbol}.</p>
        {run.error ? <p className="mt-2 break-words font-mono text-2xs text-foreground/80">{run.error}</p> : null}
        <p className="mt-2 text-2xs text-muted-foreground">
          Usually this means too little price history. A failed attempt is retried automatically after a few minutes.
        </p>
        <button
          type="button"
          onClick={() => void start()}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-muted"
        >
          <RotateCw className="h-3.5 w-3.5" /> Check again
        </button>
      </div>
    );
  }

  if (!summary || summary.kind !== "listed") {
    const live = run?.status === "QUEUED" || run?.status === "RUNNING";
    return (
      <section className="rounded-xl border border-border bg-surface p-5" aria-live="polite">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <div>
            <p className="text-sm font-semibold">{live ? `${run?.stage ?? "Working"}…` : "Preparing the analysis…"}</p>
            <p className="text-2xs text-muted-foreground">
              Fitting the valuation, technical, volatility, risk and macro models for {symbol}.
              {live ? ` Elapsed ${elapsed(run?.startedAt ?? run?.createdAt ?? null, now)}.` : ""} This takes a few minutes
              the first time; afterwards it is served instantly for about twelve hours.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <p className="text-2xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider text-accent">Quantitative snapshot</span>{" "}
          · {summary.start} → {summary.end}. Built from prices, filings and macro data only. No news is analysed, so the event-study
          pillar is marked &ldquo;Not assessed&rdquo; and its weight is shared across the other four.
        </p>
        <Link
          href="/analyzer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-2xs hover:bg-surface-muted"
        >
          <FlaskConical className="h-3.5 w-3.5" /> Run the event-impact analysis
        </Link>
      </div>
      <ListedDossier s={summary} hideEvent />
    </div>
  );
}
