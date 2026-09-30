import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CompanyHeader } from "@/components/company/company-header";
import { CompanyTabs } from "@/components/company/company-tabs";
import { CustomAlertEngine, type MetricOption } from "@/components/alerts/custom-alert-engine";
import { getProfile, getQuote, getValuation } from "@/lib/api/endpoints";

/**
 * Shared company shell.
 *
 * The quote strip and tab bar are common to all three views, so switching tabs
 * re-renders only the panel below. Rendering is dynamic: there are ~2,600
 * listed companies and the prices are live, so prerendering the set is neither
 * possible nor desirable.
 */
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  const [quote, profile, valuation] = await Promise.all([
    getQuote(upper),
    getProfile(upper),
    getValuation(upper),
  ]);

  // A 404 from the quote endpoint means the ticker is not covered upstream
  if (!quote.ok && quote.status === 404) notFound();

  const alertMetrics: MetricOption[] = [
    { id: "cmp", label: "Market price", category: "price", unit: "₹", current: quote.ok ? quote.data.cmp : undefined },
    { id: "pe", label: "P/E ratio", category: "valuation", unit: "x", current: valuation?.data.peRatio ?? undefined },
    { id: "pb", label: "P/B ratio", category: "valuation", unit: "x", current: valuation?.data.pbRatio ?? undefined },
    { id: "roe", label: "ROE", category: "valuation", unit: "%", current: valuation?.data.roePct ?? undefined },
    { id: "result-date", label: "Quarterly result", category: "event", unit: "", isEvent: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <CompanyHeader
        symbol={upper}
        quote={quote.ok ? quote.data : null}
        meta={quote.ok ? quote.meta : null}
        error={quote.ok ? null : quote.message}
        profile={profile?.data ?? null}
        valuation={valuation?.data ?? null}
      />
      <CompanyTabs
        symbol={upper}
        action={<CustomAlertEngine symbol={upper} metrics={alertMetrics} />}
      />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
