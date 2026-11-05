"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Calculator,
  Download,
  Flame,
  Info,
  Layers,
  PieChart,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiPortfolioAnalysis, ApiPortfolioLot, ApiTaxHarvestOpportunity } from "@/lib/api/types";
import { CompanyPicker, type PickedCompany } from "@/components/search/company-picker";

// Sample portfolios for instant 1-click exploration
export const SAMPLE_PORTFOLIOS: { name: string; description: string; holdings: Array<{ symbol: string; quantity: number; buyPrice: number; buyDate: string }> }[] = [
  {
    name: "Bluechip Tech & Banking",
    description: "Mix of long-term compounders and recent entry lots with tax-loss harvesting candidates",
    holdings: [
      { symbol: "TCS", quantity: 25, buyPrice: 4200.0, buyDate: "2024-08-15" }, // Unrealized loss (STCG)
      { symbol: "INFY", quantity: 50, buyPrice: 1450.0, buyDate: "2023-05-10" }, // LTCG gain
      { symbol: "HDFCBANK", quantity: 60, buyPrice: 1720.0, buyDate: "2024-06-20" }, // Unrealized loss (STCG)
      { symbol: "ICICIBANK", quantity: 40, buyPrice: 980.0, buyDate: "2023-11-12" }, // LTCG gain
      { symbol: "RELIANCE", quantity: 20, buyPrice: 2850.0, buyDate: "2024-03-05" }, // Long-term lot
      { symbol: "WIPRO", quantity: 80, buyPrice: 560.0, buyDate: "2024-09-01" }, // Unrealized loss
      { symbol: "TATAMOTORS", quantity: 45, buyPrice: 650.0, buyDate: "2023-08-20" }, // LTCG gain
    ],
  },
  {
    name: "High Growth & Industrials",
    description: "Infrastructure, green energy and manufacturing portfolio with varied holding horizons",
    holdings: [
      { symbol: "TATASTEEL", quantity: 150, buyPrice: 165.0, buyDate: "2024-05-15" },
      { symbol: "JSWSTEEL", quantity: 30, buyPrice: 990.0, buyDate: "2024-08-10" },
      { symbol: "MARUTI", quantity: 10, buyPrice: 12500.0, buyDate: "2024-02-14" },
      { symbol: "SUNPHARMA", quantity: 35, buyPrice: 1600.0, buyDate: "2024-04-10" },
      { symbol: "DLF", quantity: 40, buyPrice: 880.0, buyDate: "2024-07-01" },
    ],
  },
];

function fmtINR(val: number | null | undefined, prefix = "₹"): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${prefix}${val.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function PortfolioTerminal({
  initialAnalysis,
}: {
  initialAnalysis: ApiPortfolioAnalysis;
}) {
  const [analysis, setAnalysis] = useState<ApiPortfolioAnalysis>(initialAnalysis);
  const [activeTab, setActiveTab] = useState<"HARVEST" | "LEDGER" | "ALLOCATION">("HARVEST");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [showAddLot, setShowAddLot] = useState(false);
  const [showCsvHelp, setShowCsvHelp] = useState(false);

  // New lot form inputs
  const [isDemoPreset, setIsDemoPreset] = useState<boolean>(true);
  const [pickedCompany, setPickedCompany] = useState<PickedCompany | null>(null);
  const [lotQty, setLotQty] = useState("");
  const [lotPrice, setLotPrice] = useState("");
  const [lotDate, setLotDate] = useState(new Date().toISOString().split("T")[0]);

  // Re-run backend analysis with updated holdings list
  async function runAnalysis(holdingsList: Array<{ symbol: string; quantity: number; buyPrice: number; buyDate: string }>) {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: holdingsList }),
      });
      if (res.ok) {
        const body = (await res.json()) as { data: ApiPortfolioAnalysis };
        if (body.data) {
          startTransition(() => {
            setAnalysis(body.data);
          });
        }
      }
    } catch (e) {
      console.error("Failed to re-analyze portfolio", e);
    } finally {
      setLoading(false);
    }
  }

  function handleAddLot() {
    if (!pickedCompany || !lotQty || !lotPrice) return;
    const qty = parseFloat(lotQty);
    const price = parseFloat(lotPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) return;

    const currentHoldings = (analysis.lots || []).map((l) => ({
      symbol: l.symbol,
      quantity: l.quantity,
      buyPrice: l.buyPrice,
      buyDate: l.buyDate,
    }));

    currentHoldings.push({
      symbol: pickedCompany.id.toUpperCase(),
      quantity: qty,
      buyPrice: price,
      buyDate: lotDate,
    });

    setPickedCompany(null);
    setLotQty("");
    setLotPrice("");
    setShowAddLot(false);
    setIsDemoPreset(false);
    void runAnalysis(currentHoldings);
  }

  function handleDeleteLot(index: number) {
    const currentHoldings = (analysis.lots || []).map((l) => ({
      symbol: l.symbol,
      quantity: l.quantity,
      buyPrice: l.buyPrice,
      buyDate: l.buyDate,
    }));
    currentHoldings.splice(index, 1);
    if (currentHoldings.length === 0) return;
    void runAnalysis(currentHoldings);
  }

  function handleLoadPreset(preset: typeof SAMPLE_PORTFOLIOS[0]) {
    setIsDemoPreset(true);
    void runAnalysis(preset.holdings);
  }

  // Parse CSV file dropped or uploaded by user (e.g. Zerodha, Groww, or generic CSV)
  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) return;

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/['"]/g, ""));
      const symIdx = header.findIndex((h) => h.includes("symbol") || h.includes("scrip") || h.includes("stock"));
      const qtyIdx = header.findIndex((h) => h.includes("quantity") || h.includes("qty") || h.includes("shares"));
      const priceIdx = header.findIndex((h) => h.includes("price") || h.includes("avg") || h.includes("rate"));
      const dateIdx = header.findIndex((h) => h.includes("date") || h.includes("buy"));

      if (symIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
        alert("CSV missing required columns: Symbol, Quantity, Buy Price.");
        return;
      }

      const parsed: Array<{ symbol: string; quantity: number; buyPrice: number; buyDate: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
        const sym = row[symIdx]?.toUpperCase().replace(/[^A-Z0-9&-]/g, "");
        const qty = parseFloat(row[qtyIdx]);
        const price = parseFloat(row[priceIdx]);
        const bDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : new Date().toISOString().split("T")[0];

        if (sym && !isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
          parsed.push({ symbol: sym, quantity: qty, buyPrice: price, buyDate: bDate });
        }
      }

      if (parsed.length > 0) {
        setIsDemoPreset(false);
        void runAnalysis(parsed);
      } else {
        alert("No valid holding rows could be parsed from the CSV file.");
      }
    };
    reader.readAsText(file);
  }

  const { summary, taxHarvesting, sectorAllocation, concentrationAlerts, lots } = analysis;

  return (
    <div className="space-y-6">
      {/* Top action and preset bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" /> Presets:
          </span>
          {SAMPLE_PORTFOLIOS.map((p) => (
            <button
              key={p.name}
              onClick={() => handleLoadPreset(p)}
              className="rounded-none border border-border/80 bg-card/60 px-3 py-1 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-muted"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-none border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
            <UploadCloud className="h-3.5 w-3.5 text-primary" /> Import Broker CSV
            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
          <button
            onClick={() => setShowAddLot(!showAddLot)}
            className="flex items-center gap-1.5 rounded-none border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Holding
          </button>
        </div>
      </div>

      {/* Manual add holding card */}
      {showAddLot && (
        <div className="rounded-none border border-primary/40 bg-card p-4 shadow-sm animate-in fade-in-50 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <h4 className="text-xs font-semibold text-foreground">Add Holding Lot</h4>
            <button
              onClick={() => setShowAddLot(false)}
              className="text-2xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-1">
              <CompanyPicker
                value={pickedCompany}
                onPick={setPickedCompany}
                label="Scrip / Company"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium text-muted-foreground">Quantity</label>
              <input
                type="number"
                value={lotQty}
                onChange={(e) => setLotQty(e.target.value)}
                placeholder="e.g. 50"
                className="w-full rounded-none border border-border bg-background px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium text-muted-foreground">Buy Price (₹)</label>
              <input
                type="number"
                value={lotPrice}
                onChange={(e) => setLotPrice(e.target.value)}
                placeholder="e.g. 1450"
                className="w-full rounded-none border border-border bg-background px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-2xs font-medium text-muted-foreground">Buy Date</label>
              <input
                type="date"
                value={lotDate}
                onChange={(e) => setLotDate(e.target.value)}
                className="w-full rounded-none border border-border bg-background px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAddLot}
              disabled={!pickedCompany || !lotQty || !lotPrice}
              className="rounded-none bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              Add to Portfolio
            </button>
          </div>
        </div>
      )}

      {/* Prominent Sample / Synthetic Data Disclaimer Banner */}
      {isDemoPreset ? (
        <div className="rounded-none border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1.5">
              <div className="font-semibold text-amber-300 uppercase tracking-wider text-2xs flex items-center gap-2">
                <span>SAMPLE DATA DISCLAIMER · DEMO PORTFOLIO LOADED</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-3xs font-mono text-amber-300">ILLUSTRATIVE PRESET</span>
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                The holdings, purchase quantities, costs, and dates shown below are <strong>sample presets</strong> to demonstrate the Newton-Raphson XIRR engine and Section 112A tax-loss harvesting desk. While Current Market Prices (CMPs) are pulled live from NSE quotes, <strong>no personal portfolio data has been uploaded yet</strong>.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-1.5 rounded-none bg-amber-500/25 px-3 py-1.5 text-2xs font-semibold text-amber-200 hover:bg-amber-500/35 cursor-pointer border border-amber-500/40 transition-colors shadow-xs">
                  <UploadCloud className="h-3.5 w-3.5 text-amber-300" /> Import your broker CSV (Zerodha, Groww)
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
                <button
                  onClick={() => setShowAddLot(true)}
                  className="inline-flex items-center gap-1 text-2xs font-medium text-amber-300 hover:underline"
                >
                  <Plus className="h-3 w-3" /> or click &quot;+ Add Holding&quot; to enter your actual scrips
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-none border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-semibold text-emerald-300 text-2xs uppercase tracking-wider">ACTIVE USER PORTFOLIO: </span>
              <span className="text-emerald-200/90">
                Real portfolio returns, true XIRR, and Section 112A tax-loss harvesting computed live on your {lots.length} uploaded holdings.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-none border border-border bg-card p-4">
          <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">Total Invested</div>
          <div className="mt-1 font-mono text-lg font-bold text-foreground">{fmtINR(summary.totalInvested)}</div>
          <div className="text-3xs text-muted-foreground mt-0.5 font-mono">{summary.lotsCount} lots across {summary.uniqueHoldingsCount} stocks</div>
        </div>

        <div className="rounded-none border border-border bg-card p-4">
          <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">Current Value</div>
          <div className="mt-1 font-mono text-lg font-bold text-foreground">{fmtINR(summary.currentValue)}</div>
          <div className="text-3xs text-muted-foreground mt-0.5">Live vetted NSE closes</div>
        </div>

        <div className="rounded-none border border-border bg-card p-4">
          <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">Total Unrealized P&amp;L</div>
          <div
            className={cn(
              "mt-1 font-mono text-lg font-bold flex items-center gap-1",
              summary.totalPnL >= 0 ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {summary.totalPnL >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            {summary.totalPnL >= 0 ? "+" : ""}{fmtINR(summary.totalPnL)}
          </div>
          <div
            className={cn(
              "text-3xs font-mono font-medium mt-0.5",
              summary.totalPnLPct >= 0 ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {summary.totalPnLPct >= 0 ? "+" : ""}{summary.totalPnLPct.toFixed(2)}%
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-4">
          <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
            <Calculator className="h-3.5 w-3.5 text-primary" /> True XIRR
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-primary">
            {summary.xirrPct !== null ? `${summary.xirrPct.toFixed(2)}%` : "—"}
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5">Annualized cash-flow return</div>
        </div>

        <div className="rounded-none border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="text-2xs text-emerald-400 uppercase tracking-wider font-semibold flex items-center gap-1">
            <Flame className="h-3.5 w-3.5" /> Tax Relief Potential
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {fmtINR(taxHarvesting.potentialTaxSavings)}
          </div>
          <div className="text-3xs text-emerald-400/80 mt-0.5">Section 112A Tax-Loss Harvest</div>
        </div>
      </div>

      {/* Concentration Alerts */}
      {concentrationAlerts.length > 0 && (
        <div className="rounded-none border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1.5">
          <div className="font-semibold flex items-center gap-1.5 text-2xs uppercase tracking-wider">
            <ShieldAlert className="h-4 w-4 text-amber-400" /> Portfolio Concentration Warnings
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-2xs">
            {concentrationAlerts.map((alt, i) => (
              <li key={i}>{alt}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab("HARVEST")}
          className={cn(
            "rounded-none px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5",
            activeTab === "HARVEST"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Flame className="h-3.5 w-3.5" /> Tax-Loss Harvester ({taxHarvesting.opportunities.length})
        </button>

        <button
          onClick={() => setActiveTab("LEDGER")}
          className={cn(
            "rounded-none px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5",
            activeTab === "LEDGER"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Briefcase className="h-3.5 w-3.5" /> Holdings Ledger ({lots.length})
        </button>

        <button
          onClick={() => setActiveTab("ALLOCATION")}
          className={cn(
            "rounded-none px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5",
            activeTab === "ALLOCATION"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <PieChart className="h-3.5 w-3.5" /> Sector &amp; Cap Breakdown
        </button>
      </div>

      {/* TAB 1: Tax-Loss Harvesting Desk */}
      {activeTab === "HARVEST" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-none border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-2xs text-muted-foreground uppercase font-semibold">
                <span>Short-Term Capital Gains (STCG &lt; 365 Days)</span>
                <span className="font-mono text-primary font-bold">Tax Rate: 20%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 font-mono text-xs">
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Gains</div>
                  <div className="text-emerald-500 font-semibold">{fmtINR(taxHarvesting.stcg.unrealizedGains)}</div>
                </div>
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Harvestable Losses</div>
                  <div className="text-rose-500 font-semibold">{fmtINR(taxHarvesting.stcg.unrealizedLosses)}</div>
                </div>
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Net Taxable</div>
                  <div className="text-foreground font-semibold">{fmtINR(taxHarvesting.stcg.taxableGain)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-none border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-2xs text-muted-foreground uppercase font-semibold">
                <span>Long-Term Capital Gains (LTCG ≥ 365 Days)</span>
                <span className="font-mono text-primary font-bold">Tax Rate: 12.5%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 font-mono text-xs">
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Gains (Exempt: ₹1.25L)</div>
                  <div className="text-emerald-500 font-semibold">{fmtINR(taxHarvesting.ltcg.unrealizedGains)}</div>
                </div>
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Harvestable Losses</div>
                  <div className="text-rose-500 font-semibold">{fmtINR(taxHarvesting.ltcg.unrealizedLosses)}</div>
                </div>
                <div>
                  <div className="text-3xs text-muted-foreground font-sans">Net Taxable</div>
                  <div className="text-foreground font-semibold">{fmtINR(taxHarvesting.ltcg.taxableGain)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Harvesting Table */}
          <div className="rounded-none border border-border bg-card overflow-hidden">
            <div className="border-b border-border/60 bg-muted/40 p-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-emerald-500" /> Actionable Loss Harvesting Plan
                </h3>
                <p className="text-3xs text-muted-foreground mt-0.5">
                  Sell loss lots to offset gains; reinvest in correlated peers to eliminate wash-sale exposure and maintain sector balance.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">
                Total Relief: {fmtINR(taxHarvesting.potentialTaxSavings)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-2xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-3">Scrip</th>
                    <th className="p-3 text-right">Holding Qty</th>
                    <th className="p-3 text-right">Current Value</th>
                    <th className="p-3 text-right">Unrealized Loss</th>
                    <th className="p-3 text-center">Tax Bucket</th>
                    <th className="p-3 text-right">Estimated Relief</th>
                    <th className="p-3 text-left">Recommended Peer Swap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {taxHarvesting.opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground font-sans">
                        No loss-making holdings eligible for tax harvesting in this portfolio. All lots are sitting on net profits!
                      </td>
                    </tr>
                  ) : (
                    taxHarvesting.opportunities.map((opp, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-sans">
                          <Link href={`/company/${opp.symbol}`} className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                            {opp.symbol}
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          <div className="text-3xs text-muted-foreground">Held {opp.daysHeld} days</div>
                        </td>
                        <td className="p-3 text-right text-foreground">{opp.quantity}</td>
                        <td className="p-3 text-right text-foreground font-medium">{fmtINR(opp.currentValue)}</td>
                        <td className="p-3 text-right text-rose-500 font-semibold">- {fmtINR(opp.unrealizedLoss)}</td>
                        <td className="p-3 text-center">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider",
                              opp.taxBucket === "STCG" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400",
                            )}
                          >
                            {opp.taxBucket} ({opp.taxRatePct}%)
                          </span>
                        </td>
                        <td className="p-3 text-right text-emerald-400 font-bold">
                          +{fmtINR(opp.estimatedTaxSaving)}
                        </td>
                        <td className="p-3 font-sans">
                          <div className="flex flex-wrap gap-1">
                            {opp.recommendedSwaps.length > 0 ? (
                              opp.recommendedSwaps.map((pSym) => (
                                <Link
                                  key={pSym}
                                  href={`/company/${pSym}`}
                                  className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-3xs font-mono font-bold text-primary hover:bg-primary/20"
                                >
                                  {pSym}
                                </Link>
                              ))
                            ) : (
                              <span className="text-3xs text-muted-foreground">Rebalance peer</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Holdings Ledger */}
      {activeTab === "LEDGER" && (
        <div className="rounded-none border border-border bg-card overflow-hidden">
          <div className="border-b border-border/60 bg-muted/40 p-3.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Holdings Ledger &amp; Lot Breakdown ({lots.length} Lots)
            </h3>
            <span className="text-2xs text-muted-foreground">Prices live from NSE</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-2xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-3">Scrip</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Buy Price</th>
                  <th className="p-3 text-right">Buy Date</th>
                  <th className="p-3 text-right">Current Price</th>
                  <th className="p-3 text-right">Invested</th>
                  <th className="p-3 text-right">Current Value</th>
                  <th className="p-3 text-right">Unrealized P&amp;L</th>
                  <th className="p-3 text-center">Tenure / Bucket</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {lots.map((lot, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-sans">
                      <Link href={`/company/${lot.symbol}`} className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                        {lot.symbol}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </td>
                    <td className="p-3 text-right text-foreground">{lot.quantity}</td>
                    <td className="p-3 text-right text-muted-foreground">{fmtINR(lot.buyPrice)}</td>
                    <td className="p-3 text-right text-muted-foreground">{lot.buyDate}</td>
                    <td className="p-3 text-right text-foreground font-semibold">{fmtINR(lot.currentPrice)}</td>
                    <td className="p-3 text-right text-muted-foreground">{fmtINR(lot.investedAmount)}</td>
                    <td className="p-3 text-right text-foreground font-medium">{fmtINR(lot.currentValue)}</td>
                    <td className="p-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center text-xs font-semibold",
                          lot.unrealizedPnL >= 0 ? "text-emerald-500" : "text-rose-500",
                        )}
                      >
                        {lot.unrealizedPnL >= 0 ? "+" : ""}{fmtINR(lot.unrealizedPnL)} ({lot.unrealizedPnLPct >= 0 ? "+" : ""}{lot.unrealizedPnLPct.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider",
                          lot.taxBucket === "STCG" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400",
                        )}
                      >
                        {lot.holdingDays}d ({lot.taxBucket})
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteLot(idx)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete Lot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Sector & Market-Cap Allocation */}
      {activeTab === "ALLOCATION" && (
        <div className="space-y-6">
          <div className="rounded-none border border-border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" /> Sector Weight Distribution
            </h3>

            <div className="space-y-3">
              {sectorAllocation.map((sec) => (
                <div key={sec.sector} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{sec.sector}</span>
                    <span className="font-mono text-muted-foreground">
                      {fmtINR(sec.value)} ({sec.weightPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-none bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-none transition-all",
                        sec.weightPct > 30 ? "bg-amber-500" : "bg-primary",
                      )}
                      style={{ width: `${Math.min(100, sec.weightPct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Privacy Guarantee Note */}
      <div className="rounded-none border border-border/80 bg-muted/20 p-3.5 text-2xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary" />
          <span><strong>Privacy Guarantee:</strong> Portfolio analysis is executed on-the-fly. No bank accounts or broker credentials are requested or stored.</span>
        </div>
        <div className="font-mono text-3xs">
          Budget 2024 Tax Law (STCG 20%, LTCG 12.5%, ₹1.25L Exemption)
        </div>
      </div>
    </div>
  );
}
