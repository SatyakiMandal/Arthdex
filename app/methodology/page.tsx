import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenCheck, CircleSlash, Database, Sigma } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Reveal } from "@/components/landing/motion";

export const metadata: Metadata = {
  title: "Methodology · Arthdex",
  description: "Where every figure comes from, how the models are computed, and what Arthdex deliberately does not claim.",
};

const SOURCES = [
  { area: "Index levels, movers, filings, IPO desk, deals, calendar", source: "NSE public JSON", delay: "About 1 minute" },
  { area: "Stock quotes, candles, fundamentals, global indices", source: "Yahoo Finance", delay: "About 15 minutes" },
  { area: "News and press coverage", source: "Indian financial press RSS feeds and NSE announcements", delay: "As published" },
  { area: "Delivery data and Bhavcopy", source: "NSE end-of-day files", delay: "Previous session" },
  { area: "Unlisted and pre-IPO prices", source: "UnlistedZone indicative prices", delay: "Revised by the source a few times a month" },
  { area: "Commodities", source: "Front-month futures in US dollars", delay: "About 15 minutes" },
];

const MODELS = [
  {
    title: "Event impact",
    body: "Each stock's return is regressed on its benchmark over a clean estimation window. The leftover, the abnormal return, is the part of a day's move the market does not explain. Days with both an unusual abnormal return and unusual news coverage are flagged. A day with no flag is not proof of no impact.",
  },
  {
    title: "Volatility and risk",
    body: "Several volatility models (GARCH family, HAR-RV and others) are fitted on real return series and compared out of sample. Value at Risk, a distance-to-default estimate and a market regime read are derived from them. Fits can be weak, and the page says so when R squared is low.",
  },
  {
    title: "Valuation and technicals",
    body: "Valuation compares a company's multiples with its sector. Technical readings (MACD, RSI, ADX, moving averages) are standard indicators computed from price history, shown as a composite from minus 100 to plus 100.",
  },
  {
    title: "Movers explained",
    body: "A filing or headline that names a stock is shown beside its move as a candidate explanation. It is a time and name match, not a proven cause. A move with no match may come from trading flow, its sector or news not yet indexed.",
  },
];

const NOT_CLAIMED = [
  "Buy, sell or hold calls, or price targets we would stand behind. Where the analyzer shows targets, they come from stated, visible inputs.",
  "Exchange prices for unlisted shares. They are indicative dealer levels, illiquid and settled off-exchange.",
  "Grey-market premiums and DRHP-stage IPO data. No exchange or free feed publishes them.",
  "Tick-level measures such as Kyle's lambda or VPIN. They need order-flow data we do not have.",
  "Notifications when the site is closed. Alerts run in your browser while Arthdex is open.",
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[900px] px-4 py-12 sm:px-6">
        <Reveal>
          <Eyebrow icon={BookOpenCheck}>Methodology</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            How the numbers are made
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every figure on Arthdex carries its source and its age. If a feed fails, the page says so instead of filling the gap
            with an estimate. The live health of each feed is on the{" "}
            <Link href="/status" className="text-accent hover:underline">
              data status page
            </Link>
            .
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="h-5 w-5 text-accent" /> Data sources
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border bg-surface-muted/40">
                  <th className="px-4 py-2.5 text-left font-medium">Area</th>
                  <th className="px-4 py-2.5 text-left font-medium">Source</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((s) => (
                  <tr key={s.area} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-4 py-3">{s.area}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.source}
                      <span className="block text-2xs sm:hidden">{s.delay}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{s.delay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Sigma className="h-5 w-5 text-accent" /> How the analysis works
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {MODELS.map((m) => (
              <div key={m.title} className="rounded-2xl border border-border bg-surface p-5">
                <dt className="text-sm font-semibold tracking-tight">{m.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal className="mt-12">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <CircleSlash className="h-5 w-5 text-accent" /> What Arthdex does not claim
          </h2>
          <ul className="mt-4 space-y-2.5">
            {NOT_CLAIMED.map((t) => (
              <li key={t} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-2xs text-muted-foreground">
            Everything here is descriptive data for research. It is not investment advice, and past behaviour does not predict
            future returns.
          </p>
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
