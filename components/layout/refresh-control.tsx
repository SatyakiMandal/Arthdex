"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { refreshData } from "@/app/actions/refresh";
import { cn } from "@/lib/utils";

interface Stamp {
  /** When the data on screen was fetched upstream, epoch ms. */
  at: number;
  source: string;
}

// A tiny external store: pages register the freshness of their data, the floating control reads it.
let current: Stamp | null = null;
const listeners = new Set<() => void>();
const publish = (s: Stamp | null) => {
  current = s;
  listeners.forEach((l) => l());
};

/** Place on a page with the response meta of its main data; the floating control shows how old it is. */
export function PageStamp({ meta }: { meta: { fetchedAt: string; cacheAgeSeconds: number; source: string } }) {
  const at = Date.parse(meta.fetchedAt) - meta.cacheAgeSeconds * 1000;
  useEffect(() => {
    if (Number.isNaN(at)) return;
    publish({ at, source: meta.source });
    return () => publish(null);
  }, [at, meta.source]);
  return null;
}

/** Which backend cache entries belong to the page the user is on. */
function scopeFor(path: string): { prefixes: string[]; symbol: string | null } {
  const company = path.match(/^\/company\/([^/]+)/);
  if (company) return { prefixes: [], symbol: decodeURIComponent(company[1]).toUpperCase() };
  if (path.startsWith("/market-watch") || path === "/") return { prefixes: ["market:", "screener:factor"], symbol: null };
  if (path.startsWith("/commodities")) return { prefixes: ["market:commodities"], symbol: null };
  if (path.startsWith("/news")) return { prefixes: ["news:"], symbol: null };
  if (path.startsWith("/ipo")) return { prefixes: ["ipo:"], symbol: null };
  if (path.startsWith("/bhavcopy")) return { prefixes: ["bhav"], symbol: null };
  if (path.startsWith("/screener")) return { prefixes: ["screener:"], symbol: null };
  return { prefixes: [], symbol: null };
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function RefreshControl() {
  const pathname = usePathname();
  const router = useRouter();
  const stamp = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLoadedAt(Date.now());
    setNow(Date.now());
  }, [pathname]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(() => {
    const { prefixes, symbol } = scopeFor(pathname);
    start(async () => {
      await refreshData(pathname, prefixes, symbol);
      router.refresh();
      setLoadedAt(Date.now());
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }, [pathname, router]);

  if (pathname.startsWith("/analyzer") || !loadedAt) return null;

  const at = stamp?.at ?? loadedAt;
  const label = stamp ? `Data ${ago(now - at)}` : `Loaded ${new Date(loadedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  const title = stamp ? `${stamp.source} · fetched ${new Date(at).toLocaleString("en-IN")}` : "When this page was loaded";

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        title={`${title}. Click to fetch fresh data.`}
        aria-label="Refresh data on this page"
        className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 py-1.5 pl-3 pr-2 text-2xs text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-80"
      >
        <span suppressHydrationWarning className="font-mono">{pending ? "Refreshing…" : done ? "Updated just now" : label}</span>
        <span className={cn("grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent", done && "bg-up/15 text-up")}>
          {done ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />}
        </span>
      </button>
    </div>
  );
}
