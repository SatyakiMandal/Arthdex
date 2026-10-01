import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Sunrise } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CopyText } from "@/components/ui/copy-text";
import { DataUnavailable } from "@/components/ui/data-provenance";
import {
  getCalendar,
  getDeals,
  getGlobalIndices,
  getIndices,
  getIpoPipeline,
  getMoversExplained,
  getNews,
} from "@/lib/api/endpoints";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Morning Briefing · Arthdex",
  description: "Indices, global cues, movers and what explains them, deals, results and IPOs in one page.",
};

const KEY_INDICES = ["nifty-50", "nifty-bank", "nifty-it", "nifty-midcap-100", "india-vix"];

function Block({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid overflow-hidden rounded-2xl border border-border bg-surface print:border-neutral-300">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline print:hidden">
            Open <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

const inr = (n: number) => formatINR(n, n < 100 ? 2 : 0);

export default async function BriefingPage() {
  const [indices, global, up, down, deals, calendar, ipo, filings] = await Promise.all([
    getIndices(),
    getGlobalIndices(),
    getMoversExplained("gainers", 5),
    getMoversExplained("losers", 5),
    getDeals(),
    getCalendar(),
    getIpoPipeline(),
    getNews({ kind: "filing", limit: 40 }),
  ]);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const keyIndices = indices.ok ? indices.data.filter((i) => KEY_INDICES.includes(i.id)) : [];
  const nifty = indices.ok ? indices.data.find((i) => i.id === "nifty-50") : undefined;
  const breadth = indices.ok
    ? indices.data.reduce((a, i) => ({ adv: a.adv + (i.advances || 0), dec: a.dec + (i.declines || 0) }), { adv: 0, dec: 0 })
    : null;
  const globalUp = global.ok ? global.data.filter((g) => g.changePct > 0).length : 0;

  const results = calendar.ok
    ? calendar.data.meetings.filter((m) => m.isResults && m.date && m.date >= todayIso).slice(0, 8)
    : [];
  const bigDeals = deals.ok ? [...deals.data.bulk, ...deals.data.block].sort((a, b) => (b.valueCr ?? 0) - (a.valueCr ?? 0)).slice(0, 5) : [];
  const openIpos = ipo.ok ? ipo.data.issues.filter((i) => i.status === "ongoing" || i.status === "upcoming").slice(0, 5) : [];
  const importantFilings = filings.ok
    ? filings.data.items
        .filter((i) => i.flags.some((f) => ["earnings", "board-outcome", "order-win", "rating-action", "acquisition", "dividend"].includes(f)))
        .slice(0, 6)
    : [];

  const headline = nifty
    ? `Nifty 50 at ${formatINR(nifty.level, 2)} (${formatPct(nifty.change.percent)})${
        breadth && breadth.adv + breadth.dec > 0 ? `, ${breadth.adv} advancing against ${breadth.dec} declining across index constituents` : ""
      }${global.ok ? `. ${globalUp} of ${global.data.length} global indices are up.` : "."}`
    : "Live index data is not available right now.";

  // Plain-text twin of the page, for pasting into a message or email
  const lines: string[] = [`ARTHDEX MORNING BRIEFING, ${dateLabel}`, "", headline, ""];
  if (keyIndices.length) {
    lines.push("INDICES", ...keyIndices.map((i) => `${i.name}: ${formatINR(i.level, 2)} (${formatPct(i.change.percent)})`), "");
  }
  if (global.ok) lines.push("GLOBAL CUES", ...global.data.map((g) => `${g.name}: ${formatINR(g.level, 2)} (${formatPct(g.changePct)})`), "");
  if (up.ok) lines.push("TOP GAINERS", ...up.data.map((m) => `${m.symbol} ${inr(m.cmp)} (${formatPct(m.changePct)})${m.labels.length ? ` [${m.labels.join(", ")}]` : ""}`), "");
  if (down.ok) lines.push("TOP LOSERS", ...down.data.map((m) => `${m.symbol} ${inr(m.cmp)} (${formatPct(m.changePct)})${m.labels.length ? ` [${m.labels.join(", ")}]` : ""}`), "");
  if (results.length) lines.push("RESULTS AHEAD", ...results.map((m) => `${m.date}: ${m.name} (${m.symbol})`), "");
  if (bigDeals.length) lines.push("LARGEST DEALS", ...bigDeals.map((d) => `${d.symbol} ${d.side} ${d.client}: Rs ${formatINR(d.valueCr ?? 0, 2)} Cr`), "");
  if (openIpos.length) lines.push("IPOS", ...openIpos.map((i) => `${i.name} (${i.status})`), "");
  lines.push("Source: Arthdex. Descriptive data, not investment advice.");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Sunrise}>Morning briefing</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{dateLabel}</h1>
            <p className="mt-3 text-pretty text-muted-foreground">{headline}</p>
          </div>
          <CopyText text={lines.join("\n")} />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 print:block print:space-y-3">
          <Block title="Indices" href="/market-watch">
            {indices.ok ? (
              <ul className="divide-y divide-border/60">
                {keyIndices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{i.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(i.level, 2)} <span className={cn("ml-2 text-xs", deltaColor(i.change.percent))}>{formatPct(i.change.percent)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <DataUnavailable message={indices.message} />
              </div>
            )}
          </Block>

          <Block title="Global cues" href="/">
            {global.ok ? (
              <ul className="divide-y divide-border/60">
                {global.data.map((g) => (
                  <li key={g.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{g.name}</span>
                    <span className="font-mono tabular-nums">
                      {formatINR(g.level, 2)} <span className={cn("ml-2 text-xs", deltaColor(g.changePct))}>{formatPct(g.changePct)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <DataUnavailable message={global.message} />
              </div>
            )}
          </Block>

          {([
            ["Top gainers and why", up],
            ["Top losers and why", down],
          ] as const).map(([title, res]) => (
            <Block key={title} title={title} href="/market-watch">
              {res.ok ? (
                <ul className="divide-y divide-border/60">
                  {res.data.map((m) => (
                    <li key={m.symbol} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link href={`/company/${m.symbol}`} className="font-mono font-semibold hover:text-accent">
                          {m.symbol}
                        </Link>
                        <span className="font-mono tabular-nums">
                          ₹{inr(m.cmp)} <span className={cn("ml-2 text-xs", deltaColor(m.changePct))}>{formatPct(m.changePct)}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
                        {m.news[0] ? m.news[0].headline : "No filing or headline names this stock today."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4">
                  <DataUnavailable message={res.message} />
                </div>
              )}
            </Block>
          ))}

          <Block title="Results ahead" href="/calendar">
            {results.length ? (
              <ul className="divide-y divide-border/60">
                {results.map((m) => (
                  <li key={`${m.symbol}-${m.date}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      <Link href={`/company/${m.symbol}`} className="font-mono text-xs font-semibold hover:text-accent">
                        {m.symbol}
                      </Link>
                      <span className="ml-2 text-2xs text-muted-foreground">{m.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">{m.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No results meetings are listed in the next few days.</p>
            )}
          </Block>

          <Block title="Largest deals" href="/deals">
            {bigDeals.length ? (
              <ul className="divide-y divide-border/60">
                {bigDeals.map((d, i) => (
                  <li key={`${d.symbol}-${i}`} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-semibold">
                        {d.symbol} <span className={d.side === "BUY" ? "text-up" : "text-down"}>{d.side}</span>
                      </span>
                      <span className="font-mono tabular-nums">₹{formatINR(d.valueCr ?? 0, 2)} Cr</span>
                    </div>
                    <p className="truncate text-2xs text-muted-foreground">{d.client}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No deals disclosed yet for the latest session.</p>
            )}
          </Block>

          <Block title="IPOs" href="/ipo">
            {openIpos.length ? (
              <ul className="divide-y divide-border/60">
                {openIpos.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 font-mono text-2xs capitalize text-muted-foreground">
                      {i.status}
                      {i.priceBandHigh ? ` · ₹${i.priceBandHigh}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No open or upcoming issues right now.</p>
            )}
          </Block>

          <Block title="Filings that matter" href="/news">
            {importantFilings.length ? (
              <ul className="divide-y divide-border/60">
                {importantFilings.map((n) => (
                  <li key={n.id} className="px-4 py-2.5 text-sm">
                    <p className="line-clamp-2">{n.headline}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No results or board outcomes filed recently.</p>
            )}
          </Block>
        </div>

        <p className="mt-6 text-2xs text-muted-foreground">
          Built from the same live feeds as the rest of Arthdex when you open it. Descriptive data, not investment advice. Email
          delivery needs the site to run around the clock, so for now copy or print the briefing.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
