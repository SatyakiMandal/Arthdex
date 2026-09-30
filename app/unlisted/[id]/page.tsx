import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { UnlistedHeader } from "@/components/unlisted/unlisted-header";
import { ScaleMetrics } from "@/components/unlisted/scale-metrics";
import { GovernanceTracker } from "@/components/unlisted/governance-tracker";
import { MilestoneTimeline } from "@/components/unlisted/milestone-timeline";
import { PeerComparison, type ComparisonPeer } from "@/components/unlisted/peer-comparison";
import { IllustrativeBanner } from "@/components/ui/data-provenance";
import { UNLISTED_IDS, getUnlistedCompany, isIllustrative } from "@/lib/illustrative/unlisted";
import { getQuote, getValuation } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return UNLISTED_IDS.map((id: string) => ({ id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const company = getUnlistedCompany(id);
  if (!company) return { title: "Unlisted company not found · Arthdex" };
  return {
    title: `${company.name} · Unlisted | Arthdex`,
    description: `Illustrative valuation and governance profile for ${company.name}, benchmarked against live listed peers.`,
  };
}

export default async function UnlistedCompanyPage({ params }: PageProps) {
  const { id } = await params;
  const company = getUnlistedCompany(id);
  if (!company) notFound();

  /*
   * The unlisted figures are illustrative, but the comparison is only worth
   * anything if the listed side is real — so peer multiples are fetched live.
   * A peer whose data cannot be loaded is dropped rather than back-filled.
   */
  const peerResults = await Promise.all(
    company.listedPeerSymbols.map(async (symbol: string) => {
      const [quote, valuation] = await Promise.all([getQuote(symbol), getValuation(symbol)]);
      if (!quote.ok || !valuation) return null;
      const { peRatio, evToEbitda } = valuation.data;
      if (peRatio === null && evToEbitda === null) return null;
      return {
        symbol,
        name: quote.data.symbol,
        cmp: quote.data.cmp,
        peRatio: peRatio ?? 0,
        evToEbitda: evToEbitda ?? 0,
      } satisfies ComparisonPeer;
    }),
  );

  const peers = peerResults.filter((peer): peer is ComparisonPeer => peer !== null);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <UnlistedHeader company={company} />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {isIllustrative(company) ? (
          <IllustrativeBanner
            className="mb-4"
            detail={`${company.source}. No exchange publishes unlisted prices, and the dealer sites that carry them prohibit automated access, so this record is maintained by hand in data/unlisted.json. The listed peers it is compared against are live.`}
          />
        ) : (
          <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-2xs text-muted-foreground">
            Manually maintained record. Source: {company.source}. Last updated{" "}
            <span className="font-mono text-foreground">{company.lastUpdated}</span>. The listed
            peers it is compared against are live.
          </p>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <div className="grid gap-4">
            <ScaleMetrics company={company} />
            {peers.length > 0 ? (
              <PeerComparison
                unlistedName={company.name}
                unlistedPe={company.impliedPe}
                unlistedEvEbitda={company.impliedEvToEbitda}
                peers={peers}
              />
            ) : null}
          </div>

          <div className="grid gap-4">
            <GovernanceTracker company={company} />
            <MilestoneTimeline company={company} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
