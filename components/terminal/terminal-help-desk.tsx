"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Terminal,
  BookOpen,
  Search,
  Keyboard,
  Layers,
  Sparkles,
  ArrowRight,
  CornerDownLeft,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Activity,
  Compass,
  HelpCircle,
  BarChart3,
  Scale,
  Zap,
} from "lucide-react";
import { TERMINAL_FUNCTIONS, parseTerminalCommand, TerminalFunction } from "@/lib/terminal/functions";
import { cn } from "@/lib/utils";

export function TerminalHelpDesk() {
  const [activeTab, setActiveTab] = useState<"syntax" | "directory" | "workflows" | "hotkeys">("syntax");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Interactive syntax simulator state
  const [testInput, setTestInput] = useState<string>("RELIANCE DES");
  const parsedTest = parseTerminalCommand(testInput);

  // Filtered command directory
  const filteredCommands = useMemo(() => {
    return TERMINAL_FUNCTIONS.filter((fn) => {
      const matchCat = selectedCategory === "ALL" || fn.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        fn.code.toLowerCase().includes(q) ||
        fn.name.toLowerCase().includes(q) ||
        fn.description.toLowerCase().includes(q) ||
        fn.aliases.some((a) => a.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="w-full max-w-[1920px] px-2 pt-1 pb-4 sm:px-3 lg:px-4 space-y-3 font-mono">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-background/95 py-1.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 px-1.5 py-0.5 text-3xs font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30">
            HELP &lt;GO&gt;
          </span>
          <span className="text-muted-foreground text-2xs">{"//"}</span>
          <h1 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Terminal Academy &amp; Universal Command Directory
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 text-3xs text-muted-foreground border-l border-border pl-2">
            <Compass className="h-3 w-3 text-cyan-400" />
            Bloomberg Syntax Tutor · 40+ Institutional Desks
          </span>
        </div>

        <div className="flex items-center gap-2 text-3xs text-muted-foreground">
          <span className="hidden md:inline">FOCUS COMMAND LINE ANYWHERE:</span>
          <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground font-mono font-bold text-3xs">
            /
          </kbd>
          <span>OR</span>
          <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground font-mono font-bold text-3xs">
            Alt + K
          </kbd>
        </div>
      </div>

      {/* 2. Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("syntax")}
            className={cn(
              "px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider border transition-colors flex items-center gap-1.5",
              activeTab === "syntax"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Terminal className="h-3 w-3" />
            1. Terminal Syntax Tutor
          </button>
          <button
            onClick={() => setActiveTab("directory")}
            className={cn(
              "px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider border transition-colors flex items-center gap-1.5",
              activeTab === "directory"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Layers className="h-3 w-3" />
            2. Command Encyclopedia ({TERMINAL_FUNCTIONS.length})
          </button>
          <button
            onClick={() => setActiveTab("workflows")}
            className={cn(
              "px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider border transition-colors flex items-center gap-1.5",
              activeTab === "workflows"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Zap className="h-3 w-3" />
            3. Trader &amp; Analyst Workflows
          </button>
          <button
            onClick={() => setActiveTab("hotkeys")}
            className={cn(
              "px-2.5 py-1 text-3xs font-semibold uppercase tracking-wider border transition-colors flex items-center gap-1.5",
              activeTab === "hotkeys"
                ? "bg-foreground text-background border-foreground font-bold"
                : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Keyboard className="h-3 w-3" />
            4. Keyboard Shortcuts
          </button>
        </div>

        <div className="text-3xs text-muted-foreground hidden lg:block">
          Universal Command Pattern: [<strong className="text-foreground">SECURITY</strong>] <strong className="text-foreground">FUNCTION</strong> &lt;ENTER&gt;
        </div>
      </div>

      {/* 3. Tab 1: Terminal Syntax & Mental Model Tutor */}
      {activeTab === "syntax" && (
        <div className="space-y-3">
          {/* Mental Model Card */}
          <div className="border border-border bg-card/60 p-3 space-y-2.5">
            <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                How Bloomberg Terminal Syntax Works in Arthdex
              </h2>
            </div>

            <p className="text-2xs text-muted-foreground leading-relaxed font-sans">
              Traditional financial web apps require clicking through complex multi-level menus. Arthdex uses the universal Bloomberg Terminal mnemonic grammar designed for instant, zero-latency execution. Every command follows a deterministic two-part pattern:
            </p>

            {/* Syntax Visual Diagram */}
            <div className="p-3 border border-border bg-muted/20 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-bold text-center">
              <div className="p-2 border border-blue-500/40 bg-blue-500/10 text-blue-400">
                <div className="text-3xs uppercase tracking-widest text-blue-400/80 mb-0.5">SECURITY (Optional)</div>
                <div className="text-sm">RELIANCE / NIFTY / TCS</div>
              </div>
              <span className="text-muted-foreground text-lg">+</span>
              <div className="p-2 border border-amber-500/40 bg-amber-500/10 text-amber-400">
                <div className="text-3xs uppercase tracking-widest text-amber-400/80 mb-0.5">FUNCTION MNEMONIC</div>
                <div className="text-sm">FA / OMON / SURV / GC</div>
              </div>
              <span className="text-muted-foreground text-lg">+</span>
              <div className="p-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <div className="text-3xs uppercase tracking-widest text-emerald-400/80 mb-0.5">ACTION</div>
                <div className="text-sm">&lt;ENTER / GO&gt;</div>
              </div>
              <span className="text-muted-foreground text-lg">=</span>
              <div className="p-2 border border-foreground/40 bg-foreground/10 text-foreground">
                <div className="text-3xs uppercase tracking-widest text-muted-foreground mb-0.5">DIRECT DESTINATION</div>
                <div className="text-sm text-cyan-400">Instant Workbench Launch</div>
              </div>
            </div>

            {/* Three Modes of Commands */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-2xs">
              <div className="border border-border/60 bg-muted/10 p-2 space-y-1">
                <span className="text-3xs uppercase font-bold text-blue-400">1. Security Functions</span>
                <p className="text-3xs text-muted-foreground leading-relaxed">
                  Operate on a specific listed stock or index:
                  <br />
                  <code className="text-amber-400 font-bold">RELIANCE DES</code> → Company Profile
                  <br />
                  <code className="text-amber-400 font-bold">TCS FA</code> → 10-Year Financial Analysis
                  <br />
                  <code className="text-amber-400 font-bold">NIFTY OMON</code> → Option Chain &amp; Walls
                </p>
              </div>

              <div className="border border-border/60 bg-muted/10 p-2 space-y-1">
                <span className="text-3xs uppercase font-bold text-amber-400">2. Standalone Market Desks</span>
                <p className="text-3xs text-muted-foreground leading-relaxed">
                  Market-wide trading desks requiring no symbol prefix:
                  <br />
                  <code className="text-amber-400 font-bold">SURV</code> → SEBI ASM, GSM &amp; Price Bands
                  <br />
                  <code className="text-amber-400 font-bold">GC</code> → Sovereign Yield Curve Desk
                  <br />
                  <code className="text-amber-400 font-bold">MOST</code> → Market Movers &amp; Breadth
                </p>
              </div>

              <div className="border border-border/60 bg-muted/10 p-2 space-y-1">
                <span className="text-3xs uppercase font-bold text-emerald-400">3. Execution &amp; Discovery</span>
                <p className="text-3xs text-muted-foreground leading-relaxed">
                  Workbenches for modeling and execution:
                  <br />
                  <code className="text-amber-400 font-bold">PAPR</code> → Paper Trading Simulator
                  <br />
                  <code className="text-amber-400 font-bold">MF</code> → AMFI Mutual Funds Screener
                  <br />
                  <code className="text-amber-400 font-bold">ECO</code> → India Macroeconomic Desk
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Live Command Simulator Sandbox */}
          <div className="border border-border bg-card/80 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  INTERACTIVE SYNTAX SANDBOX &amp; LIVE COMMAND PARSER
                </span>
              </div>
              <span className="text-3xs text-muted-foreground">Test any command in real time</span>
            </div>

            {/* Simulator Input Box */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="TRY: RELIANCE FA · NIFTY OMON · SURV · GC · PAPR · MF · ECO..."
                  className="w-full bg-background border border-border px-3 py-1.5 font-mono text-sm text-foreground uppercase tracking-wider outline-none focus:border-amber-500"
                />
              </div>

              {parsedTest.targetUrl && (
                <Link
                  href={parsedTest.targetUrl}
                  className="px-3 py-1.5 bg-amber-500 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1 hover:bg-amber-400 transition-colors"
                >
                  <span>EXECUTE &lt;GO&gt;</span>
                  <CornerDownLeft className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Quick Sample Presets */}
            <div className="flex flex-wrap items-center gap-1 text-3xs pt-1">
              <span className="text-muted-foreground font-bold uppercase">PRESETS:</span>
              {[
                "RELIANCE DES",
                "TCS FA",
                "NIFTY OMON",
                "SURV",
                "GC IN",
                "PART",
                "OSB",
                "OVDV",
                "ECO",
                "FXM",
                "MF",
                "PAPR",
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setTestInput(cmd)}
                  className="px-1.5 py-0.5 border border-border bg-muted/20 hover:border-amber-500 hover:text-amber-400 transition-colors text-foreground"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Live Parsing Output Inspector */}
            <div className="mt-2 p-2.5 border border-border/80 bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
              <div>
                <span className="text-3xs uppercase text-muted-foreground block">Recognized Symbol</span>
                <span className="font-bold text-blue-400 font-mono text-xs">
                  {parsedTest.symbol || "NONE (Market-wide)"}
                </span>
              </div>
              <div>
                <span className="text-3xs uppercase text-muted-foreground block">Security Context</span>
                <span className="font-bold text-foreground font-mono text-xs">
                  {parsedTest.securityType}
                </span>
              </div>
              <div>
                <span className="text-3xs uppercase text-muted-foreground block">Matched Function</span>
                <span className="font-bold text-amber-400 font-mono text-xs">
                  {parsedTest.matchedFunction ? parsedTest.matchedFunction.name : "UNKNOWN"}
                </span>
              </div>
              <div>
                <span className="text-3xs uppercase text-muted-foreground block">Destination Route</span>
                <span className="font-bold text-cyan-400 font-mono text-xs truncate block">
                  {parsedTest.targetUrl || "Invalid Command"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab 2: Categorized Command Encyclopedia */}
      {activeTab === "directory" && (
        <div className="space-y-2">
          {/* Search & Category Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card/60 p-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH 40+ MNEMONICS (E.G. FA, OMON, SURV, YIELD, CASH FLOW)..."
                className="w-full bg-background border border-border pl-7 pr-2 py-1 text-xs font-mono text-foreground uppercase tracking-wider outline-none focus:border-amber-500"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-3xs">
              {(["ALL", "Company", "Derivatives", "Markets", "Macro & Rates", "Portfolio", "Research", "System"] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-2 py-1 border transition-colors whitespace-nowrap",
                      selectedCategory === cat
                        ? "bg-amber-500 text-black border-amber-500 font-bold"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Commands Table */}
          <div className="border border-border bg-card/60 overflow-x-auto">
            <table className="w-full text-left text-2xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-3xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-1.5 px-2">Mnemonic</th>
                  <th className="py-1.5 px-2">Category</th>
                  <th className="py-1.5 px-2">Desk Name</th>
                  <th className="py-1.5 px-2">Description &amp; Key Analytics</th>
                  <th className="py-1.5 px-2">Example Command</th>
                  <th className="py-1.5 px-2 text-right">Launch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCommands.map((fn) => {
                  const exampleCmd = fn.requiresSymbol
                    ? `${fn.defaultSymbol || "RELIANCE"} ${fn.code}`
                    : fn.code;
                  const launchUrl = fn.route(fn.defaultSymbol);

                  return (
                    <tr key={fn.code} className="hover:bg-muted/40 transition-colors">
                      <td className="py-1.5 px-2 font-bold text-amber-400 text-xs">
                        {fn.code}
                      </td>
                      <td className="py-1.5 px-2 text-3xs">
                        <span className="px-1.5 py-0.2 border border-border bg-muted/20 text-muted-foreground uppercase">
                          {fn.category}
                        </span>
                      </td>
                      <td className="py-1.5 px-2 font-bold text-foreground font-sans">
                        {fn.name}
                      </td>
                      <td className="py-1.5 px-2 text-3xs text-muted-foreground max-w-sm font-sans">
                        {fn.description}
                      </td>
                      <td className="py-1.5 px-2 text-cyan-400 font-bold">
                        {exampleCmd}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <Link
                          href={launchUrl}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-3xs font-bold uppercase border border-border bg-card hover:bg-muted hover:border-amber-500 hover:text-amber-400 transition-colors"
                        >
                          <span>OPEN</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Tab 3: Institutional Power Workflows */}
      {activeTab === "workflows" && (
        <div className="space-y-2">
          <div className="border border-border bg-card/60 p-2 text-3xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">PROFESSIONAL WORKFLOW BLUEPRINTS: </strong>
            Step-by-step navigational sequences used by Indian buy-side analysts, institutional traders, and quant portfolio managers.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs">
            {/* Workflow 1 */}
            <div className="border border-border bg-card/80 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="font-bold text-amber-400 uppercase tracking-wide">
                  WORKFLOW 1: FUNDAMENTAL EQUITY DUE DILIGENCE
                </span>
                <span className="text-3xs text-muted-foreground">BUY-SIDE RESEARCH</span>
              </div>
              <p className="text-3xs text-muted-foreground font-sans leading-relaxed">
                Complete institutional screening and forensic audit of an equity before taking a high-conviction position.
              </p>
              <div className="space-y-1 font-mono text-3xs">
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">1. RELIANCE DES &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Validate market cap, 52W range &amp; peer snapshot</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">2. RELIANCE FA &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Inspect standardized 10-year P&amp;L, Balance Sheet &amp; Cash Flow</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">3. RELIANCE HDS &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Verify promoter pledge levels, FII/DII accumulation &amp; insider trades</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">4. RELIANCE DOS &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Run multi-pillar automated forensic valuation dossier</span>
                </div>
              </div>
            </div>

            {/* Workflow 2 */}
            <div className="border border-border bg-card/80 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="font-bold text-amber-400 uppercase tracking-wide">
                  WORKFLOW 2: DERIVATIVES VOLATILITY &amp; STRATEGY
                </span>
                <span className="text-3xs text-muted-foreground">F&amp;O DESK</span>
              </div>
              <p className="text-3xs text-muted-foreground font-sans leading-relaxed">
                Derivatives positioning analysis, institutional flow sentiment, skew modeling, and multi-leg risk-reward execution.
              </p>
              <div className="space-y-1 font-mono text-3xs">
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">1. PART &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Check FII vs Client net index contracts &amp; oversold reversal signals</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">2. NIFTY OMON &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Identify Call/Put strike walls, Max Pain &amp; intraday OI build-up</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">3. NIFTY OVDV &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Quantify 25-Delta Risk Reversal skew &amp; term structure contango</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">4. NIFTY OSB &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Build Bull Spread or Iron Condor with Black-Scholes Greeks</span>
                </div>
              </div>
            </div>

            {/* Workflow 3 */}
            <div className="border border-border bg-card/80 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="font-bold text-amber-400 uppercase tracking-wide">
                  WORKFLOW 3: SOVEREIGN RATES &amp; MACRO ALLOCATION
                </span>
                <span className="text-3xs text-muted-foreground">FIXED INCOME &amp; MACRO</span>
              </div>
              <p className="text-3xs text-muted-foreground font-sans leading-relaxed">
                Monitoring inflation, RBI central bank corridor, sovereign par yield curve, and foreign exchange forward premia.
              </p>
              <div className="space-y-1 font-mono text-3xs">
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">1. ECO &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Review headline CPI (5.49%), GDP (6.7%) &amp; GST collections</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">2. GC &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Analyze Nelson-Siegel par curve, 2s10s slope &amp; SDL spreads</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">3. FXM &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Track USD/INR spot, forward premia yields &amp; 40-currency REER</span>
                </div>
              </div>
            </div>

            {/* Workflow 4 */}
            <div className="border border-border bg-card/80 p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <span className="font-bold text-amber-400 uppercase tracking-wide">
                  WORKFLOW 4: VIRTUAL EXECUTION &amp; TAX HARVESTING
                </span>
                <span className="text-3xs text-muted-foreground">PORTFOLIO OPTIMIZATION</span>
              </div>
              <p className="text-3xs text-muted-foreground font-sans leading-relaxed">
                Paper trading with realistic Indian regulatory costs and harvesting Section 112A capital gains deductions.
              </p>
              <div className="space-y-1 font-mono text-3xs">
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">1. PAPR &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Test trade execution with exact STT, GST &amp; Stamp Duty breakdown</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">2. PORT &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Solve true Newton-Raphson XIRR and optimize Section 112A tax savings</span>
                </div>
                <div className="flex items-center gap-2 p-1 bg-muted/20 border border-border/40">
                  <span className="text-amber-400 font-bold">3. MF / OVLP &lt;GO&gt;</span>
                  <span className="text-muted-foreground">→ Eliminate duplicate stock holdings across AMFI mutual funds</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab 4: Keyboard Shortcuts Reference */}
      {activeTab === "hotkeys" && (
        <div className="border border-border bg-card/60 p-3 space-y-3">
          <div className="pb-1 border-b border-border/60 text-xs font-bold text-foreground uppercase tracking-wide flex items-center justify-between">
            <span>ZERO-LATENCY TERMINAL KEYBOARD REFERENCE</span>
            <span className="text-3xs text-muted-foreground">Standardized Bloomberg / Arthdex keybindings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-2xs">
            {/* Global Navigation */}
            <div className="space-y-1.5">
              <div className="text-3xs uppercase font-bold text-amber-400">Command Line Navigation</div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">/</kbd> or <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">`</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Focus Terminal Command Line anywhere</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">Alt + K</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Universal Bloomberg Command Palette</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">F1</kbd> or <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">?</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Toggle Command Directory &amp; Help Desk</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">Enter</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Execute command (&lt;GO&gt;)</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">Escape</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Clear input or dismiss popover/drawer</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <kbd className="px-1.5 py-0.5 bg-muted/40 border border-border text-foreground">↑ / ↓</kbd>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Recall previous command history</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick Jumps */}
            <div className="space-y-1.5">
              <div className="text-3xs uppercase font-bold text-amber-400">Quick Desk Jumps</div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <code className="text-amber-400 font-bold">SURV &lt;GO&gt;</code>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">SEBI Surveillance, ASM, GSM &amp; Price Bands</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <code className="text-amber-400 font-bold">GC &lt;GO&gt;</code>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Sovereign Par Yield Curve &amp; Fixed Income</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <code className="text-amber-400 font-bold">PART &lt;GO&gt;</code>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">NSE Participant OI &amp; Institutional Positioning</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <code className="text-amber-400 font-bold">PAPR &lt;GO&gt;</code>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">Virtual Execution &amp; Statutory Cost Engine</td>
                  </tr>
                  <tr>
                    <td className="py-1 px-1 font-bold text-cyan-400">
                      <code className="text-amber-400 font-bold">MF &lt;GO&gt;</code>
                    </td>
                    <td className="py-1 px-1 text-muted-foreground">AMFI Mutual Fund Screener &amp; Overlap Engine</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Terminal Function Navigators */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-3xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="font-bold uppercase tracking-wider text-foreground">PLATFORM AUDIT &amp; TELEMETRY:</span>
          <Link href="/methodology" className="text-cyan-400 hover:underline">
            METH &lt;GO&gt; (Mathematical Methodology)
          </Link>
          <Link href="/status" className="text-cyan-400 hover:underline">
            STAT &lt;GO&gt; (Exchange Feed Status)
          </Link>
          <Link href="/live" className="text-cyan-400 hover:underline">
            LIVE &lt;GO&gt; (Trading Cockpit)
          </Link>
        </div>

        <div>
          <span>Arthdex Terminal Academy · Inspired by Bloomberg Professional Services</span>
        </div>
      </div>
    </div>
  );
}
