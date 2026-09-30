import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { BentoGrid } from "@/components/landing/bento-grid";
import { MoversPreview } from "@/components/market/movers-preview";
import { GlobalSentiment } from "@/components/macro/global-sentiment";
import { NewsFeed } from "@/components/macro/news-feed";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getNews } from "@/lib/api/endpoints";

export default async function Home() {
  const news = await getNews({ limit: 8 });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <Hero />
        <BentoGrid />
        <MoversPreview />
        <GlobalSentiment />

        <section className="mx-auto max-w-[1600px] px-4 pb-16 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Latest filings
              </h2>
            </div>
            <Link
              href="/news"
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium transition-colors hover:border-accent/50 hover:text-accent"
            >
              All news &amp; filings
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {news.ok ? (
            <NewsFeed items={news.data.items} title="Latest Filings & Coverage" />
          ) : (
            <DataUnavailable message={news.message} />
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
