import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { FundScreenerDesk } from "@/components/funds/fund-screener-desk";
import { getFundsScreener, getFundOverlap } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Mutual Funds Master Screener & Overlap (MF / MFS) · Arthdex Terminal",
  description: "AMFI Indian mutual fund master screener, CAGRs (1Y, 3Y, 5Y), TER, AUM, Sharpe & Sortino ratios, and pairwise portfolio holding overlap engine.",
};

export const revalidate = 3600;

interface FundsPageProps {
  searchParams: Promise<{
    tab?: string;
    category?: string;
    amc?: string;
  }>;
}

export default async function FundsPage({ searchParams }: FundsPageProps) {
  const { tab = "screener", category, amc } = await searchParams;

  const [screenerRes, overlapRes] = await Promise.all([
    getFundsScreener(category, amc),
    getFundOverlap("122639", "118989"),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        {screenerRes.ok && overlapRes.ok ? (
          <>
            <FundScreenerDesk
              initialData={screenerRes.data}
              initialOverlap={overlapRes.data}
              initialTab={tab === "overlap" ? "overlap" : "screener"}
            />
            <div className="mt-3 px-2">
              <SourceLine meta={screenerRes.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable
              title="Mutual Funds Telemetry Offline"
              message={(!screenerRes.ok ? screenerRes.message : !overlapRes.ok ? overlapRes.message : null) || "AMFI scheme master database temporarily unavailable"}
            />
          </div>
        )}
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
