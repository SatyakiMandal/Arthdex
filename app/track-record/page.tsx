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
      <main id="main" className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow icon={ClipboardCheck}>Track record</Eyebrow>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">How the calls actually did</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Every call logged from a Technicals tab is scored against what the stock and Nifty 50 then did. Misses stay in the list.
          </p>
        </div>
        <div className="mt-8">
          <TrackRecord />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
