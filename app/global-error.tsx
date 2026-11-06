"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  const displayMessage = isDev
    ? error.message || "Unexpected root layout exception."
    : "A critical runtime error occurred. Telemetry has logged the incident.";

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-100 antialiased font-sans">
        <div className="w-full max-w-lg rounded-none border border-red-500/40 bg-neutral-900 p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-none border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-2xs uppercase tracking-wider text-red-400 font-semibold">Critical Fault</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Root Application Exception</h1>
              <p className="mt-2 break-words font-mono text-xs text-neutral-400 leading-relaxed">
                {displayMessage}
              </p>
              {error.digest ? (
                <p className="mt-2 font-mono text-3xs text-neutral-500">Incident Digest: {error.digest}</p>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex h-9 items-center gap-1.5 rounded-none bg-amber-500 px-3.5 text-xs font-semibold text-neutral-950 hover:bg-amber-400 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
