import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Suspense } from "react";
import { MyAlerts } from "@/components/alerts/my-alerts";
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

      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow icon={Bell}>Alerts</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Thresholds &amp; important results
          </h1>
          <p className="mt-3 text-muted-foreground">
            Set price alerts on any listed or unlisted company, and track the filings that typically
            precede a re-rating.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />}>
            <MyAlerts />
          </Suspense>

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
