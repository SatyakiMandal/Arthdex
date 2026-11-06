"use client";

import { useState } from "react";
import {
  Rocket,
  ArrowUpRight,
  Sparkles,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Percent,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function SmeMarketsDesk() {
  const [activeTab, setActiveTab] = useState<"IPOS" | "MIGRATION" | "SCREENER">("IPOS");
  const [filterExchange, setFilterExchange] = useState<"ALL" | "NSE_EMERGE" | "BSE_SME">("ALL");

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      {/* Top Overview KPI Ribbons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Total SME Listed Companies</span>
          <div className="text-lg font-bold text-foreground mt-1">942 Scrips</div>
          <span className="text-3xs text-muted-foreground">NSE Emerge (512) • BSE SME (430)</span>
        </div>

        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Aggregate SME Market Cap</span>
          <div className="text-lg font-bold text-accent mt-1">₹1,48,200 Cr</div>
          <span className="text-3xs text-muted-foreground">Average Ticket: ₹1.25 Lakh / Lot</span>
        </div>

        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Active &amp; Upcoming SME IPOs</span>
          <div className="text-lg font-bold text-foreground mt-1">8 Issues</div>
          <span className="text-3xs text-emerald-400">Total pipeline: ₹425 Cr</span>
        </div>

        <div className="p-3 border border-border bg-surface">
          <span className="text-3xs text-muted-foreground uppercase font-bold">Migrated to Mainboard (LTM)</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">26 Companies</div>
          <span className="text-3xs text-muted-foreground">Transitioned to NSE/BSE Main</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface-muted/20">
        <button
          type="button"
          onClick={() => setActiveTab("IPOS")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "IPOS"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Rocket className="h-3.5 w-3.5" />
          <span>SME IPO PIPELINE &amp; SUBSCRIPTION MULTIPLES</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("MIGRATION")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "MIGRATION"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span>MAINBOARD MIGRATION RADAR (ELIGIBILITY 3Y+)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("SCREENER")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 border-b-2 font-bold uppercase text-2xs tracking-wider transition-colors",
            activeTab === "SCREENER"
              ? "border-accent text-accent bg-surface"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>SME ACTIVE BOARD SCREENER</span>
        </button>
      </div>

      {/* TAB 1: SME IPO PIPELINE */}
      {activeTab === "IPOS" && (
        <div className="border border-border bg-surface p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold text-muted-foreground uppercase">
            <span>ACTIVE &amp; FORTHCOMING SME OFFERINGS (NSE EMERGE / BSE SME)</span>
            <span className="text-accent font-bold">SEBI MINIMUM LOT SIZE ENFORCED</span>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-2xs">
              <thead>
                <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                  <th className="py-1.5 px-2">ISSUER</th>
                  <th className="py-1.5 px-2">BOARD</th>
                  <th className="py-1.5 px-2 text-right">ISSUE (₹ CR)</th>
                  <th className="py-1.5 px-2 text-right">PRICE BAND</th>
                  <th className="py-1.5 px-2 text-right">LOT SIZE</th>
                  <th className="py-1.5 px-2 text-right">MIN TICKET</th>
                  <th className="py-1.5 px-2 text-right">QIB</th>
                  <th className="py-1.5 px-2 text-right">NII</th>
                  <th className="py-1.5 px-2 text-right">RETAIL</th>
                  <th className="py-1.5 px-2 text-right">TOTAL SUB</th>
                  <th className="py-1.5 px-2 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  {
                    name: "Apex Precision Castings Ltd",
                    board: "NSE_EMERGE",
                    issueCr: "38.5",
                    price: "₹120 - ₹128",
                    lot: "1,000",
                    ticket: "₹1,28,000",
                    qib: "18.4x",
                    nii: "84.2x",
                    retail: "42.5x",
                    total: "52.8x",
                    status: "OPEN",
                  },
                  {
                    name: "Vidyut Green Logistics Ltd",
                    board: "BSE_SME",
                    issueCr: "24.0",
                    price: "₹85 - ₹90",
                    lot: "1,600",
                    ticket: "₹1,44,000",
                    qib: "12.0x",
                    nii: "45.1x",
                    retail: "28.0x",
                    total: "31.4x",
                    status: "OPEN",
                  },
                  {
                    name: "Kaveri Bio-Agri Solutions",
                    board: "NSE_EMERGE",
                    issueCr: "52.0",
                    price: "₹155 - ₹162",
                    lot: "800",
                    ticket: "₹1,29,600",
                    qib: "-",
                    nii: "-",
                    retail: "-",
                    total: "-",
                    status: "UPCOMING",
                  },
                  {
                    name: "Prism Solar Polymers Ltd",
                    board: "BSE_SME",
                    issueCr: "18.5",
                    price: "₹72 - ₹76",
                    lot: "1,600",
                    ticket: "₹1,21,600",
                    qib: "4.5x",
                    nii: "22.0x",
                    retail: "15.8x",
                    total: "16.2x",
                    status: "CLOSED",
                  },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-surface-muted/50">
                    <td className="py-1.5 px-2 font-bold text-foreground">{row.name}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{row.board.replace("_", " ")}</td>
                    <td className="py-1.5 px-2 text-right text-foreground font-bold">₹{row.issueCr} Cr</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.price}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.lot}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-foreground">{row.ticket}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.qib}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.nii}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.retail}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-accent">{row.total}</td>
                    <td className="py-1.5 px-2 text-right font-bold">
                      <span className={cn(
                        "px-1.5 py-0.5 text-3xs",
                        row.status === "OPEN" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-surface-muted text-muted-foreground"
                      )}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MAINBOARD MIGRATION RADAR */}
      {activeTab === "MIGRATION" && (
        <div className="border border-border bg-surface p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold text-muted-foreground uppercase">
            <span>SEBI / EXCHANGE ELIGIBILITY CRITERIA FOR MAINBOARD MIGRATION</span>
            <span className="text-emerald-400 font-bold">3Y LISTED • PAID CAPITAL &gt; ₹10 CR • NET WORTH &gt; ₹25 CR</span>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-2xs">
              <thead>
                <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                  <th className="py-1.5 px-2">COMPANY</th>
                  <th className="py-1.5 px-2">CURRENT BOARD</th>
                  <th className="py-1.5 px-2 text-right">LISTING DATE</th>
                  <th className="py-1.5 px-2 text-right">PAID-UP CAPITAL</th>
                  <th className="py-1.5 px-2 text-right">NET WORTH</th>
                  <th className="py-1.5 px-2 text-right">2Y PAT POSITIVE</th>
                  <th className="py-1.5 px-2 text-right">MIGRATION STAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  { name: "Dynamic Cables Ltd", board: "BSE_SME", listed: "Dec 2017", paid: "₹22.0 Cr", nw: "₹184 Cr", pat: "Yes (₹31 Cr)", stage: "MIGRATED TO NSE MAIN" },
                  { name: "Altius Finserve Ltd", board: "NSE_EMERGE", listed: "Mar 2021", paid: "₹14.5 Cr", nw: "₹78 Cr", pat: "Yes (₹14 Cr)", stage: "APPLICATION SUBMITTED" },
                  { name: "Suraj Estate Precision", board: "NSE_EMERGE", listed: "Jan 2021", paid: "₹18.0 Cr", nw: "₹112 Cr", pat: "Yes (₹22 Cr)", stage: "ELIGIBLE FOR MIGRATION" },
                  { name: "Nexus Industrial Tech", board: "BSE_SME", listed: "Aug 2020", paid: "₹12.2 Cr", nw: "₹54 Cr", pat: "Yes (₹9.8 Cr)", stage: "BOARD APPROVAL PENDING" },
                ].map((row) => (
                  <tr key={row.name} className="hover:bg-surface-muted/50">
                    <td className="py-1.5 px-2 font-bold text-foreground">{row.name}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{row.board.replace("_", " ")}</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{row.listed}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-foreground">{row.paid}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-foreground">{row.nw}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-400 font-bold">{row.pat}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-accent">{row.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SME ACTIVE BOARD SCREENER */}
      {activeTab === "SCREENER" && (
        <div className="border border-border bg-surface p-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs font-bold text-muted-foreground uppercase">
            <span>HIGH ROCE &amp; LIQUID SME ACTIVE SCRIPS</span>
            <span className="text-muted-foreground">TOP 5 BY VOLUME</span>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-2xs">
              <thead>
                <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                  <th className="py-1.5 px-2">SCRIP</th>
                  <th className="py-1.5 px-2">SECTOR</th>
                  <th className="py-1.5 px-2 text-right">LTP (₹)</th>
                  <th className="py-1.5 px-2 text-right">CHANGE</th>
                  <th className="py-1.5 px-2 text-right">LOT SIZE</th>
                  <th className="py-1.5 px-2 text-right">MCAP (₹ CR)</th>
                  <th className="py-1.5 px-2 text-right">P/E</th>
                  <th className="py-1.5 px-2 text-right">ROCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  { sym: "CUBEFIRST", name: "CubeFirst Infotech", sec: "SaaS & Cloud", ltp: "348.50", chg: "+4.8%", lot: "400", mcap: "420", pe: "24.5", roce: "34.2%" },
                  { sym: "ZENITHAERO", name: "Zenith Aero Precision", sec: "Defense Components", ltp: "512.00", chg: "+2.1%", lot: "250", mcap: "640", pe: "38.0", roce: "28.6%" },
                  { sym: "AGRIFARM", name: "AgriFarm Cold Chain", sec: "Logistics", ltp: "142.20", chg: "-1.2%", lot: "1,000", mcap: "215", pe: "16.8", roce: "19.4%" },
                ].map((s) => (
                  <tr key={s.sym} className="hover:bg-surface-muted/50">
                    <td className="py-1.5 px-2 font-bold text-foreground">
                      {s.sym}
                      <span className="block text-3xs font-normal text-muted-foreground">{s.name}</span>
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground">{s.sec}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-foreground">₹{s.ltp}</td>
                    <td className={cn("py-1.5 px-2 text-right font-bold", s.chg.startsWith("+") ? "text-emerald-400" : "text-destructive")}>
                      {s.chg}
                    </td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{s.lot}</td>
                    <td className="py-1.5 px-2 text-right text-foreground font-bold">₹{s.mcap} Cr</td>
                    <td className="py-1.5 px-2 text-right text-muted-foreground">{s.pe}</td>
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-400">{s.roce}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
