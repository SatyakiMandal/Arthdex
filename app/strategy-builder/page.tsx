import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { OptionsStrategyBuilder } from "@/components/derivatives/options-strategy-builder";
import { getStrategyTemplates, postStrategyPayoff } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Options Strategy Builder (OSB) · Arthdex Terminal",
  description: "Interactive multi-leg option strategy payoffs, Black-Scholes Greeks, breakevens, and risk-reward ratios for NSE derivatives.",
};

interface StrategyBuilderPageProps {
  searchParams: Promise<{
    symbol?: string;
  }>;
}

export default async function StrategyBuilderPage({ searchParams }: StrategyBuilderPageProps) {
  const { symbol = "NIFTY" } = await searchParams;
  const sym = symbol.toUpperCase();

  const spot = sym === "BANKNIFTY" ? 52200 : sym === "FINNIFTY" ? 23800 : sym === "RELIANCE" ? 1320 : 24500;
  const lotSize = sym === "BANKNIFTY" ? 15 : sym === "FINNIFTY" ? 65 : sym === "RELIANCE" ? 250 : 50;

  const templatesRes = await getStrategyTemplates(sym, spot);
  const templates = templatesRes.ok ? templatesRes.data : [];

  const defaultLegs = [
    { action: "buy" as const, type: "CE" as const, strike: spot, premium: Math.round(spot * 0.008), contracts: 1, iv: 0.14 },
    { action: "sell" as const, type: "CE" as const, strike: spot + (sym === "BANKNIFTY" ? 200 : 100), premium: Math.round(spot * 0.0035), contracts: 1, iv: 0.135 },
  ];

  const payoffRes = await postStrategyPayoff({
    symbol: sym,
    spotPrice: spot,
    lotSize,
    legs: defaultLegs,
    daysToExpiry: 7,
  });

  const initialPayoff = payoffRes.ok
    ? payoffRes.data
    : {
        symbol: sym,
        spotPrice: spot,
        lotSize,
        daysToExpiry: 7,
        netCashFlow: -5000,
        isDebit: true,
        maxProfit: 5000,
        maxLoss: 5000,
        breakevens: [spot + 100],
        riskRewardRatio: 1.0,
        greeks: { netDelta: 25, netGamma: 0.002, netTheta: -150, netVega: 40 },
        points: [],
        legs: defaultLegs,
      };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        <OptionsStrategyBuilder
          initialSymbol={sym}
          initialSpot={spot}
          initialLotSize={lotSize}
          initialTemplates={templates}
          initialPayoff={initialPayoff}
        />
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
