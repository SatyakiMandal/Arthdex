import type { Metadata } from "next";
import Link from "next/link";
import { Sigma } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { OptionChainView } from "@/components/derivatives/option-chain";
import { BuildUpView } from "@/components/derivatives/build-up";
import { FnoBanTracker } from "@/components/derivatives/fno-ban-tracker";
import { EarningsImpliedMoves } from "@/components/derivatives/earnings-implied-moves";
import { getBuildUp, getOptionChain, getFnoBan, getEarningsMoves } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Derivatives · Arthdex",
  description: "NSE option chains with open interest, implied volatility, max pain and Greeks, and today's futures-and-options build-up.",
};

const INDICES = [
  { id: "NIFTY", label: "Nifty 50" },
  { id: "BANKNIFTY", label: "Bank Nifty" },
  { id: "FINNIFTY", label: "Fin Nifty" },
  { id: "MIDCPNIFTY", label: "Midcap Select" },
];

interface PageProps {
  searchParams: Promise<{ symbol?: string; expiry?: string }>;
}

export default async function DerivativesPage({ searchParams }: PageProps) {
  const { symbol: requested, expiry } = await searchParams;
  const symbol = (requested ?? "NIFTY").toUpperCase().replace(/[^A-Z0-9&-]/g, "");
  const [chain, buildUp, fnoBan, earningsMoves] = await Promise.all([
    getOptionChain(symbol, expiry),
    getBuildUp(),
    getFnoBan(),
    getEarningsMoves(),
  ]);
  const isIndex = INDICES.some((i) => i.id === symbol);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="w-full px-2 py-3 sm:px-3 lg:px-4">
        {/* Bloomberg Top Command Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sigma className="h-4 w-4 text-accent" />
              <span>Derivatives &amp; F&amp;O Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-2xs font-mono text-muted-foreground">
              Institutional Option Chains, Strike Walls, Open Interest Buildup &amp; MWPL Ban
            </span>
          </div>
        </div>

        <section aria-labelledby="chain" className="mt-3">
          <SectionHead id="chain" title={`Option chain${isIndex ? "" : `: ${symbol}`}`} note="NSE, delayed 15 minutes" />
          <nav aria-label="Underlying" className="mt-2.5 flex flex-wrap items-center gap-2">
            {INDICES.map((i) => (
              <Link
                key={i.id}
                href={`/derivatives?symbol=${i.id}`}
                aria-current={symbol === i.id ? "page" : undefined}
                className={cn(
                  "rounded-none border px-3 py-1.5 text-sm transition-colors",
                  symbol === i.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {i.label}
              </Link>
            ))}
            {!isIndex ? <span className="rounded-none border border-foreground bg-foreground px-3 py-1.5 font-mono text-sm text-background">{symbol}</span> : null}
            <form action="/derivatives" className="ml-auto flex items-center gap-2">
              <label htmlFor="stock" className="text-sm text-muted-foreground">Stock</label>
              <input
                id="stock"
                name="symbol"
                placeholder="e.g. RELIANCE"
                className="w-36 rounded-none border border-border bg-surface px-2.5 py-1.5 font-mono text-sm uppercase placeholder:normal-case"
              />
            </form>
          </nav>
          <div className="mt-3">
            {chain ? (
              <>
                <OptionChainView chain={chain.data} />
                <SourceLine meta={chain.meta} className="mt-4" />
              </>
            ) : (
              <DataUnavailable title={`No option chain for ${symbol}`} message="Either the symbol has no listed options, or NSE did not answer. Index options are always listed." />
            )}
          </div>
        </section>

        <section aria-labelledby="buildup" className="mt-4">
          <SectionHead id="buildup" title="F&O build-up" note="Price and open interest, today" />
          <div className="mt-3">
            {buildUp ? (
              <>
                <BuildUpView data={buildUp.data} />
                <SourceLine meta={buildUp.meta} className="mt-4" />
              </>
            ) : (
              <DataUnavailable title="Build-up unavailable" message="NSE's open-interest data did not load." />
            )}
          </div>
        </section>
        {fnoBan && fnoBan.ok ? (
          <section aria-labelledby="fnoban" className="mt-4">
            <SectionHead
              id="fnoban"
              title="F&O Ban List & MWPL Tracker"
              note="Banned from fresh positions at 95% MWPL"
            />
            <div className="mt-3">
              <FnoBanTracker banData={fnoBan.data} />
              <SourceLine meta={fnoBan.meta} className="mt-4" />
            </div>
          </section>
        ) : null}

        {earningsMoves && earningsMoves.ok ? (
          <section aria-labelledby="earningsmoves" className="mt-4">
            <SectionHead
              id="earningsmoves"
              title="Pre-Earnings Implied Move Tracker"
              note="ATM straddle expected post-results move"
            />
            <div className="mt-3">
              <EarningsImpliedMoves initialData={earningsMoves.data} />
              <SourceLine meta={earningsMoves.meta} className="mt-4" />
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
