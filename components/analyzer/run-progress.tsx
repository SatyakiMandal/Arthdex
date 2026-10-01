"use client";

import { useRef } from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzerProgress } from "@/types/analyzer";

const BLURB = [
  "Searching news archives for coverage of the company in your date range.",
  "Reading the articles and keeping only the ones that are actually about the company.",
  "Scoring each article for tone and emotion.",
  "Pulling price history for the company, its benchmark and global markets.",
  "Running the statistical, risk and valuation models.",
  "Putting the report together.",
];

export function RunProgress({
  progress,
  elapsed,
  logs,
  onCancel,
  pollError,
}: {
  progress?: AnalyzerProgress;
  elapsed: string;
  logs: string[];
  onCancel: () => void;
  pollError: boolean;
}) {
  const steps = progress?.steps ?? ["Finding news", "Reading articles", "Scoring tone", "Market data", "Running models", "Writing the report"];
  const step = progress?.step ?? 0;
  const raw = (step + (progress?.fraction ?? 0)) / steps.length;
  const best = useRef(0);
  best.current = Math.max(best.current, raw);
  const pct = Math.round(Math.min(0.98, best.current) * 100);

  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-border bg-surface" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-sm font-semibold">Analysing… {pct}%</p>
          <p suppressHydrationWarning className="mt-0.5 text-2xs text-muted-foreground">
            Elapsed {elapsed}. Full runs take a few minutes; the first one also sets up the language models.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <XCircle className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>

      <div className="h-1 w-full bg-muted">
        <div className="h-full bg-gradient-to-r from-accent to-accent/60 transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>

      <ol className="grid gap-px bg-border/60 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((label, i) => {
          const done = i < step;
          const cur = i === step;
          return (
            <li key={label} className={cn("flex items-center gap-2.5 bg-surface px-4 py-3", cur && "bg-accent/[0.06]")}>
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-2xs font-semibold",
                  done && "border-up/40 bg-up/15 text-up",
                  cur && "border-accent/50 bg-accent/15 text-accent",
                  !done && !cur && "border-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : cur ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
              </span>
              <span className={cn("text-[0.8125rem] leading-tight", cur ? "font-medium" : done ? "text-foreground/80" : "text-muted-foreground")}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          {BLURB[Math.min(step, BLURB.length - 1)]}
          {progress?.detail ? <span className="ml-2 font-mono text-2xs text-foreground/80">{progress.detail}</span> : null}
        </p>
        {pollError ? <p className="mt-2 text-2xs text-flat">Lost contact with the service; still trying. The run continues in the background.</p> : null}
        <p className="mt-3 text-2xs text-muted-foreground">You can leave this page. The run keeps going, and the result will be under Your analyses.</p>
        {logs.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-2xs text-muted-foreground hover:text-foreground">Technical details</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-background p-3 font-mono text-2xs leading-relaxed text-muted-foreground">{logs.join("\n")}</pre>
          </details>
        ) : null}
      </div>
    </section>
  );
}
