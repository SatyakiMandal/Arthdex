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

      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-accent" />
              <span>Real-Time Alert Thresholds &amp; Disclosures</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Price Triggers, Corporate Actions &amp; Institutional Materiality Monitors
            </span>
          </div>
        </div>

        <div className="mt-2.5 space-y-2.5">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-none border border-border bg-surface" />}>
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
