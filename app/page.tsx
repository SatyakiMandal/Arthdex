import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/landing/hero";
import { Methodology } from "@/components/landing/methodology";
import { MarketToday } from "@/components/landing/market-today";
import { Desk } from "@/components/landing/desk";
import { LatestFilings } from "@/components/landing/latest-filings";
import { Reveal } from "@/components/landing/motion";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getNews } from "@/lib/api/endpoints";

function SectionSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className="mx-auto max-w-[1600px] border-b border-border px-4 py-8 sm:px-6 lg:py-10"
    >
      <div className="h-7 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    </section>
  );
}

async function LatestFilingsSection() {
  const news = await getNews({ limit: 10 });
  return (
    <section className="mx-auto max-w-[1600px] border-b border-border px-4 py-8 sm:px-6 lg:py-10">
      <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-balance text-3xl sm:text-4xl">Latest filings</h2>
        <Link
          href="/news"
          className="group inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          All news &amp; filings
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>

      {news.ok ? <LatestFilings items={news.data.items} /> : <DataUnavailable message={news.message} />}
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main">
        <Hero />
        <Suspense fallback={<SectionSkeleton label="Loading market overview" rows={3} />}>
          <MarketToday />
        </Suspense>
        <Suspense fallback={<SectionSkeleton label="Loading desk overview" rows={3} />}>
          <Desk />
        </Suspense>
        <Suspense fallback={<SectionSkeleton label="Loading latest filings" rows={2} />}>
          <LatestFilingsSection />
        </Suspense>

        <Methodology />
      </main>

      <SiteFooter />
    </div>
  );
}
