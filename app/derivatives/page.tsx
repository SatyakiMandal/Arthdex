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
import { DerivativesTerminalDesk } from "@/components/derivatives/derivatives-terminal-desk";
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

        {/* Bloomberg Real-Time Unified Derivatives Terminal Shell */}
        <div className="mt-2">
          <DerivativesTerminalDesk
            initialSymbol={symbol}
            initialExpiry={expiry}
            chainData={chain?.data ?? null}
            buildUpData={buildUp?.data ?? null}
            fnoBanData={fnoBan?.ok ? fnoBan.data : null}
            earningsData={earningsMoves?.ok ? earningsMoves.data : null}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
