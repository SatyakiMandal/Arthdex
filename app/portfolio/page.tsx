import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Briefcase } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { postPortfolioAnalyze } from "@/lib/api/endpoints";
import type { ApiPortfolioAnalysis } from "@/lib/api/types";
import { PortfolioTerminal, SAMPLE_PORTFOLIOS } from "@/components/portfolio/portfolio-terminal";

export const metadata: Metadata = {
  title: "Portfolio & Tax Harvester · Arthdex",
  description:
    "Accurate multi-lot portfolio diagnostics: true Newton-Raphson XIRR, Section 112A tax-loss harvesting with Budget 2024 rules (₹1.25L LTCG exemption), and peer-swaps.",
};

const FALLBACK_ANALYSIS: ApiPortfolioAnalysis = {
  asOf: new Date().toISOString(),
  summary: {
    totalInvested: 350250,
    currentValue: 382400,
    totalPnL: 32150,
    totalPnLPct: 9.18,
    xirrPct: 14.82,
    lotsCount: 7,
    uniqueHoldingsCount: 7,
  },
  lots: [
    {
      symbol: "TCS",
      quantity: 25,
      buyDate: "2024-08-15",
      buyPrice: 4200.0,
      currentPrice: 3950.0,
      investedAmount: 105000.0,
      currentValue: 98750.0,
      unrealizedPnL: -6250.0,
      unrealizedPnLPct: -5.95,
      holdingDays: 82,
      taxBucket: "STCG",
      isLoss: true,
    },
    {
      symbol: "INFY",
      quantity: 50,
      buyDate: "2023-05-10",
      buyPrice: 1450.0,
      currentPrice: 1850.0,
      investedAmount: 72500.0,
      currentValue: 92500.0,
      unrealizedPnL: 20000.0,
      unrealizedPnLPct: 27.59,
      holdingDays: 544,
      taxBucket: "LTCG",
      isLoss: false,
    },
    {
      symbol: "HDFCBANK",
      quantity: 60,
      buyDate: "2024-06-20",
      buyPrice: 1720.0,
      currentPrice: 1650.0,
      investedAmount: 103200.0,
      currentValue: 99000.0,
      unrealizedPnL: -4200.0,
      unrealizedPnLPct: -4.07,
      holdingDays: 138,
      taxBucket: "STCG",
      isLoss: true,
    },
    {
      symbol: "ICICIBANK",
      quantity: 40,
      buyDate: "2023-11-12",
      buyPrice: 980.0,
      currentPrice: 1260.0,
      investedAmount: 39200.0,
      currentValue: 50400.0,
      unrealizedPnL: 11200.0,
      unrealizedPnLPct: 28.57,
      holdingDays: 358,
      taxBucket: "STCG",
      isLoss: false,
    },
    {
      symbol: "RELIANCE",
      quantity: 20,
      buyDate: "2024-03-05",
      buyPrice: 2850.0,
      currentPrice: 3020.0,
      investedAmount: 57000.0,
      currentValue: 60400.0,
      unrealizedPnL: 3400.0,
      unrealizedPnLPct: 5.96,
      holdingDays: 245,
      taxBucket: "STCG",
      isLoss: false,
    },
    {
      symbol: "WIPRO",
      quantity: 80,
      buyDate: "2024-09-01",
      buyPrice: 560.0,
      currentPrice: 513.0,
      investedAmount: 44800.0,
      currentValue: 41040.0,
      unrealizedPnL: -3760.0,
      unrealizedPnLPct: -8.39,
      holdingDays: 65,
      taxBucket: "STCG",
      isLoss: true,
    },
    {
      symbol: "TATAMOTORS",
      quantity: 45,
      buyDate: "2023-08-20",
      buyPrice: 650.0,
      currentPrice: 925.0,
      investedAmount: 29250.0,
      currentValue: 41625.0,
      unrealizedPnL: 12375.0,
      unrealizedPnLPct: 42.31,
      holdingDays: 442,
      taxBucket: "LTCG",
      isLoss: false,
    },
  ],
  taxHarvesting: {
    stcg: {
      unrealizedGains: 14600.0,
      unrealizedLosses: 14210.0,
      taxableGain: 390.0,
      taxRatePct: 20.0,
    },
    ltcg: {
      unrealizedGains: 32375.0,
      unrealizedLosses: 0.0,
      annualExemptionLimit: 125000.0,
      taxableGain: 0.0,
      taxRatePct: 12.5,
    },
    potentialTaxSavings: 2842.0,
    opportunities: [
      {
        symbol: "TCS",
        quantity: 25,
        currentValue: 98750.0,
        unrealizedLoss: 6250.0,
        taxBucket: "STCG",
        taxRatePct: 20.0,
        estimatedTaxSaving: 1250.0,
        daysHeld: 82,
        recommendedSwaps: ["INFY", "HCLTECH", "TECHM"],
        action: "Sell to harvest ₹6,250 STCG loss, offset short-term equity gains, and reinvest into peer to stay exposed.",
      },
      {
        symbol: "HDFCBANK",
        quantity: 60,
        currentValue: 99000.0,
        unrealizedLoss: 4200.0,
        taxBucket: "STCG",
        taxRatePct: 20.0,
        estimatedTaxSaving: 840.0,
        daysHeld: 138,
        recommendedSwaps: ["ICICIBANK", "KOTAKBANK", "AXISBANK"],
        action: "Sell to harvest ₹4,200 STCG loss, offset short-term equity gains, and reinvest into peer to stay exposed.",
      },
      {
        symbol: "WIPRO",
        quantity: 80,
        currentValue: 41040.0,
        unrealizedLoss: 3760.0,
        taxBucket: "STCG",
        taxRatePct: 20.0,
        estimatedTaxSaving: 752.0,
        daysHeld: 65,
        recommendedSwaps: ["TECHM", "LTIM", "INFY"],
        action: "Sell to harvest ₹3,760 STCG loss, offset short-term equity gains, and reinvest into peer to stay exposed.",
      },
    ],
  },
  sectorAllocation: [
    { sector: "Information Technology", value: 232290.0, weightPct: 48.0 },
    { sector: "Financial Services", value: 149400.0, weightPct: 30.9 },
    { sector: "Energy & Petrochemicals", value: 60400.0, weightPct: 12.5 },
    { sector: "Automobile & Auto Components", value: 41625.0, weightPct: 8.6 },
  ],
  concentrationAlerts: [],
};

export default async function PortfolioPage() {
  let initialData: ApiPortfolioAnalysis = FALLBACK_ANALYSIS;

  try {
    const res = await postPortfolioAnalyze(SAMPLE_PORTFOLIOS[0].holdings);
    if (res.ok && res.data) {
      initialData = res.data;
    }
  } catch {
    // Graceful fallback to default sample analysis
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-accent" />
              <span>Portfolio &amp; Section 112A Tax Harvester</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              True Newton-Raphson XIRR, Budget 2024 Capital Gains Optimiser &amp; Peer Swaps
            </span>
          </div>
        </div>

        <div className="mt-3">
          <PortfolioTerminal initialAnalysis={initialData} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
