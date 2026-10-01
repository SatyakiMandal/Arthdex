"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Columns2, Link2, Loader2, Printer, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzerRun } from "@/types/analyzer";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm transition-all hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Share, print, re-run and compare controls for a finished analysis. */
export function RunActions({ run }: { run: AnalyzerRun }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/analyzer/${run.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. The address bar link works the same way.");
    }
  }

  function printReport() {
    const w = window.open(`/api/analyzer/runs/${run.id}/report`, "_blank");
    // Print once the report has loaded, so "Save as PDF" captures the finished page
    w?.addEventListener("load", () => w.print());
  }

  async function rerun() {
    if (!run.start || !run.end) return;
    setBusy(true);
    setError(null);
    // Keep the same window length but end today, so the re-run picks up the latest news and prices
    const span = Math.round((Date.parse(run.end) - Date.parse(run.start)) / 86_400_000);
    const end = iso(new Date());
    const start = iso(new Date(Date.now() - span * 86_400_000));
    try {
      const body =
        run.kind === "listed"
          ? { kind: "listed", company: run.company, ticker: run.ticker, start, end }
          : { kind: "unlisted", company: run.company, start, end };
      const res = await fetch("/api/analyzer/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(Array.isArray(json.detail) ? json.detail.map((d: { msg: string }) => d.msg).join("; ") : json.detail);
      }
      router.push(`/analyzer/${(json as AnalyzerRun).id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the re-run.");
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={copyLink} className={BTN}>
        {copied ? <Check className="h-3.5 w-3.5 text-up" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {run.hasReport ? (
        <button type="button" onClick={printReport} className={BTN}>
          <Printer className="h-3.5 w-3.5" /> PDF
        </button>
      ) : null}
      <button type="button" onClick={rerun} disabled={busy || !run.start || !run.end} className={BTN} title="Run again over the same length of window, ending today">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Re-run
      </button>
      <CompareMenu run={run} />
      {error ? (
        <p role="alert" className="basis-full text-right text-2xs text-down">
          {error}
        </p>
      ) : null}
    </>
  );
}

function CompareMenu({ run }: { run: AnalyzerRun }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<AnalyzerRun[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || runs) return;
    fetch("/api/analyzer/runs?limit=60")
      .then((r) => r.json())
      .then((b: { runs: AnalyzerRun[] }) => setRuns(b.runs))
      .catch(() => setRuns([]));
  }, [open, runs]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const others = (runs ?? []).filter((r) => r.id !== run.id && r.status === "COMPLETED" && r.kind === run.kind);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={BTN}>
        <Columns2 className="h-3.5 w-3.5" /> Compare
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 max-h-72 w-72 overflow-auto rounded-xl border border-border bg-surface-raised p-1 shadow-xl">
          {runs === null ? (
            <p className="px-3 py-3 text-2xs text-muted-foreground">Loading analyses…</p>
          ) : others.length === 0 ? (
            <p className="px-3 py-3 text-2xs text-muted-foreground">No other finished {run.kind} analysis to compare with yet.</p>
          ) : (
            others.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => router.push(`/analyzer/compare?a=${run.id}&b=${r.id}`)}
                className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-muted"
              >
                <span className="block truncate text-sm">{r.company}</span>
                <span className="block font-mono text-2xs text-muted-foreground">
                  {r.start} to {r.end}
                  {r.origin === "sample" ? " · sample" : ""}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
