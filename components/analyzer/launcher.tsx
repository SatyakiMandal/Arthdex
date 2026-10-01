"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzerRun, AnalyzerSearchHit } from "@/types/analyzer";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

const PRESETS = [
  { label: "3M", days: 92 },
  { label: "6M", days: 183 },
  { label: "1Y", days: 365 },
];

const TICKER_LIKE = /^[A-Za-z0-9&.^-]{1,20}$/;

export function Launcher() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AnalyzerSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<AnalyzerSearchHit | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [unlistedReady, setUnlistedReady] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Dates are filled after mount so server and client markup match.
  useEffect(() => {
    setEnd(daysAgo(0));
    setStart(daysAgo(183));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (picked || q.length < 2) {
      setHits([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/analyzer/search?q=${encodeURIComponent(q)}`);
        if (mine !== seq.current) return;
        if (!res.ok) {
          setSearchError("Search is unavailable right now.");
          setHits([]);
          return;
        }
        setSearchError(null);
        const body = (await res.json()) as { results: AnalyzerSearchHit[]; unlistedReady?: boolean };
        setHits(body.results);
        setUnlistedReady(body.unlistedReady !== false);
        setActive(-1);
      } catch {
        if (mine === seq.current) setSearchError("Search is unavailable right now.");
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query, picked]);

  const span = useMemo(() => {
    if (!start || !end) return null;
    return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  }, [start, end]);

  function choose(hit: AnalyzerSearchHit) {
    setPicked(hit);
    setQuery(hit.name);
    setOpen(false);
    setError(null);
  }

  // A raw ticker is accepted for listed names the NSE list may not carry (e.g. BSE-only).
  // Unlisted companies must be picked, since the run needs the exact directory page.
  const rawTicker = !picked && TICKER_LIKE.test(query.trim());
  const kind = picked?.kind ?? "listed";

  const ready = !!start && !!end && !submitting && (picked !== null || rawTicker);

  async function submit() {
    setError(null);
    if (span !== null && span < 45) return setError("Choose a window of at least 45 days.");
    setSubmitting(true);
    try {
      const body =
        kind === "listed"
          ? {
              kind,
              company: picked?.name ?? query.trim().toUpperCase(),
              ticker: picked?.ticker ?? query.trim().toUpperCase(),
              start,
              end,
            }
          : { kind, company: picked?.name ?? query.trim(), url: picked?.url ?? undefined, start, end };
      const res = await fetch("/api/analyzer/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(json.detail)
          ? json.detail.map((d: { msg: string }) => d.msg).join("; ")
          : json.detail;
        throw new Error(detail || "Could not start the analysis.");
      }
      router.push(`/analyzer/${(json as AnalyzerRun).id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the analysis.");
      setSubmitting(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? hits.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Run a new analysis</h2>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative">
          <label htmlFor="an-company" className="text-2xs uppercase tracking-wider text-muted-foreground">
            Listed or unlisted company
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="an-company"
              role="combobox"
              aria-expanded={open && hits.length > 0}
              aria-controls="an-listbox"
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              placeholder="e.g. Tata Consultancy, GRSE, Garuda Aerospace"
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKey}
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
            />
          </div>

          {open && hits.length > 0 ? (
            <ul
              id="an-listbox"
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
            >
              {hits.map((h, i) => (
                <li
                  key={`${h.ticker ?? h.url}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                    i === active ? "bg-surface-muted" : "",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{h.name}</span>
                    {h.sector ? <span className="block truncate text-2xs text-muted-foreground">{h.sector}</span> : null}
                  </span>
                  {h.kind === "unlisted" ? (
                    <span className="shrink-0 rounded border border-flat/40 bg-flat/10 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-flat">
                      Unlisted
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">{h.symbol}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-1.5 min-h-4 text-2xs text-muted-foreground">
            {searchError ? (
              <span className="text-down">{searchError}</span>
            ) : picked ? (
              kind === "listed" ? (
                <>Will analyse <span className="font-mono">{picked.ticker}</span> against Nifty 50.</>
              ) : (
                "Unlisted company. Price history comes from indicative dealer quotes, so the analysis reports revisions rather than a daily event study."
              )
            ) : rawTicker ? (
              <>No match picked. Will use <span className="font-mono">{query.trim().toUpperCase()}</span> as the ticker (add .NS or .BO if needed).</>
            ) : !unlistedReady && query.trim().length >= 2 ? (
              "Unlisted companies are still loading. Listed matches are shown; search again in a moment for unlisted ones."
            ) : (
              "Searches all NSE-listed equities and the unlisted / pre-IPO directory."
            )}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-wider text-muted-foreground">Window</span>
            <div className="flex gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setEnd(daysAgo(0));
                    setStart(daysAgo(p.days));
                  }}
                  className="rounded-md border border-border px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-accent"
            />
            <input
              type="date"
              aria-label="End date"
              value={end}
              min={start || undefined}
              max={daysAgo(0)}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-accent"
            />
          </div>
          <p className="mt-1.5 text-2xs text-muted-foreground">
            {span === null ? "" : `${span} days. Between 45 and 800 days.`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run full analysis
        </button>
        <p className="text-2xs text-muted-foreground">
          Scrapes eight news sources, scores sentiment with FinBERT, then runs the event study,
          volatility, risk, technical and valuation models. Expect several minutes.
        </p>
      </div>
      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
