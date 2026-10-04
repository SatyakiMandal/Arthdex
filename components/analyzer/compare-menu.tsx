"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Columns2, Loader2, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzerRun } from "@/types/analyzer";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm transition-all hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50";

interface Candidate {
  key: string;
  name: string;
  sub: string;
  /** A finished analysis of this company, if one exists. */
  runId: string | null;
  ticker: string | null;
  url: string | null;
}

interface PeerSuggestion {
  kind: "listed" | "unlisted";
  name: string;
  ticker: string | null;
  url: string | null;
  reason: string;
  runId: string | null;
}

interface SearchHit {
  kind: "listed" | "unlisted";
  name: string;
  ticker: string | null;
  symbol: string | null;
  url: string | null;
  sector: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(limited|ltd|private|pvt|company|the)\b/g, "").trim();

/**
 * Pick a company to compare the open analysis with.
 *
 * Suggestions are the company's sector peers; typing searches every listed and unlisted company.
 * A company that already has a finished analysis opens the comparison at once; any other starts a
 * new analysis over the same window and opens the comparison, which waits for it to finish.
 */
export function CompareMenu({ run }: { run: AnalyzerRun }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [peers, setPeers] = useState<PeerSuggestion[] | null>(null);
  const [sector, setSector] = useState<string | null>(null);
  const [peersReady, setPeersReady] = useState(true);
  const [runs, setRuns] = useState<AnalyzerRun[] | null>(null);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!open || runs) return;
    fetch("/api/analyzer/runs?limit=100")
      .then((r) => r.json())
      .then((b: { runs: AnalyzerRun[] }) => setRuns(b.runs))
      .catch(() => setRuns([]));
    fetch(`/api/analyzer/runs/${run.id}/peers`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b: { suggestions: PeerSuggestion[]; sector: string | null; ready?: boolean }) => {
        setPeers(b.suggestions);
        setSector(b.sector);
        setPeersReady(b.ready !== false);
      })
      .catch(() => setPeers([]));
  }, [open, runs, run.id]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Search every company, debounced, ignoring superseded responses
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/analyzer/search?q=${encodeURIComponent(q)}&kind=${run.kind}`);
        const body = (await res.json()) as { results: SearchHit[] };
        if (mine === seq.current) setHits(body.results ?? []);
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query, run.kind]);

  // One entry per company (the newest finished run), never the company being compared with itself
  const finished = useMemo(() => {
    const seen = new Set<string>([norm(run.company)]);
    const out: AnalyzerRun[] = [];
    for (const r of runs ?? []) {
      if (r.id === run.id || r.status !== "COMPLETED" || r.kind !== run.kind) continue;
      const key = norm(r.company);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }, [runs, run]);

  // The newest finished run for each company, found by ticker (listed) or name (unlisted)
  const runFor = (c: { ticker: string | null; name: string }) =>
    finished.find((r) => (run.kind === "listed" ? !!c.ticker && (r.ticker ?? "").toUpperCase() === c.ticker.toUpperCase() : norm(r.company) === norm(c.name)))?.id ?? null;

  const suggested: Candidate[] = (peers ?? []).map((p) => ({
    key: `p-${p.ticker ?? p.name}`,
    name: p.name,
    sub: p.reason,
    runId: p.runId ?? runFor(p),
    ticker: p.ticker,
    url: p.url,
  }));
  const suggestedKeys = new Set(suggested.map((s) => norm(s.name)));

  const others: Candidate[] = finished
    .filter((r) => !suggestedKeys.has(norm(r.company)))
    .map((r) => ({ key: `r-${r.id}`, name: r.company, sub: `Analysed ${r.start} to ${r.end}`, runId: r.id, ticker: r.ticker, url: null }));

  const q = query.trim().toLowerCase();
  const searchResults: Candidate[] = hits
    .filter((h) => (h.ticker ?? "") !== (run.ticker ?? "\u0000") && norm(h.name) !== norm(run.company))
    .map((h) => ({
      key: `s-${h.ticker ?? h.url ?? h.name}`,
      name: h.name,
      sub: h.kind === "listed" ? (h.symbol ?? "Listed") : (h.sector ?? "Unlisted"),
      runId: runFor({ ticker: h.ticker, name: h.name }),
      ticker: h.ticker,
      url: h.url,
    }));
  const analysedMatches = q.length >= 2 ? finished.filter((r) => r.company.toLowerCase().includes(q)).map((r): Candidate => ({ key: `r-${r.id}`, name: r.company, sub: `Analysed ${r.start} to ${r.end}`, runId: r.id, ticker: r.ticker, url: null })) : [];
  const shownSearch = [...analysedMatches, ...searchResults.filter((s) => !analysedMatches.some((m) => norm(m.name) === norm(s.name)))];

  async function choose(c: Candidate) {
    setError(null);
    if (c.runId) {
      router.push(`/analyzer/compare?a=${run.id}&b=${c.runId}`);
      return;
    }
    if (!run.start || !run.end) return setError("This analysis has no window to reuse.");
    setBusy(c.key);
    try {
      const body =
        run.kind === "listed"
          ? { kind: "listed", company: c.name, ticker: c.ticker, start: run.start, end: run.end }
          : { kind: "unlisted", company: c.name, url: c.url ?? undefined, start: run.start, end: run.end };
      const res = await fetch("/api/analyzer/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(Array.isArray(json.detail) ? json.detail.map((d: { msg: string }) => d.msg).join("; ") : json.detail);
      router.push(`/analyzer/compare?a=${run.id}&b=${(json as AnalyzerRun).id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start that analysis.");
      setBusy(null);
    }
  }

  const loading = runs === null || peers === null;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className={BTN}>
        <Columns2 className="h-3.5 w-3.5" /> Compare
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        // Above the sticky dossier tabs (z-30) but below the site header (z-50)
        <div role="dialog" aria-label="Choose a company to compare with" className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-xl">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search any ${run.kind} company`}
                aria-label="Search for a company to compare with"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
              />
              {searching ? <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-accent" /> : null}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-1">
            {q.length >= 2 ? (
              <Group title={`Results for "${query.trim()}"`} items={shownSearch} busy={busy} onPick={choose} empty={searching ? "Searching…" : "No company matches that search."} />
            ) : loading ? (
              <p className="px-3 py-4 text-2xs text-muted-foreground">Loading suggestions…</p>
            ) : (
              <>
                <Group
                  title={sector ? `Suggested peers · ${sector}` : "Suggested peers"}
                  items={suggested}
                  busy={busy}
                  onPick={choose}
                  empty={peersReady ? "No peers were found for this company. Search for one above." : "The unlisted directory is still loading, so peers are not available yet. Search for a company above, or try again in a minute."}
                />
                {others.length > 0 ? <Group title="Your other analyses" items={others} busy={busy} onPick={choose} /> : null}
              </>
            )}
          </div>

          {error ? (
            <p role="alert" className="border-t border-border bg-down/10 px-3 py-2 text-2xs text-down">
              {error}
            </p>
          ) : null}
          <p className="border-t border-border px-3 py-2 text-2xs text-muted-foreground">
            A company with no analysis yet is analysed over the same window first, which takes several minutes.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Group({
  title,
  items,
  busy,
  onPick,
  empty,
}: {
  title: string;
  items: Candidate[];
  busy: string | null;
  onPick: (c: Candidate) => void;
  empty?: string;
}) {
  return (
    <div className="pb-1">
      <p className="px-3 pb-1 pt-2 text-2xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        empty ? <p className="px-3 py-2 text-2xs text-muted-foreground">{empty}</p> : null
      ) : (
        items.map((c) => (
          <button
            key={c.key}
            type="button"
            disabled={busy !== null}
            onClick={() => onPick(c)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-muted disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm">{c.name}</span>
              <span className="block truncate text-2xs text-muted-foreground">{c.sub}</span>
            </span>
            {busy === c.key ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
            ) : c.runId ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-2xs text-up">
                <CheckCircle2 className="h-3 w-3" /> Analysed
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">
                <Play className="h-3 w-3" /> Analyse
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
