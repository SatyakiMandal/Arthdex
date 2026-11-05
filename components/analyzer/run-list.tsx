"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzerRun, RunStatus } from "@/types/analyzer";

const TONE: Record<RunStatus, string> = {
  QUEUED: "border-flat/40 bg-flat/10 text-flat",
  RUNNING: "border-accent/40 bg-accent/10 text-accent",
  COMPLETED: "border-up/40 bg-up/10 text-up",
  FAILED: "border-down/40 bg-down/10 text-down",
  CANCELLED: "border-border bg-surface-muted text-muted-foreground",
};

export function RunStatusPill({ status }: { status: RunStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-none border px-1.5 py-0.2 font-mono text-3xs uppercase tracking-wider",
        TONE[status],
      )}
    >
      {status === "RUNNING" ? "Running" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const FINISHED: RunStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

export function RunList({
  runs,
  empty,
  deletable = false,
}: {
  runs: AnalyzerRun[];
  empty: string;
  /** Show delete controls (user runs only; bundled samples are read-only). */
  deletable?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: "DELETE" | "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, body: method === "POST" ? "{}" : undefined });
      if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? "Could not delete.");
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-none border border-dashed border-border px-3 py-4 text-center font-mono text-2xs text-muted-foreground">
        {empty}
      </p>
    );
  }

  const unsuccessful = runs.filter((r) => r.status === "FAILED" || r.status === "CANCELLED").length;

  return (
    <div>
      {deletable && unsuccessful > 1 ? (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => call("/api/analyzer/runs/clear-unsuccessful", "POST")}
            className="inline-flex h-6 items-center gap-1 rounded-none border border-border px-2 font-mono text-3xs uppercase tracking-wider text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <Trash2 className="h-2.5 w-2.5" /> Clear {unsuccessful} failed &amp; cancelled
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-2 rounded-none border border-down/40 bg-down/10 px-2.5 py-1 font-mono text-3xs text-down">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {runs.map((r) => (
          <li key={r.id} className="relative">
            <Link
              href={`/analyzer/${r.id}`}
              className="group flex h-full flex-col rounded-none border border-border bg-surface p-2.5 transition-colors hover:border-accent/50 cell-glow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold font-mono tracking-tight text-foreground">{r.company}</p>
                  <p className="mt-0.5 font-mono text-3xs text-muted-foreground">
                    {r.ticker ?? "Unlisted"} · {r.start} → {r.end}
                  </p>
                </div>
                <RunStatusPill status={r.status} />
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-3xs text-muted-foreground">
                <span>{r.kind === "unlisted" ? "Unlisted price-move study" : "Full event-impact report"}</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              {r.status === "FAILED" && r.error ? (
                <p className="mt-1.5 line-clamp-2 font-mono text-3xs text-down">{r.error}</p>
              ) : null}
              {deletable && FINISHED.includes(r.status) ? <div className="h-6" aria-hidden /> : null}
            </Link>

            {deletable && FINISHED.includes(r.status) ? (
              <div className="absolute bottom-2 right-2 flex items-center gap-1 font-mono">
                {confirming === r.id ? (
                  <>
                    <span className="text-3xs text-muted-foreground">Delete?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call(`/api/analyzer/runs/${r.id}`, "DELETE")}
                      className="h-5 rounded-none border border-down/40 bg-down/10 px-1.5 text-3xs font-bold text-down hover:bg-down/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="h-5 rounded-none border border-border px-1.5 text-3xs text-muted-foreground hover:bg-surface-muted"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete analysis of ${r.company}`}
                    title="Delete this analysis (the company's scraped news is kept)"
                    onClick={() => setConfirming(r.id)}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-none border border-border text-muted-foreground hover:border-down/40 hover:text-down"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {deletable ? (
        <p className="mt-2 font-mono text-3xs text-muted-foreground">
          Deleting removes the report, workbook and results for that run only. Scraped news for each company is
          kept and reused by later runs.
        </p>
      ) : null}
    </div>
  );
}
