"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  const displayMessage = isDev
    ? error.message || "Unexpected runtime exception."
    : "An unexpected runtime error occurred while computing platform analytics. The incident has been safely logged.";

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg rounded-none border border-down/40 bg-surface p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-none border border-down/30 bg-down/10 text-down">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-2xs uppercase tracking-wider text-down font-semibold">Runtime Fault</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Analytics Execution Exception</h1>
            <p className="mt-2 break-words font-mono text-xs text-muted-foreground leading-relaxed">
              {displayMessage}
            </p>
            {error.digest ? (
              <p className="mt-2 font-mono text-3xs text-muted-foreground">Incident Digest: {error.digest}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center gap-1.5 rounded-none bg-accent px-3.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Calculation
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-none border border-border bg-surface-muted px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
