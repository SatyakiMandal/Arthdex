import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StatusRefresh } from "@/components/layout/status-refresh";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getFeedHealth, getStatus } from "@/lib/api/endpoints";
import type { FeedHealth } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Data Status · Arthdex",
  description: "How fresh each Arthdex data feed is, and what the feed watchdog last found and repaired.",
};

const STATE = {
  fresh: { label: "Fresh", dot: "bg-up", text: "text-up" },
  stale: { label: "Stale", dot: "bg-flat", text: "text-flat" },
  idle: { label: "Not requested yet", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
} as const;

function age(seconds: number | null): string {
  if (seconds === null) return "never";
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m ago`;
  return `${(seconds / 3600).toFixed(1)}h ago`;
}

function uptime(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  if (seconds < 172_800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86_400).toFixed(1)} days`;
}

export default async function StatusPage() {
  const [result, health] = await Promise.all([getStatus(), getFeedHealth()]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[900px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow icon={Gauge}>Data status</Eyebrow>
            <h1 className="mt-3 text-balance text-3xl sm:text-4xl">
              Feed freshness
            </h1>
          </div>
          <StatusRefresh />
        </div>

        {!result.ok ? (
          <div className="mt-8">
            <DataUnavailable title="The data service is not reachable" message={result.message} />
          </div>
        ) : (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-up" aria-hidden />
                Data service running
              </span>
              <span className="font-mono text-2xs">up for {uptime(result.data.uptimeSeconds)}</span>
            </p>

            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
              <ul className="divide-y divide-border/60">
                {result.data.feeds.map((f) => {
                  const s = STATE[f.state];
                  return (
                    <li key={f.label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{f.label}</p>
                        <p className="text-2xs text-muted-foreground">{f.source}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("inline-flex items-center gap-2 text-sm font-medium", s.text)}>
                          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                          {s.label}
                        </p>
                        <p className="font-mono text-2xs text-muted-foreground">
                          {f.state === "idle" ? "no cached data" : `last refreshed ${age(f.ageSeconds)} · refreshes every ${age(f.ttlSeconds).replace(" ago", "")}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-4 text-2xs text-muted-foreground">
              {result.meta.note} A stale feed means the last refresh failed or is overdue, so the figure shown is older than normal.
              Each figure on the site also carries its own age.
            </p>

            {health.ok ? <Watchdog health={health.data} /> : null}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function when(iso: string | null | undefined): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

/** What the feed watchdog last probed, what it repaired, and anything it could not fix. */
function Watchdog({ health }: { health: FeedHealth }) {
  const open = Object.values(health.open ?? {});
  const s = health.summary;
  return (
    <section className="mt-12" aria-labelledby="watchdog">
      <h2 id="watchdog" className="text-xl">Feed watchdog</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {health.lastRun ? (
          <>
            Last run {when(health.lastRun)} IST.{" "}
            {s ? `${s.passing} of ${s.checked} feeds passing${s.repaired ? `, ${s.repaired} repaired automatically` : ""}.` : null}
          </>
        ) : (
          "No run recorded yet. The first runs about ninety seconds after the data service starts."
        )}
      </p>

      {open.length > 0 ? (
        <div className="mt-4 space-y-2">
          {open.map((i) => (
            <div key={i.feed} className={cn("rounded-lg border px-4 py-3", i.critical ? "border-down/30 bg-down/5" : "border-flat/30 bg-flat/5")}>
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{i.feed}</span>
                <span className="font-mono text-2xs text-muted-foreground">open since {when(i.firstSeen)}</span>
              </p>
              <p className="mt-1 text-sm">{i.problem}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.advice}</p>
            </div>
          ))}
        </div>
      ) : health.lastRun ? (
        <p className="mt-4 text-sm text-up">No open incidents.</p>
      ) : null}

      {health.results.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {health.results.map((r) => (
            <div key={r.feed} className="flex items-baseline justify-between gap-3 bg-surface px-4 py-2 text-sm">
              <span className={cn(!r.ok && "font-medium text-down")}>{r.feed}</span>
              <span className="font-mono text-2xs text-muted-foreground">
                {r.ok ? (r.repaired_by ? `repaired: ${r.repaired_by}` : `${r.seconds}s`) : r.kind}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
