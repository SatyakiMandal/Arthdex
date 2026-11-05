import type { Metadata } from "next";
import Link from "next/link";
import { Sigma } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SectionHead } from "@/components/ui/section-head";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { OptionChainView } from "@/components/derivatives/option-chain";
import { BuildUpView } from "@/components/derivatives/build-up";
import { FnoBanTracker } from "@/components/derivatives/fno-ban-tracker";
import { EarningsImpliedMoves } from "@/components/derivatives/earnings-implied-moves";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
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
      <main id="main" className="w-full px-2 pt-1 pb-3 sm:px-3 lg:px-4 space-y-3">
        {/* Bloomberg Top Command Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sigma className="h-4 w-4 text-accent" />
              <span>Derivatives &amp; F&amp;O Desk</span>
            </h1>
            <span className="text-border">|</span>
            <span className="text-3xs font-mono text-muted-foreground uppercase tracking-wider">
              Option Chains · Strike Walls · Buildup Quadrants · MWPL Ban Tracker
            </span>
          </div>
        </div>

        {/* Tactical Keyboard Command HUD */}
        <KeyboardHud
          contextLabel="DERIVATIVES DESK · COMMAND HUD"
          shortcuts={[
            { key: "/", label: "Stock Search", accent: true },
            { key: "1-4", label: "Nifty / BankNifty / FinNifty / Midcap" },
            { key: "G + B", label: "Daily Bhavcopy Desk" },
            { key: "G + M", label: "Market Watch Radar" },
            { key: "G + O", label: "Live Orderflow & Deals" },
            { key: "Shift+C", label: "Ultra Pitch Mode" },
            { key: "?", label: "All Hotkeys" },
          ]}
        />

        <section aria-labelledby="chain" className="mt-2">
          <SectionHead id="chain" title={`Option chain${isIndex ? "" : `: ${symbol}`}`} note="NSE, delayed 15 minutes" />
          <nav aria-label="Underlying" className="mt-2 flex flex-wrap items-center gap-2 font-mono">
            {INDICES.map((i) => (
              <Link
                key={i.id}
                href={`/derivatives?symbol=${i.id}`}
                aria-current={symbol === i.id ? "page" : undefined}
                className={cn(
                  "rounded-none border px-2.5 py-1 text-2xs font-bold transition-colors",
                  symbol === i.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-muted",
                )}
              >
                {i.label}
              </Link>
            ))}
            {!isIndex ? <span className="rounded-none border border-accent bg-accent/20 px-2.5 py-1 font-mono text-2xs font-bold text-accent">{symbol}</span> : null}
            <form action="/derivatives" className="ml-auto flex items-center gap-2">
              <label htmlFor="stock" className="text-3xs uppercase tracking-wider text-muted-foreground font-mono">Search Scrip</label>
              <input
                id="stock"
                name="symbol"
                placeholder="e.g. RELIANCE [/]"
                className="w-36 h-7 rounded-none border border-border/80 bg-surface px-2 font-mono text-2xs uppercase placeholder:normal-case focus:outline-none focus:border-accent"
              />
            </form>
          </nav>
          <div className="mt-3">
            {chain ? (
              <>
                <OptionChainView chain={chain.data} />
                <SourceLine meta={chain.meta} className="mt-3" />
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
                <SourceLine meta={buildUp.meta} className="mt-3" />
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
              <SourceLine meta={fnoBan.meta} className="mt-3" />
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
              <SourceLine meta={earningsMoves.meta} className="mt-3" />
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
