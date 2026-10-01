import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Rocket, TrendingUp } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { WatchButton } from "@/components/watchlist/watch-button";
import { PriceHistoryChart } from "@/components/unlisted/price-history-chart";
import { getUnlistedCompany } from "@/lib/api/endpoints";
import { cn, formatINR, formatPct } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getUnlistedCompany(id);
  if (!result.ok) return { title: "Unlisted company · Arthdex" };
  return {
    title: `${result.data.name} · Unlisted | Arthdex`,
    description: `Indicative price, price history and key ratios for ${result.data.name}.`,
  };
}

const money = (p: number) => `₹${formatINR(p, p < 100 ? 2 : 0)}`;

export default async function UnlistedCompanyPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getUnlistedCompany(id);

  if (!result.ok && result.status === 404) notFound();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <Link
          href="/unlisted"
          className="group inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          All unlisted companies
        </Link>

        {!result.ok ? (
          <div className="mt-6">
            <DataUnavailable title="Company data unavailable" message={result.message} />
          </div>
        ) : (
          <Profile c={result.data} meta={result.meta} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Profile({
  c,
  meta,
}: {
  c: Extract<Awaited<ReturnType<typeof getUnlistedCompany>>, { ok: true }>["data"];
  meta: Extract<Awaited<ReturnType<typeof getUnlistedCompany>>, { ok: true }>["meta"];
}) {
  const rising = (c.change.pct ?? 0) >= 0;
  const facts = Object.entries(c.facts).filter(([label]) => label !== "Indicative price");

  return (
    <>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          {c.sector ? (
            <span className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-2xs font-medium text-accent">
              {c.sector}
            </span>
          ) : null}
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{c.name}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-2xs text-muted-foreground">
            {c.isin ? <span>ISIN {c.isin}</span> : null}
            {c.cin ? <span>CIN {c.cin}</span> : null}
          </p>
        </div>

        <div className="flex flex-col items-end">
          <WatchButton kind="unlisted" id={c.id} name={c.name} className="mb-3" />
          <div className="font-mono text-4xl font-semibold tabular-nums">{c.price == null ? "n/a" : money(c.price)}</div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {c.change.pct != null ? (
              <span className={cn("font-mono text-sm tabular-nums", rising ? "text-up" : "text-down")}>
                {formatPct(c.change.pct, 1)} <span className="text-muted-foreground">{c.change.window}</span>
              </span>
            ) : null}
            <FreshnessBadge meta={meta} />
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">
            Indicative price{c.asOf ? ` as of ${c.asOf}` : ""}
          </p>
        </div>
      </header>

      <Lifecycle l={c.lifecycle} />

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <PriceHistoryChart series={c.series} />

          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Price revisions</h2>
              <p className="text-2xs text-muted-foreground">
                {c.revisions.length} real changes since {c.firstDate}. The source shows {c.dailyPoints.toLocaleString("en-IN")} daily
                points, but most only repeat the last revision.
              </p>
            </header>
            <div className="max-h-[26rem] overflow-auto">
              <table className="data-table data-table-sticky w-full text-sm">
                <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Price</th>
                    <th className="px-4 py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {c.revisions.map((r) => (
                    <tr key={r.date} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-1.5 font-mono text-xs">{r.date}</td>
                      <td className="px-4 py-1.5 text-right font-mono tabular-nums">{money(r.price)}</td>
                      <td
                        className={cn(
                          "px-4 py-1.5 text-right font-mono tabular-nums",
                          r.changePct == null ? "text-muted-foreground" : r.changePct >= 0 ? "text-up" : "text-down",
                        )}
                      >
                        {r.changePct == null ? "first" : formatPct(r.changePct, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Key ratios</h2>
            </header>
            <dl className="grid grid-cols-2 gap-px bg-border">
              {facts.map(([label, value]) => (
                <div key={label} className="bg-surface px-4 py-3 odd:last:col-span-2">
                  <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className={cn("mt-1 font-mono text-base font-semibold tabular-nums", value === "N/A" && "text-muted-foreground")}>
                    {value}
                  </dd>
                </div>
              ))}
              {c.sinceFirstPct != null ? (
                <div className="bg-surface px-4 py-3 odd:last:col-span-2">
                  <dt className="text-2xs uppercase tracking-wide text-muted-foreground">Since {c.firstDate}</dt>
                  <dd className={cn("mt-1 font-mono text-base font-semibold tabular-nums", c.sinceFirstPct >= 0 ? "text-up" : "text-down")}>
                    {formatPct(c.sinceFirstPct, 0)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-flat/30 bg-flat/[0.06] px-4 py-3">
            <h2 className="text-sm font-medium text-flat">Read this before relying on the price</h2>
            <p className="mt-1.5 text-2xs leading-relaxed text-muted-foreground">
              This is an indicative level compiled by a dealer site. It is not an exchange price and not a quote you can
              trade at. Unlisted shares are illiquid, settle off-exchange and carry no exchange disclosure regime, so
              the next real deal can differ widely. Descriptive data only, not investment advice.
            </p>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline"
            >
              Open the source page <ArrowUpRight className="h-3 w-3" />
            </a>
          </section>

          <SourceLine meta={meta} />
        </div>
      </div>
    </>
  );
}

type LifecycleData = Extract<Awaited<ReturnType<typeof getUnlistedCompany>>, { ok: true }>["data"]["lifecycle"];

/** Where the company sits on the path from private to listed, when NSE data shows it has moved. */
function Lifecycle({ l }: { l: LifecycleData }) {
  if (!l.listedSymbol && !l.ipo) return null;
  const ipo = l.ipo;
  return (
    <div className="mt-6 space-y-3">
      {l.listedSymbol ? (
        <Link
          href={`/company/${l.listedSymbol}`}
          className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-up/40 bg-up/[0.07] px-4 py-3 transition-colors hover:border-up/70"
        >
          <span className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-up" />
            <span>
              <span className="block text-sm font-semibold">Now listed on NSE as {l.listedSymbol}</span>
              <span className="block text-2xs text-muted-foreground">
                The price below is its indicative pre-listing level. Open the live company page for the exchange price.
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-up transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
      {ipo ? (
        <Link
          href="/ipo"
          className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/[0.07] px-4 py-3 transition-colors hover:border-accent/70"
        >
          <span className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-accent" />
            <span>
              <span className="block text-sm font-semibold capitalize">
                IPO {ipo.status ?? "in the pipeline"}
                {ipo.segment ? ` (${ipo.segment})` : ""}
              </span>
              <span className="block text-2xs text-muted-foreground">
                {ipo.priceBandLow != null && ipo.priceBandHigh != null ? `Price band ₹${ipo.priceBandLow} to ₹${ipo.priceBandHigh}. ` : ""}
                {ipo.issueStartDate ? `Issue opens ${ipo.issueStartDate}` : ""}
                {ipo.issueEndDate ? `, closes ${ipo.issueEndDate}` : ""}
                {ipo.listingDate ? `. Listing ${ipo.listingDate}` : ""}
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
