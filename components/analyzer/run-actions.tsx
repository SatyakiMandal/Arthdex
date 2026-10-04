"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, Printer, RefreshCw } from "lucide-react";
import { CompareMenu } from "@/components/analyzer/compare-menu";
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
