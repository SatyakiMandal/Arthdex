"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, ArrowUpRight, ArrowDownRight, Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiCompanyCompare, ApiCompanyCompareCompany } from "@/lib/api/types";
import { CompanyPicker, type PickedCompany } from "@/components/search/company-picker";

interface PresetGroup {
  label: string;
  symbols: string[];
}

const PRESET_PEERS: PresetGroup[] = [
  { label: "IT Giants", symbols: ["TCS", "INFY", "HCLTECH", "WIPRO"] },
  { label: "Private Banks", symbols: ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK"] },
  { label: "Auto Majors", symbols: ["TATAMOTORS", "MARUTI", "M&M", "BAJAJ-AUTO"] },
  { label: "FMCG Leaders", symbols: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA"] },
  { label: "Metals & Mining", symbols: ["TATASTEEL", "JSWSTEEL", "HINDALCO", "COALINDIA"] },
];

function fmtNum(val: number | null | undefined, suffix = "", prefix = ""): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${prefix}${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
}

export function CompanyComparisonMatrix({
  initialData,
}: {
  initialData: ApiCompanyCompare;
}) {
  const [data, setData] = useState<ApiCompanyCompare>(initialData);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const companies = data.companies ?? [];
  const symbols = data.symbols ?? [];

  async function updateSymbols(newSymbols: string[]) {
    if (newSymbols.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compare?symbols=${encodeURIComponent(newSymbols.join(","))}`);
      if (res.ok) {
        const body = (await res.json()) as { data: ApiCompanyCompare };
        if (body.data) setData(body.data);
      }
    } catch (e) {
      console.error("Failed to load comparison", e);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(sym: string) {
    if (symbols.length <= 1) return;
    const filtered = symbols.filter((s) => s.toUpperCase() !== sym.toUpperCase());
    void updateSymbols(filtered);
  }

  function handleAdd(company: PickedCompany | null) {
    if (!company) return;
    const sym = company.id.toUpperCase();
    if (symbols.includes(sym)) return;
    if (symbols.length >= 4) return;
    const updated = [...symbols, sym];
    setShowPicker(false);
    void updateSymbols(updated);
  }

  function loadPreset(preset: PresetGroup) {
    void updateSymbols(preset.symbols);
  }

  // Value highlight helper: returns lowest/highest or null
  function getBestWorst(
    key: (c: ApiCompanyCompareCompany) => number | null | undefined,
    mode: "lowest_is_best" | "highest_is_best",
  ) {
    const valid = companies
      .map((c) => ({ sym: c.symbol, val: key(c) }))
      .filter((x): x is { sym: string; val: number } => x.val !== null && x.val !== undefined && !isNaN(x.val));
    if (valid.length < 2) return { best: null, worst: null };
    valid.sort((a, b) => a.val - b.val);
    if (mode === "lowest_is_best") {
      return { best: valid[0].sym, worst: valid[valid.length - 1].sym };
    }
    return { best: valid[valid.length - 1].sym, worst: valid[0].sym };
  }

  const peHighlight = getBestWorst((c) => c.valuation?.peRatio, "lowest_is_best");
  const pbHighlight = getBestWorst((c) => c.valuation?.pbRatio, "lowest_is_best");
  const roeHighlight = getBestWorst((c) => c.valuation?.roePct, "highest_is_best");
  const roceHighlight = getBestWorst((c) => c.profitability?.rocePct, "highest_is_best");
  const deHighlight = getBestWorst((c) => c.balanceSheet?.debtToEquity, "lowest_is_best");

  return (
    <div className="space-y-6">
      {/* Top action bar and quick peer presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" /> Quick Peer Sets:
          </span>
          {PRESET_PEERS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => loadPreset(preset)}
              className="rounded-none border border-border/80 bg-card/60 px-3 py-1 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-muted"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {symbols.length < 4 && !showPicker && (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1.5 rounded-none border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Company ({symbols.length}/4)
          </button>
        )}
      </div>

      {showPicker && (
        <div className="rounded-none border border-border bg-card p-4 shadow-sm animate-in fade-in-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-foreground">Select a Company to Compare</h4>
            <button
              onClick={() => setShowPicker(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-w-md">
            <CompanyPicker
              value={null}
              onPick={handleAdd}
              label="Search by company name or NSE ticker"
            />
          </div>
        </div>
      )}

      {/* Main Comparison Matrix Grid */}
      <div className={cn("overflow-x-auto rounded-none border border-border bg-card", loading && "opacity-60 transition-opacity")}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 w-48 min-w-44 bg-muted/60 p-3.5 font-semibold text-muted-foreground uppercase text-2xs tracking-wider backdrop-blur">
                Metric / Company
              </th>
              {companies.map((c) => (
                <th key={c.symbol} className="min-w-56 p-3.5 border-l border-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/company/${c.symbol}`}
                        className="font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {c.symbol}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                      <div className="text-2xs text-muted-foreground line-clamp-1">{c.name}</div>
                      <span className="mt-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-3xs text-secondary-foreground font-mono">
                        {c.sector || "Unclassified"}
                      </span>
                    </div>
                    {symbols.length > 1 && (
                      <button
                        onClick={() => handleRemove(c.symbol)}
                        title={`Remove ${c.symbol}`}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border/40 flex items-baseline justify-between">
                    <div>
                      <span className="text-sm font-semibold font-mono">{fmtNum(c.price, "", "₹")}</span>
                    </div>
                    {c.changePct !== null && (
                      <span
                        className={cn(
                          "flex items-center text-2xs font-mono font-medium",
                          c.changePct >= 0 ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {c.changePct >= 0 ? (
                          <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-0.5" />
                        )}
                        {c.changePct >= 0 ? "+" : ""}
                        {fmtNum(c.changePct, "%")}
                      </span>
                    )}
                  </div>
                  <div className="text-3xs text-muted-foreground font-mono mt-0.5">
                    M-Cap: {fmtNum(c.marketCapCr, " Cr", "₹")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60 font-mono">
            {/* --- Valuation Section --- */}
            <tr className="bg-muted/20 font-sans">
              <td colSpan={companies.length + 1} className="p-2 text-2xs font-semibold text-primary uppercase tracking-wider">
                1. Valuation Multiples
              </td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                P/E Ratio (Trailing)
              </td>
              {companies.map((c) => {
                const val = c.valuation?.peRatio;
                const isBest = peHighlight.best === c.symbol;
                return (
                  <td key={c.symbol} className={cn("p-3 border-l border-border/60", isBest && "bg-emerald-500/10 font-bold text-emerald-500")}>
                    {fmtNum(val, "x")}
                    {isBest && <span className="ml-1 text-3xs font-sans uppercase text-emerald-500">(Lowest)</span>}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                P/B Ratio
              </td>
              {companies.map((c) => {
                const val = c.valuation?.pbRatio;
                const isBest = pbHighlight.best === c.symbol;
                return (
                  <td key={c.symbol} className={cn("p-3 border-l border-border/60", isBest && "bg-emerald-500/10 font-bold text-emerald-500")}>
                    {fmtNum(val, "x")}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                EV / EBITDA
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.valuation?.evToEbitda, "x")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                EV / Sales
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.valuation?.evToSales, "x")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Dividend Yield
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.valuation?.dividendYieldPct, "%")}
                </td>
              ))}
            </tr>

            {/* --- Profitability & Return Ratios --- */}
            <tr className="bg-muted/20 font-sans">
              <td colSpan={companies.length + 1} className="p-2 text-2xs font-semibold text-primary uppercase tracking-wider">
                2. Return Ratios & Quality of Earnings
              </td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Return on Equity (ROE)
              </td>
              {companies.map((c) => {
                const val = c.valuation?.roePct;
                const isBest = roeHighlight.best === c.symbol;
                return (
                  <td key={c.symbol} className={cn("p-3 border-l border-border/60", isBest && "bg-emerald-500/10 font-bold text-emerald-500")}>
                    {fmtNum(val, "%")}
                    {isBest && <span className="ml-1 text-3xs font-sans uppercase text-emerald-500">(Highest)</span>}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                ROCE
              </td>
              {companies.map((c) => {
                const val = c.profitability?.rocePct;
                const isBest = roceHighlight.best === c.symbol;
                return (
                  <td key={c.symbol} className={cn("p-3 border-l border-border/60", isBest && "bg-emerald-500/10 font-bold text-emerald-500")}>
                    {fmtNum(val, "%")}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Operating Margin (OPM)
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.profitability?.opmPct, "%")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Net Profit Margin (NPM)
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.profitability?.npmPct, "%")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                3Y Sales Growth
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.profitability?.salesGrowth3yPct, "%")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                3Y Profit Growth
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.profitability?.profitGrowth3yPct, "%")}
                </td>
              ))}
            </tr>

            {/* --- Balance Sheet & Solvency --- */}
            <tr className="bg-muted/20 font-sans">
              <td colSpan={companies.length + 1} className="p-2 text-2xs font-semibold text-primary uppercase tracking-wider">
                3. Balance Sheet & Solvency
              </td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Debt to Equity
              </td>
              {companies.map((c) => {
                const val = c.balanceSheet?.debtToEquity;
                const isBest = deHighlight.best === c.symbol;
                return (
                  <td key={c.symbol} className={cn("p-3 border-l border-border/60", isBest && "bg-emerald-500/10 font-bold text-emerald-500")}>
                    {fmtNum(val, "x")}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Interest Coverage
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.balanceSheet?.interestCoverage, "x")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Total Debt
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.balanceSheet?.totalDebtCr, " Cr", "₹")}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Cash & Equivalents
              </td>
              {companies.map((c) => (
                <td key={c.symbol} className="p-3 border-l border-border/60">
                  {fmtNum(c.balanceSheet?.cashAndEquivalentsCr, " Cr", "₹")}
                </td>
              ))}
            </tr>

            {/* --- Forensics & Quality --- */}
            <tr className="bg-muted/20 font-sans">
              <td colSpan={companies.length + 1} className="p-2 text-2xs font-semibold text-primary uppercase tracking-wider">
                4. Forensic Diagnostics & Health Checks
              </td>
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Piotroski F-Score (0-9)
              </td>
              {companies.map((c) => {
                const score = c.forensics?.piotroskiFScore;
                const rating = c.forensics?.piotroskiRating;
                return (
                  <td key={c.symbol} className="p-3 border-l border-border/60 font-sans">
                    {score !== null && score !== undefined ? (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className={cn("text-xs font-bold", score >= 7 ? "text-emerald-500" : score <= 3 ? "text-rose-500" : "text-amber-500")}>
                          {score}/9
                        </span>
                        <span className="text-3xs text-muted-foreground">({rating ?? ""})</span>
                      </div>
                    ) : "—"}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Altman Z-Score
              </td>
              {companies.map((c) => {
                const z = c.forensics?.altmanZScore;
                const zone = c.forensics?.altmanZone;
                return (
                  <td key={c.symbol} className="p-3 border-l border-border/60 font-sans">
                    {z !== null && z !== undefined ? (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className={cn("text-xs font-bold", zone === "Safe" ? "text-emerald-500" : zone === "Distress" ? "text-rose-500" : "text-amber-500")}>
                          {fmtNum(z)}
                        </span>
                        <span className="text-3xs text-muted-foreground">({zone ?? ""})</span>
                      </div>
                    ) : "—"}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-muted/30">
              <td className="sticky left-0 bg-card p-3 font-sans text-xs text-foreground font-medium">
                Beneish M-Score
              </td>
              {companies.map((c) => {
                const m = c.forensics?.beneishMScore;
                const rating = c.forensics?.beneishRating;
                return (
                  <td key={c.symbol} className="p-3 border-l border-border/60 font-sans">
                    {m !== null && m !== undefined ? (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className={cn("text-xs font-bold", rating === "Low Risk" ? "text-emerald-500" : "text-rose-500")}>
                          {fmtNum(m)}
                        </span>
                        <span className="text-3xs text-muted-foreground">({rating ?? ""})</span>
                      </div>
                    ) : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-2xs text-muted-foreground border-t border-border/40 pt-3">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Compare up to 4 companies simultaneously across vetted NSE data.</span>
        </div>
        <div>
          <span>Lowest valuation and highest returns are highlighted in green. Missing figures are left as —.</span>
        </div>
      </div>
    </div>
  );
}
