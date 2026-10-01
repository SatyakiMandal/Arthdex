"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchHit {
  id: string;
  symbol: string;
  name: string;
  series: string;
  isin: string | null;
  href: string;
}

/**
 * Search across every equity listed on NSE (~2,600 companies).
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

  useEffect(() => setActiveIndex(0), [results]);

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
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit(results[activeIndex]);
    }
  }

  const showPanel = open && trimmed.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative transition-[width] duration-300 ease-out",
        open ? "w-full md:w-[22rem]" : "w-full md:w-52 2xl:w-64",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border bg-surface-muted px-2.5 transition-colors",
          open ? "border-accent/60 shadow-sm shadow-accent/10" : "border-border",
        )}
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
          placeholder="Search any listed company…"
          aria-label="Search companies"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="universal-search-results"
          aria-autocomplete="list"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
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
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline">
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
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-xl"
          >
            {error ? (
              <p className="px-3 py-4 text-2xs text-down">{error}</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {loading ? "Searching…" : `No listed company matches “${trimmed}”.`}
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((hit, index) => (
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
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs font-semibold">{hit.symbol}</span>
                        <span className="block truncate text-2xs text-muted-foreground">{hit.name}</span>
                      </span>
                      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                        {hit.series || "NSE"}
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
