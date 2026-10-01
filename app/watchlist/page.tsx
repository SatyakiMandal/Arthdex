import type { Metadata } from "next";
import { Star } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { WatchlistView } from "@/components/watchlist/watchlist-view";

export const metadata: Metadata = {
  title: "Watchlist · Arthdex",
  description: "Track listed and unlisted companies in one place, with live prices and alerts.",
};

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow icon={Star}>Watchlist</Eyebrow>
          <h1 className="text-gradient mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Your companies, listed and unlisted
          </h1>
          <p className="mt-3 text-muted-foreground">
            One list for NSE stocks and pre-IPO names. Add a company from its page, then set a price alert on it.
          </p>
        </div>
        <div className="mt-8">
          <WatchlistView />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
