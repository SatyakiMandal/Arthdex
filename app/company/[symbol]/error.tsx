"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <div className="max-w-lg rounded-none border border-down/40 bg-surface p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-none border border-down/30 bg-down/10 text-down">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-2xs uppercase tracking-wider text-down">Company view error</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">Could not render company dossier</h2>
            <p className="mt-2 break-words font-mono text-xs text-muted-foreground">
              {error.message || "An unexpected error occurred while loading company data."}
            </p>
            {error.digest ? (
              <p className="mt-1 font-mono text-2xs text-muted-foreground">Digest: {error.digest}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center gap-1.5 rounded-none bg-accent px-3.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </button>
          <Link
            href="/market-watch"
            className="inline-flex h-9 items-center rounded-none border border-border bg-surface-muted px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Market watch
          </Link>
        </div>
      </div>
    </div>
  );
}
