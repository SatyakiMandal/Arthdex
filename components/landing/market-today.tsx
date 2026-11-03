import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { IndexChart } from "./index-chart";
import { Reveal } from "./motion";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getCandles, getFlows, getMovers, getOptionChain, getPulse } from "@/lib/api/endpoints";
import type { ApiMover } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

const crore = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatINR(Math.abs(v), 0)}`;

/** One column of the dashboard row: a heading rule, a title, a link out, and dense rows. */
function Column({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 border-t border-foreground/80 pt-3">
        <h3 className="font-sans text-[15px] font-semibold tracking-normal">{title}</h3>
        <Link href={href} className="text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-gold">
          {linkLabel}
        </Link>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Movers({ rows }: { rows: ApiMover[] }) {
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((r) => (
        <li key={r.symbol}>
          <Link href={`/company/${r.symbol}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm hover:bg-surface-muted">
            <span className="font-mono text-xs font-semibold">{r.symbol}</span>
            <span className="flex items-baseline gap-3">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatINR(r.cmp)}</span>
              <span className={cn("w-14 text-right font-mono text-xs font-semibold tabular-nums", deltaColor(r.change.percent))}>
                {formatPct(r.change.percent, 1)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Pairs({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-border/60">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-mono text-xs tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The market in one band: Nifty's year beside the sector board, then a dense row with
 * the day's biggest movers, institutional flows and what index options are pricing in.
 */
export async function MarketToday() {
  const [nifty, pulse, gainers, losers, flows, chain] = await Promise.all([
    getCandles("^NSEI", "1Y"),
    getPulse(),
    getMovers("gainers", "gt20", 6),
    getMovers("losers", "gt20", 6),
    getFlows(30),
    getOptionChain("NIFTY"),
  ]);
  const sectors = pulse.ok ? pulse.data.sectors.filter((s) => s.count >= 1).slice(0, 12) : [];
  const scale = Math.max(1, ...sectors.map((s) => Math.abs(s.changePct)));
  const f = flows?.data;
  const o = chain?.data;

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:py-10">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-balance text-3xl sm:text-4xl">Market today</h2>
        <Link href="/market-watch" className="inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline">
          Full market watch
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Reveal>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <Reveal className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-7">
          {nifty.ok ? (
            <IndexChart candles={nifty.data.candles} label="Nifty 50" />
          ) : (
            <div className="p-4">
              <DataUnavailable title="Index chart unavailable" message={nifty.message} />
            </div>
          )}
        </Reveal>

        <Reveal delay={0.08} className="flex flex-col rounded-xl border border-border bg-surface lg:col-span-5">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium">Sectors today</h3>
            <p className="text-xs text-muted-foreground">Nifty 50, weighted by market cap</p>
          </div>
          {sectors.length ? (
            <ul className="flex-1 divide-y divide-border/60 px-4 py-1">
              {sectors.map((s) => {
                const width = `${(Math.abs(s.changePct) / scale) * 50}%`;
                const up = s.changePct >= 0;
                return (
                  <li key={s.industry} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 py-[7px] text-sm">
                    <span className="truncate text-foreground/85">{s.industry}</span>
                    <span className="relative h-2" aria-hidden>
                      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border" />
                      <span className={cn("absolute inset-y-0 rounded-sm", up ? "left-1/2 bg-up/70" : "right-1/2 bg-down/70")} style={{ width }} />
                    </span>
                    <span className={cn("text-right font-mono text-xs tabular-nums", up ? "text-up" : "text-down")}>{formatPct(s.changePct, 2)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4">
              <DataUnavailable title="Sector moves unavailable" message={pulse.ok ? "No sector data." : pulse.message} />
            </div>
          )}
        </Reveal>
      </div>

      <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
        <Column title="Top gainers" href="/market-watch" linkLabel="Above ₹20">
          {gainers.ok ? <Movers rows={gainers.data.slice(0, 6)} /> : <p className="text-sm text-muted-foreground">{gainers.message}</p>}
        </Column>
        <Column title="Top losers" href="/market-watch" linkLabel="Above ₹20">
          {losers.ok ? <Movers rows={losers.data.slice(0, 6)} /> : <p className="text-sm text-muted-foreground">{losers.message}</p>}
        </Column>
        <Column title="Institutional flows" href="/market-watch#flows" linkLabel="₹ crore">
          {f ? (
            <Pairs
              rows={[
                ["Foreign, today", <span key="fii" className={deltaColor(f.latest.allExchanges.fii.net ?? 0)}>{crore(f.latest.allExchanges.fii.net)}</span>],
                ["Domestic, today", <span key="dii" className={deltaColor(f.latest.allExchanges.dii.net ?? 0)}>{crore(f.latest.allExchanges.dii.net)}</span>],
                ["Foreign, this month", <span key="fm" className={deltaColor(f.totals.fiiMonth)}>{crore(f.totals.fiiMonth)}</span>],
                ["Domestic, this month", <span key="dm" className={deltaColor(f.totals.diiMonth)}>{crore(f.totals.diiMonth)}</span>],
                [
                  "NSDL FPI report",
                  f.latestNsdl ? <span key="nsdl" className={deltaColor(f.latestNsdl.equity.total.net ?? 0)}>{crore(f.latestNsdl.equity.total.net)}</span> : "—",
                ],
                ["Trade date", new Date(`${f.latest.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })],
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Flows have not loaded.</p>
          )}
        </Column>
        <Column title="Nifty options" href="/derivatives" linkLabel="Option chain">
          {o ? (
            <Pairs
              rows={[
                ["Expiry", `${new Date(`${o.expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${o.daysToExpiry} days`],
                ["Put-call ratio", o.pcr?.toFixed(2) ?? "—"],
                ["Max pain", formatINR(o.maxPain ?? 0, 0)],
                ["At-the-money IV", o.atmIv != null ? `${o.atmIv.toFixed(1)}%` : "—"],
                ["Move priced in", o.impliedMove ? `±${o.impliedMove.pct.toFixed(2)}%` : "—"],
                ["Call wall / put wall", `${formatINR(o.resistance[0]?.strike ?? 0, 0)} / ${formatINR(o.support[0]?.strike ?? 0, 0)}`],
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">The option chain has not loaded.</p>
          )}
        </Column>
      </div>
    </section>
  );
}
