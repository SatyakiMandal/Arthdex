"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiDecisions, Decision } from "@/lib/api/types";

const pct = (v: number | null | undefined, signed = true) => (v == null ? "—" : `${signed && v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null | undefined) => (v == null ? "text-muted-foreground" : v >= 0 ? "text-up" : "text-down");

export function TrackRecord() {
  const [data, setData] = useState<ApiDecisions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/decisions", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the track record.");
      setData(body as ApiDecisions);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the track record.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (d: Decision) => {
    const res = await fetch(`/api/decisions/${d.id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  if (loading && !data) {
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-down">
        {error}
      </p>
    );
  }
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
        <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold">No calls logged yet</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Open any company&apos;s Technicals tab and press <strong>Log this call</strong>. It records today&apos;s indicator call and price, then scores it against Nifty after 1, 5 and 20 trading days.
        </p>
        <Link href="/market-watch" className="btn-ghost mt-5 inline-flex px-4">
          Browse market watch
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {data.horizons.map((h) => {
          const s = data.summary[String(h)];
          return (
            <div key={h} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-2xs uppercase tracking-wider text-muted-foreground">After {h} trading day{h > 1 ? "s" : ""}</p>
              <p className="mt-1 font-mono text-xl font-semibold">{s.hitRatePct == null ? "—" : `${s.hitRatePct}% hit`}</p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {s.scored} scored · vs Nifty <span className={cn("font-mono", tone(s.avgExcessPct))}>{pct(s.avgExcessPct)}</span> on average
              </p>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="data-table w-full min-w-[720px] text-sm">
            <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Call</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Risk</th>
                {data.horizons.map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-medium">
                    {h}D · vs Nifty
                  </th>
                ))}
                <th className="w-px px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/company/${d.symbol}/technicals`} className="font-mono font-semibold hover:text-accent">
                      {d.symbol}
                    </Link>{" "}
                    <span className={cn("ml-1 text-xs font-medium", d.call === "Bullish" ? "text-up" : d.call === "Bearish" ? "text-down" : "text-muted-foreground")}>{d.call}</span>
                    <p className="font-mono text-2xs text-muted-foreground">
                      {d.asOf} · {d.bullish}↑ {d.bearish}↓ {d.neutral}–
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{d.price.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{d.riskTier ?? "—"}</td>
                  {data.horizons.map((h) => {
                    const r = d.results[String(h)];
                    return (
                      <td key={h} className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {r == null ? (
                          <span className="text-muted-foreground">pending</span>
                        ) : (
                          <>
                            <span className={tone(r.returnPct)}>{pct(r.returnPct)}</span>
                            <p className="text-2xs text-muted-foreground">
                              {r.excessPct == null ? "" : `${pct(r.excessPct)} `}
                              {r.hit == null ? "" : r.hit ? "✓" : "✗"}
                            </p>
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <button type="button" aria-label={`Delete ${d.symbol} call`} title="Delete" onClick={() => remove(d)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-down/10 hover:text-down">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">{data.note}</p>
      </section>
    </div>
  );
}
