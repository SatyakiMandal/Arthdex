"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WatchKind } from "@/lib/client/watchlist";

export interface PickedCompany {
  kind: WatchKind;
  /** NSE symbol or unlisted directory id. */
  id: string;
  name: string;
}

interface Hit {
  id: string;
  symbol: string;
  name: string;
  kind: WatchKind;
}

/** Autocomplete over listed and unlisted companies that reports the chosen one to its parent. */
export function CompanyPicker({
  value,
  onPick,
  label = "Company",
  id = "company-picker",
}: {
  value: PickedCompany | null;
  onPick: (company: PickedCompany | null) => void;
  label?: string;
  id?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => setQuery(value?.name ?? ""), [value]);

  useEffect(() => {
    const q = query.trim();
    if (value || q.length < 2) {
      setHits([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { results?: Hit[] };
        if (mine === seq.current) {
          setHits(body.results ?? []);
          setActive(0);
        }
      } catch {
        if (mine === seq.current) setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, value]);

  function choose(h: Hit) {
    onPick({ kind: h.kind, id: h.kind === "listed" ? h.symbol : h.id, name: h.name });
    setOpen(false);
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls={`${id}-list`}
          autoComplete="off"
          value={query}
          placeholder="Search a listed or unlisted company"
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onPick(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % hits.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + hits.length) % hits.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(hits[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
        />
      </div>
      {open && hits.length > 0 ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-surface-raised p-1 shadow-lg"
        >
          {hits.map((h, i) => (
            <li
              key={`${h.kind}-${h.id}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(h);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm", i === active && "bg-surface-muted")}
            >
              <span className="truncate">{h.name}</span>
              {h.kind === "unlisted" ? (
                <span className="shrink-0 rounded border border-flat/40 bg-flat/10 px-1.5 py-0.5 font-mono text-2xs uppercase text-flat">Unlisted</span>
              ) : (
                <span className="shrink-0 font-mono text-2xs text-muted-foreground">{h.symbol}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
