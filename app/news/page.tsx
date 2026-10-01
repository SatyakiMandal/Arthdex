import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NewsFeed } from "@/components/macro/news-feed";
import { DataUnavailable, FreshnessBadge, SourceLine } from "@/components/ui/data-provenance";
import { getNews } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "News & Filings · Arthdex",
  description:
    "Live NSE corporate announcements and Indian financial press coverage, tagged by disclosure type.",
};

interface PageProps {
  searchParams: Promise<{ kind?: string; symbol?: string }>;
}

const KINDS = [
  { id: "", label: "All" },
  { id: "filing", label: "Exchange filings" },
  { id: "press", label: "Press" },
];

export default async function NewsPage({ searchParams }: PageProps) {
  const { kind: requestedKind, symbol } = await searchParams;
  const kind = KINDS.some((k) => k.id === requestedKind) ? requestedKind : "";

  const result = await getNews({
    kind: kind || undefined,
    symbol: symbol || undefined,
    limit: 80,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Newspaper}>News</Eyebrow>
            <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Filings &amp; market coverage
            </h1>
            <p className="mt-3 text-muted-foreground">
              Corporate announcements straight from the exchange, alongside the financial
              press. Filings are flagged using NSE&rsquo;s own disclosure categories.
            </p>
          </div>
          {result.ok ? <FreshnessBadge meta={result.meta} /> : null}
        </div>

        <nav className="mt-6 flex flex-wrap gap-1.5">
          {KINDS.map((option) => (
            <a
              key={option.id || "all"}
              href={`/news${option.id ? `?kind=${option.id}` : ""}`}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                option.id === kind
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </a>
          ))}
        </nav>

        {symbol ? (
          <p className="mt-4 text-2xs text-muted-foreground">
            Filtered to <span className="font-mono text-foreground">{symbol.toUpperCase()}</span>.{" "}
            <a href="/news" className="text-accent hover:underline">
              Clear filter
            </a>
          </p>
        ) : null}

        <div className="mt-6">
          {result.ok ? (
            <>
              <div className="mb-3 flex flex-wrap gap-4 text-2xs text-muted-foreground">
                <span>
                  <span className="font-mono text-foreground">{result.data.counts.filings}</span>{" "}
                  exchange filings
                </span>
                <span>
                  <span className="font-mono text-foreground">{result.data.counts.press}</span>{" "}
                  press items
                </span>
              </div>

              <NewsFeed
                items={result.data.items}
                title={kind === "filing" ? "Exchange Filings" : kind === "press" ? "Press Coverage" : "Filings & Coverage"}
              />

              <div className="mt-3">
<PageStamp meta={result.meta} />
                <SourceLine meta={result.meta} />
              </div>

              {result.data.errors?.length ? (
                <p className="mt-2 text-2xs text-flat">
                  Partial feed: {result.data.errors.join(", ")} did not respond.
                </p>
              ) : null}
            </>
          ) : (
            <DataUnavailable message={result.message} />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
