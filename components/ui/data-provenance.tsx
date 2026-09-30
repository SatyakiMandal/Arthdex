import { AlertTriangle, Clock, Info, WifiOff } from "lucide-react";
import type { ResponseMeta } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

/**
 * Freshness badge.
 *
 * Shows the upstream's own delay and how long ago this figure was fetched.
 * Delayed data presented without this reads as live, which for a price is the
 * difference between information and misinformation.
 */
export function FreshnessBadge({
  meta,
  className,
}: {
  meta: ResponseMeta;
  className?: string;
}) {
  const stale = meta.cacheAgeSeconds > 900;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-2xs",
        stale ? "border-flat/40 bg-flat/10 text-flat" : "border-border bg-surface-muted text-muted-foreground",
        className,
      )}
      title={`${meta.source} · fetched ${meta.fetchedAt}`}
    >
      <Clock className="h-3 w-3" />
      {meta.delayedMinutes > 0 ? `${meta.delayedMinutes}m delayed` : "Live"}
      <span className="opacity-60">· {formatAge(meta.cacheAgeSeconds)}</span>
    </span>
  );
}

/** Source attribution line for the foot of a panel. */
export function SourceLine({ meta, className }: { meta: ResponseMeta; className?: string }) {
  return (
    <p className={cn("text-2xs text-muted-foreground", className)}>
      Source: {meta.source}
      {meta.delayedMinutes > 0 ? ` · delayed ${meta.delayedMinutes} min` : ""}
      {meta.note ? ` · ${meta.note}` : ""}
    </p>
  );
}

/**
 * Banner for the three areas where no live feed exists at any price.
 * Deliberately prominent: the numbers below it are not real observations.
 */
export function IllustrativeBanner({
  title = "Illustrative data: no live source exists",
  detail,
  className,
}: {
  title?: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-flat/40 bg-flat/[0.07] px-4 py-3",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flat" />
      <div>
        <p className="text-sm font-medium text-flat">{title}</p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

/** Shown when the data service cannot be reached or a route errors. */
export function DataUnavailable({
  title = "Data unavailable",
  message,
  className,
}: {
  title?: string;
  message: string;
  className?: string;
}) {
  const offline = message.includes("Cannot reach the data service");

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-down/40 bg-down/[0.06] px-4 py-3",
        className,
      )}
    >
      {offline ? (
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-down" />
      ) : (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-down" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-down">{title}</p>
        <p className="mt-1 break-words text-2xs leading-relaxed text-muted-foreground">{message}</p>
        {offline ? (
          <p className="mt-1.5 font-mono text-2xs text-muted-foreground">
            Start it with:{" "}
            <span className="text-foreground">
              cd backend &amp;&amp; ./.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Inline placeholder for a single figure the upstream could not supply. */
export function NotAvailable({ reason }: { reason?: string }) {
  return (
    <span className="text-muted-foreground" title={reason ?? "Not reported by the data source"}>
      —
    </span>
  );
}
