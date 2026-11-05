"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const params = useSearchParams();

  // Arriving from "Analyze in depth" on a mover pre-fills the company
  const [picked, setPicked] = useState<AnalyzerSearchHit | null>(() => {
    const company = params.get("company");
    const ticker = params.get("ticker");
    if (company && ticker) {
      return { kind: "listed", name: company, ticker, symbol: ticker.replace(/\.(NS|BO)$/i, ""), url: null, sector: null };
    }
    return null;
  });

  const [query, setQuery] = useState(() => params.get("company") ?? "");
  const [hits, setHits] = useState<AnalyzerSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [unlistedReady, setUnlistedReady] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Dates are filled after mount so server and client markup match.
  useEffect(() => {
    const t = setTimeout(() => {
      setEnd(daysAgo(0));
      setStart(daysAgo(183));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (picked || q.length < 2) return;

    let cancelled = false;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/analyzer/search?q=${encodeURIComponent(q)}`);
        if (mine !== seq.current || cancelled) return;
        if (!res.ok) {
          setSearchError("Search is unavailable right now.");
          setHits([]);
          return;
        }
        setSearchError(null);
        const body = (await res.json()) as { results: AnalyzerSearchHit[]; unlistedReady?: boolean };
        if (!cancelled) {
          setHits(body.results ?? []);
          setUnlistedReady(body.unlistedReady !== false);
          setActive(-1);
        }
      } catch {
        if (mine === seq.current && !cancelled) setSearchError("Search is unavailable right now.");
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, picked]);

  const visibleHits = picked || query.trim().length < 2 ? [] : hits;

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
    if (!open || visibleHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % visibleHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? visibleHits.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(visibleHits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="rounded-none border border-border bg-surface p-3 font-mono text-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-1.5">
        <h2 className="text-2xs font-bold uppercase tracking-wider text-foreground">Initiate Event Impact Study</h2>
        <span className="text-3xs text-muted-foreground">Scrapes 8 News Outlets · FinBERT Emotion Tags · 11 Multi-Factor Models</span>
      </div>

      <div className="mt-2.5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="relative">
          <label htmlFor="an-company" className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">
            Target Scrip / Company Name
          </label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="an-company"
              role="combobox"
              aria-expanded={open && visibleHits.length > 0}
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
              className="h-7 w-full rounded-none border border-border bg-background pl-8 pr-2 font-mono text-2xs outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
            />
          </div>

          {open && visibleHits.length > 0 ? (
            <ul
              id="an-listbox"
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-none border border-border bg-surface-raised p-0.5 shadow-lg font-mono text-2xs"
            >
              {visibleHits.map((h, i) => (
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
                    "flex cursor-pointer items-center justify-between gap-2 rounded-none px-2 py-1 text-2xs",
                    i === active ? "bg-surface-muted text-accent" : "",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{h.name}</span>
                    {h.sector ? <span className="block truncate text-3xs text-muted-foreground">{h.sector}</span> : null}
                  </span>
                  {h.kind === "unlisted" ? (
                    <span className="shrink-0 rounded-none border border-gold/40 bg-gold/10 px-1 py-0.2 font-mono text-3xs uppercase tracking-wide text-gold">
                      Unlisted
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-3xs text-muted-foreground">{h.symbol}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-1 min-h-4 text-3xs text-muted-foreground font-sans">
            {searchError ? (
              <span className="text-down">{searchError}</span>
            ) : picked ? (
              kind === "listed" ? (
                <>Will analyse <span className="font-mono font-bold text-foreground">{picked.ticker}</span> against Nifty 50 benchmark.</>
              ) : (
                "Unlisted company. Price history sourced from indicative OTC dealer marks."
              )
            ) : rawTicker ? (
              <>Direct ticker: <span className="font-mono font-bold text-foreground">{query.trim().toUpperCase()}</span>.</>
            ) : !unlistedReady && query.trim().length >= 2 ? (
              "Unlisted companies loading. Showing listed matches."
            ) : (
              "Searches all NSE-listed equities and OTC pre-IPO unlisted directory."
            )}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-3xs uppercase tracking-wider text-muted-foreground font-semibold">Observation Horizon</span>
            <div className="flex gap-1 font-mono">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setEnd(daysAgo(0));
                    setStart(daysAgo(p.days));
                  }}
                  className="rounded-none border border-border bg-surface px-1.5 py-0.2 text-3xs text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="date"
              aria-label="Start date"
              value={start}
              max={end || undefined}
              onChange={(e) => setStart(e.target.value)}
              className="h-7 rounded-none border border-border bg-background px-2 font-mono text-2xs outline-none focus:border-accent"
            />
            <input
              type="date"
              aria-label="End date"
              value={end}
              min={start || undefined}
              max={daysAgo(0)}
              onChange={(e) => setEnd(e.target.value)}
              className="h-7 rounded-none border border-border bg-background px-2 font-mono text-2xs outline-none focus:border-accent"
            />
          </div>
          <p className="mt-1 text-3xs text-muted-foreground font-mono">
            {span === null ? "" : `${span} trading days span (Minimum: 45 days, Maximum: 800 days).`}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 border-t border-border pt-2 font-mono">
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          className="inline-flex h-7 items-center gap-1.5 rounded-none bg-accent px-3 text-2xs font-bold uppercase tracking-wider text-accent-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run Full Event Study
        </button>
        <p className="text-3xs text-muted-foreground font-sans">
          Scrapes 8 national news desks, scores sentiment with FinBERT, and generates 11 econometric validation models.
        </p>
      </div>
      {error ? (
        <p role="alert" className="mt-2 rounded-none border border-down/40 bg-down/10 px-2.5 py-1 text-3xs text-down font-mono">
          {error}
        </p>
      ) : null}
    </div>
  );
}
