"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, FileSpreadsheet, RotateCcw, XCircle } from "lucide-react";
import { ListedSummaryView, UnlistedSummaryView } from "@/components/analyzer/summary-view";
import { RunActions } from "@/components/analyzer/run-actions";
import { RunProgress } from "@/components/analyzer/run-progress";
import { RunStatusPill } from "@/components/analyzer/run-list";
import type { AnalyzerRun, AnalyzerSummary } from "@/types/analyzer";

const POLL_MS = 2500;
const ACTIVE = ["QUEUED", "RUNNING"];

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm hover:bg-surface-muted";

function elapsed(from: string | null, now: number): string {
  if (!from) return "0:00";
  const secs = Math.max(0, Math.floor((now - Date.parse(from)) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

export function RunView({ initial }: { initial: AnalyzerRun }) {
  const [run, setRun] = useState<AnalyzerRun>(initial);
  const [summary, setSummary] = useState<AnalyzerSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const id = run.id;

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyzer/runs/${id}/summary`);
      if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? "Could not load results.");
      setSummary((await res.json()) as AnalyzerSummary);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Could not load results.");
    }
  }, [id]);

  useEffect(() => {
    if (run.status === "COMPLETED" && !summary && !summaryError) void loadSummary();
  }, [run.status, summary, summaryError, loadSummary]);

  useEffect(() => {
    if (!ACTIVE.includes(run.status)) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      try {
        const res = await fetch(`/api/analyzer/runs/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("poll failed");
        setRun((await res.json()) as AnalyzerRun);
        setPollError(false);
      } catch {
        setPollError(true);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [id, run.status]);

  async function cancel() {
    await fetch(`/api/analyzer/runs/${id}/cancel`, { method: "POST", body: "{}" });
    setRun((r) => ({ ...r, status: "CANCELLED", stage: "Cancelled" }));
  }

  const active = ACTIVE.includes(run.status);
  const log = run.log ?? [];

  return (
    <div>
      <Link href="/analyzer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All analyses
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{run.company}</h1>
          <p className="mt-1 font-mono text-2xs text-muted-foreground">
            {run.ticker ?? "Unlisted"} · {run.start} → {run.end}
            {run.origin === "sample" ? " · sample report" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunStatusPill status={run.status} />
          {run.status === "COMPLETED" ? (
            <>
              {run.hasReport ? (
                <a href={`/api/analyzer/runs/${id}/report`} target="_blank" rel="noopener noreferrer" className={BTN}>
                  <ExternalLink className="h-3.5 w-3.5" /> Full report
                </a>
              ) : null}
              {run.hasReport ? (
                <a href={`/api/analyzer/runs/${id}/download/report.html`} className={BTN}>
                  <Download className="h-3.5 w-3.5" /> HTML
                </a>
              ) : null}
              {run.hasWorkbook ? (
                <a href={`/api/analyzer/runs/${id}/download/model.xlsx`} className={BTN}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </a>
              ) : null}
              <a href={`/api/analyzer/runs/${id}/download/analysis.json`} className={BTN}>
                <Download className="h-3.5 w-3.5" /> JSON
              </a>
              <RunActions run={run} />
            </>
          ) : null}
        </div>
      </div>

      {active ? <RunProgress progress={run.progress} elapsed={elapsed(run.startedAt ?? run.createdAt, now)} logs={log} onCancel={cancel} pollError={pollError} /> : null}

      {run.status === "FAILED" || run.status === "CANCELLED" ? (
        <section className="mt-8 rounded-xl border border-down/40 bg-down/10 p-5">
          <p className="text-sm font-semibold text-down">
            {run.status === "CANCELLED" ? "This run was cancelled." : "The analysis did not finish."}
          </p>
          {run.error ? <p className="mt-2 break-words font-mono text-2xs text-foreground/80">{run.error}</p> : null}
          <Link href="/analyzer" className={`${BTN} mt-4`}>
            <RotateCcw className="h-3.5 w-3.5" /> Start another
          </Link>
          {log.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-2xs text-muted-foreground">Engine log</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-background p-3 font-mono text-2xs text-muted-foreground">
                {log.join("\n")}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {run.status === "COMPLETED" ? (
        <div className="mt-8 space-y-10">
          {summaryError ? (
            <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
              {summaryError}
            </p>
          ) : summary === null ? (
            <p className="text-sm text-muted-foreground">Loading results…</p>
          ) : summary.kind === "listed" ? (
            <ListedSummaryView s={summary} />
          ) : (
            <UnlistedSummaryView s={summary} />
          )}

        </div>
      ) : null}
    </div>
  );
}
