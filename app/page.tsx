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

export default async function Home() {
  const news = await getNews({ limit: 10 });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main id="main">
        <Hero />
        <MarketToday />
        <Desk />

        <section className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:py-14">
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

        <Methodology />
      </main>

      <SiteFooter />
    </div>
  );
}
