import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export function RunList({
  runs,
  empty,
}: {
  runs: AnalyzerRun[];
  empty: string;
}) {
  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {runs.map((r) => (
        <li key={r.id}>
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
