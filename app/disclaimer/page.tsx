import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AlertTriangle, AlertOctagon, TrendingDown, Info, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "SEBI Regulatory & Risk Disclaimer · Arthdex",
  description:
    "Statutory SEBI regulatory disclaimers, F&O high risk warnings, quantitative model disclosures, and unlisted securities notices for Arthdex.",
};

export default function RegulatoryDisclaimerPage() {
  const lastUpdated = "November 6, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="border border-border bg-surface p-6 sm:p-10">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-flat">
            <AlertTriangle className="h-4 w-4" />
            <span>Statutory Disclosure · SEBI Regulations & Risk Warnings</span>
          </div>
          <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Regulatory & Risk Disclaimer
          </h1>
          <p className="mt-1 text-2xs text-muted-foreground">Last updated: {lastUpdated}</p>

          {/* Mandatory SEBI Warning Banner */}
          <div className="mt-6 border-l-4 border-flat bg-surface-raised p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-flat">
              <AlertOctagon className="h-4 w-4" />
              Statutory Warning on Derivatives (F&amp;O) Trading
            </p>
            <p className="mt-2 text-2xs leading-relaxed text-foreground">
              As per SEBI study dated January 2023, <strong>9 out of 10 individual traders in the equity Futures and Options (F&amp;O) segment incurred net losses</strong>. On average, loss makers registered net trading loss close to ₹50,000. Over and above the net trading losses, loss makers expended an additional 28% of net trading losses as transaction costs. Those making net trading profits spent between 15% to 50% of such profits as transaction costs.
            </p>
          </div>

          <div className="mt-8 space-y-8 text-xs leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info className="h-4 w-4 text-accent" /> 1. Non-Advisory Nature of Platform
              </h2>
              <p>
                Arthdex is an engineering and mathematical research platform operated solely for educational, research, and self-directed quantitative analysis.
              </p>
              <p>
                <strong>Arthdex is NOT registered with the Securities and Exchange Board of India (SEBI) as:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>An Investment Adviser under the SEBI (Investment Advisers) Regulations, 2013.</li>
                <li>A Research Analyst under the SEBI (Research Analysts) Regulations, 2014.</li>
                <li>A Portfolio Manager under the SEBI (Portfolio Managers) Regulations, 2020.</li>
                <li>A Stock Broker, Sub-Broker, or Depository Participant.</li>
              </ul>
              <p>
                No content, automated screen, quantitative scoring (including Piotroski F-Score, Altman Z-Score, Merton Distance-to-Default, or Reverse DCF terminal growth rate), or news sentiment summary on Arthdex should be construed as investment advice, financial planning, recommendation, or solicitation to invest.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingDown className="h-4 w-4 text-down" /> 2. Market Risk & Capital Loss
              </h2>
              <p>
                Securities investments are subject to market risks. Read all scheme and company offer documents carefully before investing. The market price of shares, exchange-traded funds (ETFs), and derivatives can fluctuate substantially based on domestic macroeconomic cycles, global interest rates, regulatory changes, and corporate earnings.
              </p>
              <p>
                Past performance, historical volatility metrics, or backtested models shown on the Platform do not indicate or guarantee future returns.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-flat" /> 3. Unlisted Equities & Pre-IPO Shares
              </h2>
              <p>
                The Unlisted Space section of Arthdex aggregates dealer quotes and historical private placement benchmarks for informational benchmarking. Users must note:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>Unlisted shares are <strong>not traded on recognized stock exchanges</strong> (NSE/BSE).</li>
                <li>Prices shown represent dealer indicative bids/offers and may carry substantial illiquidity discounts, wide bid-ask spreads, and counterparty settlement risk.</li>
                <li>Private companies are not subject to the continuous disclosure norms of exchange-listed firms.</li>
                <li>An unlisted company may defer or abandon plans for an Initial Public Offering (IPO).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-flat" /> 4. Grey Market Premium (GMP) Disclaimers
              </h2>
              <p>
                Grey market premium (GMP) figures displayed on the IPO intelligence desk reflect unofficial, unregulated dealer indications circulating in unofficial markets prior to public listing.
              </p>
              <p>
                GMP quotes are not backed by any regulatory guarantee, stock exchange clearinghouse, or SEBI settlement mechanism. Listing prices frequently deviate significantly from prevailing GMP estimates.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                5. Mathematical & Quantitative Model Limitations
              </h2>
              <p>
                Our quantitative desks employ rigorous academic and financial formulations, including Black-Scholes-Merton partial differential equations for options Greeks, historical &amp; parametric Value at Risk (VaR), Merton credit structural models, and reverse discounted cash flow (Reverse DCF).
              </p>
              <p>
                These models rely on theoretical assumptions (such as log-normal price distributions, constant interest rates, and continuous trading) that may break down during market stress, liquidity cascades, or sudden geopolitical shocks.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                6. Consult a Professional
              </h2>
              <p>
                Investors are strongly advised to assess their risk appetite and consult a certified, SEBI-registered Financial Planner or Investment Adviser before making any financial investment or derivatives trading decision.
              </p>
            </section>

            <div className="border-t border-border pt-6 text-2xs">
              <p>
                Review our complete policies:{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                ·{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                ·{" "}
                <Link href="/copyright" className="underline hover:text-foreground">
                  DMCA & Copyright Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
