import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StatusPill } from "@/components/ui/data-card";
import { IllustrativeBanner } from "@/components/ui/data-provenance";
import { governanceVerdict, isIllustrative, listUnlistedCompanies } from "@/lib/illustrative/unlisted";
import { cn, formatINR, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Unlisted Space · Arthdex",
  description:
    "Valuation multiples, governance flags and order-book trajectory for tracked unlisted Indian companies.",
};

export default function UnlistedIndexPage() {
  const companies = listUnlistedCompanies();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-2xs uppercase tracking-[0.2em] text-accent">Unlisted space</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Private-market coverage
          </h1>
          <p className="mt-3 text-muted-foreground">
            Multiples struck off observed secondary deals, governance flags parsed from filed
            documents, and order-book trajectories, benchmarked against listed comparables.
          </p>
        </div>

        <div className="mt-8">
          {companies.some(isIllustrative) ? (
            <IllustrativeBanner
              detail="Unlisted share prices come from private dealer quotes. No exchange publishes them, and the sites that carry them prohibit automated access, so these records are maintained by hand in data/unlisted.json rather than fetched. Records still marked illustrative are sample values. Everything else in Arthdex is live."
            />
          ) : (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-2xs text-muted-foreground">
              Unlisted records are maintained by hand in data/unlisted.json, since no exchange
              publishes private-market prices. Each profile shows its own source and date.
            </p>
          )}
        </div>

        <ul className="mt-8 grid gap-4 lg:grid-cols-2">
          {companies.map((c) => {
            const verdict = governanceVerdict(c);
            const redFlags = c.governanceFlags.filter((f) => f.severity === "red-flag").length;

            return (
              <li key={c.id}>
                <Link
                  href={`/unlisted/${c.id}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold tracking-tight">{c.name}</h2>
                      <p className="mt-0.5 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                        {c.industry}
                      </p>
                    </div>
                    <StatusPill label={verdict.label} tone={verdict.tone} />
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
                    {[
                      { label: "Last deal", value: `₹${formatINR(c.lastDealPrice, 0)}` },
                      { label: "Implied P/E", value: c.impliedPe.toFixed(1) },
                      { label: "Rev CAGR 3Y", value: formatPct(c.metrics.revenueCagr3yPct, 0) },
                      { label: "Order book", value: `₹${formatINR(c.metrics.totalOrderBookCr, 0)} Cr` },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface px-3 py-2">
                        <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                        <dd className="mt-0.5 font-mono text-sm font-medium tabular-nums">{s.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-2xs uppercase tracking-wide",
                        redFlags > 0 ? "text-down" : "text-muted-foreground",
                      )}
                    >
                      {c.governanceFlags.length} governance flags
                      {redFlags > 0 ? ` · ${redFlags} red` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-2xs text-accent">
                      Open profile
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
