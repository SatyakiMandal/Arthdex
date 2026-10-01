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
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider",
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
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  const unsuccessful = runs.filter((r) => r.status === "FAILED" || r.status === "CANCELLED").length;

  return (
    <div>
      {deletable && unsuccessful > 1 ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => call("/api/analyzer/runs/clear-unsuccessful", "POST")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-2xs text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Clear {unsuccessful} failed &amp; cancelled
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-2xs text-down">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {runs.map((r) => (
          <li key={r.id} className="relative">
            <Link
              href={`/analyzer/${r.id}`}
              className="group flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{r.company}</p>
                  <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                    {r.ticker ?? "Unlisted"} · {r.start} → {r.end}
                  </p>
                </div>
                <RunStatusPill status={r.status} />
              </div>
              <div className="mt-3 flex items-center justify-between text-2xs text-muted-foreground">
                <span>{r.kind === "unlisted" ? "Unlisted price-move study" : "Full event-impact report"}</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>
              {r.status === "FAILED" && r.error ? (
                <p className="mt-2 line-clamp-2 text-2xs text-down">{r.error}</p>
              ) : null}
              {deletable && FINISHED.includes(r.status) ? <div className="h-7" aria-hidden /> : null}
            </Link>

            {deletable && FINISHED.includes(r.status) ? (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                {confirming === r.id ? (
                  <>
                    <span className="text-2xs text-muted-foreground">Delete this analysis?</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => call(`/api/analyzer/runs/${r.id}`, "DELETE")}
                      className="h-7 rounded-md border border-down/40 bg-down/10 px-2 text-2xs font-medium text-down hover:bg-down/20 disabled:opacity-50"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="h-7 rounded-md border border-border px-2 text-2xs text-muted-foreground hover:bg-surface-muted"
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
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-down/40 hover:text-down"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {deletable ? (
        <p className="mt-3 text-2xs text-muted-foreground">
          Deleting removes the report, workbook and results for that run only. Scraped news for each company is
          kept and reused by later runs.
        </p>
      ) : null}
    </div>
  );
}
