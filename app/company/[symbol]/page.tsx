import { PageStamp } from "@/components/layout/refresh-control";
import type { Metadata } from "next";
import { PriceChart } from "@/components/company/price-chart";
import {
  AnnualPnLPanel,
  BalanceSheetPanel,
  KeyRatiosPanel,
  QuarterlyPnLPanel,
} from "@/components/company/fundamentals";
import { CompanyAbout, ValuationPanel } from "@/components/company/valuation-panel";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { SectionHead } from "@/components/ui/section-head";
import { PreIpoPanel } from "@/components/company/pre-ipo-panel";
import { PeBandRail, PeersPanel } from "@/components/company/peers-panel";
import { QualityPanel } from "@/components/company/quality-panel";
import { getCandles, getFinancials, getForensics, getPeBand, getPeers, getPreIpo, getProfile, getUnlistedCompany, getValuation } from "@/lib/api/endpoints";

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

  const [candles, financials, valuation, profile, preIpoMatch, peers, band, forensics] = await Promise.all([
    getCandles(upper, "1Y"),
    getFinancials(upper),
    getValuation(upper),
    getProfile(upper),
    getPreIpo(upper),
    getPeers(upper),
    getPeBand(upper),
    getForensics(upper),
  ]);
  // A company that was once traded unlisted keeps its earlier price history on the same page
  const preIpoId = preIpoMatch?.data.id ?? null;
  const preIpo = preIpoId ? await getUnlistedCompany(preIpoId) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Corporation",
    name: profile?.data.name ?? upper,
    tickerSymbol: `NSE:${upper}`,
    url: `https://arthdex.com/company/${upper}`,
    description: profile?.data.summary ?? `Live share price, fundamentals, ratios and valuation for ${upper} on NSE.`,
    ...(profile?.data.isin ? { isin: profile.data.isin } : {}),
    ...(profile?.data.website ? { sameAs: [profile.data.website] } : {}),
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-14 px-4 py-8 sm:px-6 lg:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section aria-label="Price history">
        {candles.ok ? (
          <>
            <PriceChart symbol={upper} initialCandles={candles.data.candles} initialPeriod="1Y" />
            <PageStamp meta={candles.meta} />
            <SourceLine meta={candles.meta} className="mt-2 px-1" />
          </>
        ) : (
          <DataUnavailable title="Price history unavailable" message={candles.message} />
        )}
      </section>

      {profile || valuation ? (
        <section aria-labelledby="business">
          <SectionHead id="business" title="The business" note="From the company's profile and reported figures" />
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            {profile ? <CompanyAbout profile={profile.data} /> : null}
            {valuation ? (
              <div className={profile ? undefined : "lg:col-span-2"}>
                <h3 className="font-sans text-sm font-semibold tracking-normal">Valuation</h3>
                <div className="mt-2">
                  <ValuationPanel valuation={valuation.data} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {peers || band ? (
        <section aria-labelledby="peers">
          <SectionHead id="peers" title="Against its peers and its past" note="Industry peers by market cap; P/E over five years" />
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-14">
            {peers ? <PeersPanel peers={peers.data} symbol={upper} /> : <p className="text-sm text-muted-foreground">No industry peers are available for this company.</p>}
            {band ? <PeBandRail band={band.data} /> : null}
          </div>
        </section>
      ) : null}

      {forensics ? (
        <section aria-labelledby="quality">
          <SectionHead id="quality" title="Quality checks" note="Forensic scores, and the growth the price implies" />
          <div className="mt-6">
            <QualityPanel data={forensics.data} />
          </div>
        </section>
      ) : null}

      {preIpo?.ok ? <PreIpoPanel company={preIpo.data} /> : null}

      <section aria-labelledby="financials" className="space-y-4">
        <SectionHead id="financials" title="Financials" note="Quarterly and annual, as reported" />
        {financials ? (
          <>
            <div className="pt-2">
              <QuarterlyPnLPanel financials={financials.data} />
            </div>
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
      </section>
    </div>
  );
}
