"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { AnalyzerRun } from "@/types/analyzer";

/** Waits for a run that was started for the comparison, then reloads the page when it finishes. */
export function ComparePending({ runId, company }: { runId: string; company: string }) {
  const router = useRouter();
  const [run, setRun] = useState<AnalyzerRun | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/analyzer/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const r = (await res.json()) as AnalyzerRun;
        if (stopped) return;
        setRun(r);
        if (r.status === "COMPLETED") router.refresh();
      } catch {
        // The next poll will try again
      }
    }
    void poll();
    const t = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [runId, router]);

  const failed = run && (run.status === "FAILED" || run.status === "CANCELLED");
  const fraction = run?.progress?.fraction ?? 0;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
      {failed ? (
        <>
          <p className="text-sm font-semibold text-down">The analysis of {company} did not finish.</p>
          {run?.error ? <p className="mt-2 break-words font-mono text-2xs text-muted-foreground">{run.error}</p> : null}
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Analysing {company} for the comparison
          </p>
          <p className="mt-1 text-2xs text-muted-foreground">
            {run?.stage ?? "Starting"}. This page opens the comparison as soon as the analysis finishes; a full analysis takes several minutes.
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.max(3, Math.round(fraction * 100))}%` }} />
          </div>
        </>
      )}
    </section>
  );
}
