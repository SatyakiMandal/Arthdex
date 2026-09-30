import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AlertsWorkbench } from "@/components/alerts/alerts-workbench";
import { NewsFeed } from "@/components/macro/news-feed";
import { DataUnavailable } from "@/components/ui/data-provenance";
import { getNews } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Alerts · Arthdex",
  description: "Configure company threshold alerts and watch important results and filings.",
};

export default async function AlertsPage() {
  const news = await getNews({ kind: "filing", limit: 80 });

  // Board outcomes, earnings and corporate actions are the filings that move a
  // valuation; trading-window and newspaper-publication notices are noise here.
  const important = news.ok
    ? news.data.items.filter((item) =>
        item.flags.some((flag) =>
          ["earnings", "board-outcome", "order-win", "rating-action", "acquisition", "dividend"].includes(
            flag,
          ),
        ),
      )
    : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-2xs uppercase tracking-[0.2em] text-accent">Alerts</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Thresholds &amp; important results
          </h1>
          <p className="mt-3 text-muted-foreground">
            Build a condition against any listed company, and track the filings that typically
            precede a re-rating.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <AlertsWorkbench />

          {news.ok ? (
            <NewsFeed
              items={important}
              title="Important Results & Corporate Actions"
              subtitle="Board outcomes, earnings, order wins, rating actions and acquisitions"
            />
          ) : (
            <DataUnavailable title="Filings unavailable" message={news.message} />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
