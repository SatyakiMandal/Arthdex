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
      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Star className="h-4 w-4 text-gold" />
              <span>Institutional Watchlist &amp; Tracking Portfolio</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Unified Tracking for Listed NSE Equities, OTC Unlisted &amp; Pre-IPO Issues
            </span>
          </div>
        </div>
        <div className="mt-3">
          <WatchlistView />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
