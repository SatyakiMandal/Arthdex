"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BellPlus, LayoutGrid, List, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { ExportCsv } from "@/components/ui/export-csv";
import { fetchSnapshot, type Snapshot } from "@/lib/client/snapshot";
import { useWatchlist, type WatchItem } from "@/lib/client/watchlist";
import { cn, formatINR, formatPct } from "@/lib/utils";

const REFRESH_MS = 60_000;

const href = (i: WatchItem) => (i.kind === "listed" ? `/company/${i.id}` : `/unlisted/${i.id}`);
const money = (p: number) => `₹${formatINR(p, p < 100 ? 2 : 0)}`;

export function WatchlistView() {
  const { items, remove, ready } = useWatchlist();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const targets = useMemo(() => items.map((i) => ({ kind: i.kind, id: i.id })), [items]);
  const key = targets.map((t) => `${t.kind}:${t.id}`).join(",");

  const load = useCallback(async () => {
    if (targets.length === 0) return;
    setLoading(true);
    const result = await fetchSnapshot(targets);
    setFailed(result === null);
    if (result) {
      setSnap(result);
      setUpdated(new Date());
    }
    setLoading(false);
    // targets is derived from `key`, so depend on that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const rows = items.map((i) => {
    const listed = i.kind === "listed" ? snap?.listed.find((q) => q.id === i.id) : undefined;
    const unlisted = i.kind === "unlisted" ? snap?.unlisted.find((q) => q.id === i.id) : undefined;
    return { item: i, price: listed?.price ?? unlisted?.price ?? null, changePct: listed?.changePct ?? null };
  });

  if (!ready) return <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface" />;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
        <Star className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold">Nothing on your watchlist yet</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Open any listed or unlisted company and press Watch. It will appear here with its latest price, and you can set
          alerts on it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/market-watch" className="btn-ghost px-4">
            Browse market watch
          </Link>
          <Link href="/unlisted" className="btn-ghost px-4">
            Browse unlisted
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-mono text-2xs text-muted-foreground">
          {items.length} watched
          {updated ? ` · updated ${updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
          {" · refreshes every minute"}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-surface-muted p-0.5">
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              title="Grid view"
              className={cn("grid h-7 w-7 place-items-center rounded-md transition-colors", view === "grid" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              title="List view"
              className={cn("grid h-7 w-7 place-items-center rounded-md transition-colors", view === "list" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <ExportCsv
            filename="arthdex-watchlist"
            header={["Name", "Type", "Id", "Price", "Day change %"]}
            rows={rows.map((r) => [r.item.name, r.item.kind, r.item.id, r.price, r.changePct])}
          />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </header>

      {failed ? (
        <p role="alert" className="border-b border-border bg-down/[0.06] px-4 py-2 text-2xs text-down">
          Could not reach the data service, so prices below may be missing or out of date.
        </p>
      ) : null}
      {snap && !snap.unlistedReady && items.some((i) => i.kind === "unlisted") ? (
        <p className="border-b border-border px-4 py-2 text-2xs text-muted-foreground">
          Unlisted prices are still loading. They will appear on the next refresh.
        </p>
      ) : null}

      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map(({ item, price, changePct }) => (
            <div
              key={`${item.kind}:${item.id}`}
              className={cn(
                "group relative rounded-xl border p-3 transition-colors",
                changePct == null
                  ? "border-border bg-surface-muted"
                  : changePct >= 0
                    ? "border-up/25 bg-up/[0.06] hover:bg-up/[0.1]"
                    : "border-down/25 bg-down/[0.06] hover:bg-down/[0.1]",
              )}
            >
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                title="Remove"
                onClick={() => remove(item.kind, item.id)}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-down/10 hover:text-down group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <Link href={href(item)} className="block pr-6">
                <p className="truncate text-sm font-semibold leading-tight hover:text-accent">{item.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
                  {item.kind === "listed" ? (
                    <span>{item.id}</span>
                  ) : (
                    <span className="rounded border border-flat/40 bg-flat/10 px-1 text-flat">Unlisted</span>
                  )}
                </div>
              </Link>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="font-mono text-base font-semibold tabular-nums">
                  {price == null ? <span className="text-sm text-muted-foreground">{loading || !snap ? "…" : "n/a"}</span> : money(price)}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-2xs font-medium tabular-nums",
                    changePct == null ? "text-muted-foreground" : changePct >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down",
                  )}
                >
                  {changePct == null ? (item.kind === "unlisted" ? "revised" : "n/a") : formatPct(changePct, 2)}
                </span>
              </div>
              <Link
                href={`/alerts?kind=${item.kind}&target=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}`}
                aria-label={`Set an alert on ${item.name}`}
                title="Set an alert"
                className="mt-2 flex items-center gap-1 text-2xs text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
              >
                <BellPlus className="h-3 w-3" />
                Set alert
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
          <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left font-medium">Company</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Day</th>
              <th className="w-px px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, price, changePct }) => (
              <tr key={`${item.kind}:${item.id}`} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5">
                  <Link href={href(item)} className="font-medium hover:text-accent">
                    {item.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-2xs text-muted-foreground">
                    {item.kind === "listed" ? item.id : null}
                    {item.kind === "unlisted" ? (
                      <span className="rounded border border-flat/40 bg-flat/10 px-1.5 text-flat">Unlisted</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {price == null ? <span className="text-muted-foreground">{loading || !snap ? "…" : "n/a"}</span> : money(price)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-mono tabular-nums",
                    changePct == null ? "text-muted-foreground" : changePct >= 0 ? "text-up" : "text-down",
                  )}
                >
                  {changePct == null ? (item.kind === "unlisted" ? "revised, not daily" : "n/a") : formatPct(changePct, 2)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/alerts?kind=${item.kind}&target=${encodeURIComponent(item.id)}&name=${encodeURIComponent(item.name)}`}
                      aria-label={`Set an alert on ${item.name}`}
                      title="Set an alert"
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-accent"
                    >
                      <BellPlus className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      title="Remove"
                      onClick={() => remove(item.kind, item.id)}
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-down/10 hover:text-down"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
        Your watchlist is saved in this browser only. Listed prices are about 15 minutes delayed; unlisted prices are
        indicative dealer levels.
      </p>
    </section>
  );
}
