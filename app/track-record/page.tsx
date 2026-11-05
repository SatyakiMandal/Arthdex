import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TrackRecord } from "@/components/track/track-record";

export const metadata: Metadata = {
  title: "Track record | Arthdex",
  description: "The platform's own indicator calls, scored against Nifty 50 after 1, 5 and 20 trading days.",
};

export default function TrackRecordPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-accent" />
              <span>Algorithmic Track Record &amp; Predictive Performance</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Every Call Logged from the Quant Engine Scored Against Real Exchange Outcomes
            </span>
          </div>
        </div>
        <div className="mt-2.5">
          <TrackRecord />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
