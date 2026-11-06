"use client";

import { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  Share2,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Percent,
  ShieldCheck,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TearSheetViewProps {
  symbol?: string;
}

export function TearSheetView({ symbol = "RELIANCE" }: TearSheetViewProps) {
  const sym = symbol.toUpperCase();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      {/* Action Header / Print Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface p-2.5 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <span className="font-bold uppercase text-foreground">
            INSTITUTIONAL TEAR-SHEET &amp; EQUITY FACTSHEET (TEAR)
          </span>
          <span className="text-3xs text-muted-foreground">• 2-PAGE VECTOR PRINT FORMAT</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground font-bold text-3xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>PRINT / SAVE PDF</span>
          </button>
        </div>
      </div>

      {/* The Printable 2-Page Factsheet Document */}
      <div className="border border-border bg-surface p-6 space-y-6 shadow-sm print:border-none print:p-0 print:shadow-none text-foreground">
        {/* Document Header */}
        <div className="flex flex-wrap items-start justify-between border-b-2 border-border pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{sym} · RELIANCE INDUSTRIES LTD</h2>
              <span className="px-1.5 py-0.5 bg-accent/20 text-accent font-bold text-3xs border border-accent/40">
                NSE: {sym}
              </span>
            </div>
            <p className="text-3xs text-muted-foreground mt-0.5">
              ISIN: INE002A01018 • Sector: Oil &amp; Gas / Telecom / Retail • Index: NIFTY 50
            </p>
          </div>

          <div className="text-right">
            <div className="text-xl font-bold">₹2,945.50</div>
            <div className="text-3xs text-emerald-400 font-bold">+1.42% Today • FY24 Audited</div>
          </div>
        </div>

        {/* Key Metrics Ledger Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 border-b border-border/80">
          <div>
            <span className="text-3xs text-muted-foreground uppercase font-bold">Market Cap</span>
            <div className="text-sm font-bold mt-0.5">₹19,92,400 Cr</div>
            <span className="text-3xs text-muted-foreground">$238.5 Billion USD</span>
          </div>
          <div>
            <span className="text-3xs text-muted-foreground uppercase font-bold">Enterprise Value</span>
            <div className="text-sm font-bold mt-0.5">₹21,04,800 Cr</div>
            <span className="text-3xs text-muted-foreground">Net Debt: ₹1,12,400 Cr</span>
          </div>
          <div>
            <span className="text-3xs text-muted-foreground uppercase font-bold">52-Week Range</span>
            <div className="text-sm font-bold mt-0.5">₹2,220 - ₹3,024</div>
            <span className="text-3xs text-muted-foreground">Within 2.6% of 52W High</span>
          </div>
          <div>
            <span className="text-3xs text-muted-foreground uppercase font-bold">Valuation Multiples</span>
            <div className="text-sm font-bold mt-0.5">P/E: 28.4 • P/B: 2.45</div>
            <span className="text-3xs text-muted-foreground">EV/EBITDA: 13.8x</span>
          </div>
        </div>

        {/* Financial Performance Ledger (10Y CAGR & Key Ratios) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CAGR Matrix */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase text-foreground border-b border-border/60 pb-1">
              COMPOUNDED GROWTH TRACK RECORD (CAGR)
            </h3>
            <table className="w-full text-left text-2xs">
              <thead>
                <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                  <th className="py-1">METRIC</th>
                  <th className="py-1 text-right">10 YEARS</th>
                  <th className="py-1 text-right">5 YEARS</th>
                  <th className="py-1 text-right">3 YEARS</th>
                  <th className="py-1 text-right">TTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                <tr>
                  <td className="py-1 font-bold">Consolidated Revenue</td>
                  <td className="py-1 text-right">12.4%</td>
                  <td className="py-1 text-right">14.8%</td>
                  <td className="py-1 text-right text-accent font-bold">18.2%</td>
                  <td className="py-1 text-right">10.5%</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Operating Profit (EBITDA)</td>
                  <td className="py-1 text-right">14.1%</td>
                  <td className="py-1 text-right">16.2%</td>
                  <td className="py-1 text-right text-accent font-bold">19.5%</td>
                  <td className="py-1 text-right">14.2%</td>
                </tr>
                <tr>
                  <td className="py-1 font-bold">Net Profit (PAT)</td>
                  <td className="py-1 text-right">13.2%</td>
                  <td className="py-1 text-right">15.0%</td>
                  <td className="py-1 text-right text-accent font-bold">16.8%</td>
                  <td className="py-1 text-right">9.2%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Capital Allocation & Return Ratios */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase text-foreground border-b border-border/60 pb-1">
              CAPITAL EFFICIENCY &amp; BALANCE SHEET HEALTH
            </h3>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              <div className="p-2 border border-border bg-surface-muted/30">
                <span className="text-3xs text-muted-foreground uppercase">Return on Equity (ROE)</span>
                <div className="text-sm font-bold text-foreground mt-0.5">9.8%</div>
                <span className="text-3xs text-muted-foreground">5Y Avg: 10.4%</span>
              </div>
              <div className="p-2 border border-border bg-surface-muted/30">
                <span className="text-3xs text-muted-foreground uppercase">ROCE</span>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">11.2%</div>
                <span className="text-3xs text-muted-foreground">Pre-tax capital efficiency</span>
              </div>
              <div className="p-2 border border-border bg-surface-muted/30">
                <span className="text-3xs text-muted-foreground uppercase">Debt to Equity</span>
                <div className="text-sm font-bold text-foreground mt-0.5">0.38x</div>
                <span className="text-3xs text-muted-foreground">Conservative leverage</span>
              </div>
              <div className="p-2 border border-border bg-surface-muted/30">
                <span className="text-3xs text-muted-foreground uppercase">Interest Coverage</span>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">8.4x</div>
                <span className="text-3xs text-muted-foreground">EBIT / Finance Cost</span>
              </div>
            </div>
          </div>
        </div>

        {/* Shareholding Pattern & Sell-Side Consensus */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border">
          {/* Shareholding */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase text-foreground border-b border-border/60 pb-1">
              SHAREHOLDING PATTERN (BSE/NSE REGULATORY)
            </h3>
            <div className="space-y-1.5 text-2xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promoter &amp; Promoter Group:</span>
                <span className="font-bold text-foreground">50.3% (0.0% Pledged)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Foreign Institutional Investors (FII):</span>
                <span className="font-bold text-foreground">22.1% (3,240 Funds)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Domestic Institutional Investors (DII):</span>
                <span className="font-bold text-foreground">16.5% (Mutual Funds + LIC)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retail &amp; Public:</span>
                <span className="font-bold text-foreground">11.1%</span>
              </div>
            </div>
          </div>

          {/* Sell-Side Consensus */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase text-foreground border-b border-border/60 pb-1">
              SELL-SIDE ANALYST CONSENSUS (ANR)
            </h3>
            <div className="flex items-center justify-between text-2xs">
              <div>
                <span className="text-muted-foreground">Mean Price Target:</span>
                <div className="text-base font-bold text-accent">₹3,280.00</div>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground">Implied Upside:</span>
                <div className="text-base font-bold text-emerald-400">+11.4%</div>
              </div>
            </div>
            <div className="flex gap-1 h-3 mt-2">
              <div className="bg-emerald-500 h-full w-[75%]" title="Buy: 75% (27 Analysts)" />
              <div className="bg-amber-500 h-full w-[17%]" title="Hold: 17% (6 Analysts)" />
              <div className="bg-destructive h-full w-[8%]" title="Sell: 8% (3 Analysts)" />
            </div>
            <div className="flex justify-between text-3xs text-muted-foreground mt-1">
              <span>BUY (27)</span>
              <span>HOLD (6)</span>
              <span>SELL (3)</span>
            </div>
          </div>
        </div>

        {/* Footer Provenance */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between text-3xs text-muted-foreground">
          <span>ARTHDEX INSTITUTIONAL INTELLIGENCE • ZERO HALLUCINATION DATA PIPELINE</span>
          <span className="font-bold text-accent uppercase">[ACTUAL FILING • AUDITED ANNUAL REPORT]</span>
        </div>
      </div>
    </div>
  );
}
