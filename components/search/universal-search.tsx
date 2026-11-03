"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CornerDownRight, Loader2, Search, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchHit {
  id: string;
  symbol: string;
  name: string;
  series: string;
  isin: string | null;
  kind: "listed" | "unlisted" | "page";
  href: string;
}

/** Every tool, findable by name or by the words people use for it, so search doubles as navigation. */
const PAGES: { name: string; href: string; words: string }[] = [
  { name: "Market watch", href: "/market-watch", words: "indices movers gainers losers breadth nifty sensex" },
  { name: "Results season", href: "/results", words: "results earnings season quarterly reported beat profit growth q1 q2 q3 q4" },
  { name: "Derivatives", href: "/derivatives", words: "options option chain open interest oi pcr max pain futures f&o fno build-up greeks iv" },
  { name: "Commodities", href: "/commodities", words: "gold silver crude oil metals energy rupee usd" },
  { name: "Screener", href: "/screener", words: "screen macd factor alpha beta momentum filter" },
  { name: "IPO desk", href: "/ipo", words: "ipo listing issue subscription gmp primary" },
  { name: "Unlisted", href: "/unlisted", words: "unlisted pre-ipo private shares" },
  { name: "News and filings", href: "/news", words: "news filings announcements press" },
  { name: "Event analyzer", href: "/analyzer", words: "analyzer event impact study sentiment" },
  { name: "Morning briefing", href: "/briefing", words: "briefing today summary morning" },
  { name: "Track record", href: "/track-record", words: "track record calls decisions performance" },
  { name: "Order flow", href: "/orderflow", words: "order flow footprint cvd gex volume profile options" },
  { name: "Bulk and block deals", href: "/deals", words: "deals bulk block short" },
  { name: "Results calendar", href: "/calendar", words: "calendar results board meetings dividend split bonus" },
  { name: "Bhavcopy", href: "/bhavcopy", words: "bhavcopy delivery eod end of day" },
  { name: "Watchlist", href: "/watchlist", words: "watchlist saved favourites" },
  { name: "Alerts", href: "/alerts", words: "alerts notify price" },
  { name: "Methodology", href: "/methodology", words: "methodology how computed models" },
  { name: "Data status", href: "/status", words: "status health feeds freshness watchdog" },
];

function matchPages(q: string): SearchHit[] {
  const needle = q.toLowerCase();
  if (needle.length < 2) return [];
  return PAGES.filter((p) => p.name.toLowerCase().includes(needle) || p.words.split(" ").some((w) => w.startsWith(needle)))
    .slice(0, 3)
    .map((p) => ({ id: `page:${p.href}`, symbol: "", name: p.name, series: "", isin: null, kind: "page" as const, href: p.href }));
}

/**
 * Search across every equity listed on NSE (~2,600 companies) and the unlisted / pre-IPO directory.
 *
 * Queries are debounced and in-flight requests are aborted when superseded, so
 * a fast typist cannot have an older response overwrite a newer one.
 */
export function UniversalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as { results: SearchHit[]; error?: string };
        setResults(body.results ?? []);
        setError(body.error ?? null);
      } catch (err) {
        // An aborted request was superseded; that is not an error state
        if ((err as Error)?.name !== "AbortError") {
          setError("Search failed. Is the data service running?");
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [trimmed]);

  // Tools first: a few words of a page name should never be outranked by a ticker that happens to contain them
  const hits = useMemo(() => [...matchPages(trimmed), ...results], [trimmed, results]);

  useEffect(() => setActiveIndex(0), [hits]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const commit = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQuery("");
      router.push(hit.href);
    },
    [router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!hits.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(hits[activeIndex]);
    }
  }

  const showPanel = open && trimmed.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative transition-[width] duration-300 ease-out",
        open ? "w-full md:w-[22rem]" : "w-full md:w-44 2xl:w-64",
        // Between lg and xl the nav leaves no room, so the box collapses to an icon
        // that opens as an overlay instead of pushing the nav around.
        "lg:max-xl:h-9 lg:max-xl:!w-10",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-surface-muted px-2.5 transition-[width,colors] duration-300",
          "lg:max-xl:absolute lg:max-xl:overflow-hidden lg:max-xl:right-0 lg:max-xl:top-0 lg:max-xl:z-50 lg:max-xl:cursor-text",
          open ? "border-accent/60 shadow-sm shadow-accent/10 lg:max-xl:!w-80" : "border-border lg:max-xl:!w-10",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
        ) : (
          <Search className={cn("h-3.5 w-3.5 shrink-0", open ? "text-accent" : "text-muted-foreground")} />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search companies or tools…"
          aria-label="Search companies or tools"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="universal-search-results"
          aria-autocomplete="list"
          className={cn(
            "h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70",
            !open && "lg:max-xl:w-0 lg:max-xl:min-w-0",
          )}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 lg:max-xl:hidden rounded border border-border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {showPanel ? (
          <motion.div
            id="universal-search-results"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 lg:max-xl:left-auto lg:max-xl:w-80 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-xl"
          >
            {error ? (
              <p className="px-3 py-4 text-2xs text-down">{error}</p>
            ) : hits.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {loading ? "Searching…" : `No company or tool matches “${trimmed}”.`}
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {hits.map((hit, index) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => commit(hit)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                        index === activeIndex ? "bg-surface-muted" : "hover:bg-surface-muted",
                      )}
                    >
                      {hit.kind === "page" ? (
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-gold" />
                      ) : hit.kind === "unlisted" ? (
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-flat" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-accent" />
                      )}
                      <span className="min-w-0 flex-1">
                        {hit.kind === "page" ? (
                          <span className="block truncate text-sm font-medium">{hit.name}</span>
                        ) : hit.kind === "unlisted" ? (
                          <>
                            <span className="block truncate text-sm font-medium">{hit.name}</span>
                            <span className="block truncate text-2xs text-muted-foreground">{hit.series}</span>
                          </>
                        ) : (
                          <>
                            <span className="block font-mono text-xs font-semibold">{hit.symbol}</span>
                            <span className="block truncate text-2xs text-muted-foreground">{hit.name}</span>
                          </>
                        )}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide",
                          hit.kind === "unlisted" ? "border-flat/40 bg-flat/10 text-flat" : "border-border text-muted-foreground",
                        )}
                      >
                        {hit.kind === "page" ? "Go to" : hit.kind === "unlisted" ? "Unlisted" : hit.series || "NSE"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
