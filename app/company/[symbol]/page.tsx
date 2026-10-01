import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { PriceChart } from "@/components/company/price-chart";
import {
  AnnualPnLPanel,
  BalanceSheetPanel,
  KeyRatiosPanel,
  QuarterlyPnLPanel,
} from "@/components/company/fundamentals";
import { ValuationPanel } from "@/components/company/valuation-panel";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { PreIpoPanel } from "@/components/company/pre-ipo-panel";
import { getCandles, getFinancials, getPreIpo, getProfile, getUnlistedCompany, getValuation } from "@/lib/api/endpoints";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  const profile = await getProfile(upper);
  return {
    title: `${upper}${profile ? ` · ${profile.data.name}` : ""} | Arthdex`,
    description: `Live price, fundamentals and valuation for ${profile?.data.name ?? upper}.`,
  };
}

export default async function CompanyOverviewPage({ params }: PageProps) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  const [candles, financials, valuation, preIpoMatch] = await Promise.all([
    getCandles(upper, "1Y"),
    getFinancials(upper),
    getValuation(upper),
    getPreIpo(upper),
  ]);
  // A company that was once traded unlisted keeps its earlier price history on the same page
  const preIpoId = preIpoMatch?.data.id ?? null;
  const preIpo = preIpoId ? await getUnlistedCompany(preIpoId) : null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-6 sm:px-6">
      {candles.ok ? (
        <>
          <PriceChart symbol={upper} initialCandles={candles.data.candles} initialPeriod="1Y" />
<PageStamp meta={candles.meta} />
          <SourceLine meta={candles.meta} className="px-1" />
        </>
      ) : (
        <DataUnavailable title="Price history unavailable" message={candles.message} />
      )}

      {valuation ? <ValuationPanel valuation={valuation.data} /> : null}

      {preIpo?.ok ? <PreIpoPanel company={preIpo.data} /> : null}

      {financials ? (
        <>
          <QuarterlyPnLPanel financials={financials.data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <AnnualPnLPanel financials={financials.data} />
            <KeyRatiosPanel financials={financials.data} />
          </div>

          <BalanceSheetPanel financials={financials.data} />
          <SourceLine meta={financials.meta} className="px-1" />
        </>
      ) : (
        <DataUnavailable
          title="Financial statements unavailable"
          message={`No reported statements were returned for ${upper}.`}
        />
      )}
    </div>
  );
}
