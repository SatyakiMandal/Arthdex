"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-100 antialiased">
        <div className="w-full max-w-lg rounded-none border border-red-500/40 bg-neutral-900 p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-none border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs uppercase tracking-wider text-red-400">Critical fault</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Arthdex encountered a root error</h1>
              <p className="mt-2 break-words font-mono text-xs text-neutral-400">
                {error.message || "Unexpected root layout error."}
              </p>
              {error.digest ? (
                <p className="mt-1 font-mono text-xs text-neutral-500">Digest: {error.digest}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-9 items-center gap-1.5 rounded-none bg-amber-500 px-3.5 text-xs font-medium text-neutral-950 hover:bg-amber-400"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
