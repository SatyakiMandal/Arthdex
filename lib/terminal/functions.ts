/**
 * Bloomberg Terminal Function Registry & Command Parser for Arthdex
 *
 * Implements the universal command mnemonic model:
 * Pattern: [<SECURITY>] <FUNCTION>
 * Examples:
 *   "RELIANCE DES"   -> Company overview
 *   "TCS FA"         -> Financial statements
 *   "NIFTY OMON"     -> Derivatives option chain
 *   "MOST"           -> Market Watch movers
 *   "BHAV"           -> Daily bhavcopy delivery desk
 *   "PORT"           -> Portfolio & tax harvester
 *   "SURV"           -> Surveillance desk
 *   "GC IN"          -> India Sovereign Yield Curve
 */

export type SecurityType = "EQ" | "IX" | "FUT" | "OPT" | "COMM" | "PORT" | "MACRO" | "GLOBAL";

export interface TerminalFunction {
  code: string;
  name: string;
  description: string;
  category: "Company" | "Derivatives" | "Markets" | "Macro & Rates" | "Portfolio" | "Research" | "Surveillance" | "System";
  contextTypes: SecurityType[];
  requiresSymbol: boolean;
  defaultSymbol?: string;
  route: (symbol?: string) => string;
  aliases: string[];
}

export interface ParsedCommand {
  raw: string;
  symbol: string | null;
  securityType: SecurityType;
  functionCode: string;
  matchedFunction: TerminalFunction | null;
  targetUrl: string | null;
  isValid: boolean;
}

export const TERMINAL_FUNCTIONS: TerminalFunction[] = [
  // --- Company Equity Functions ---
  {
    code: "DES",
    name: "Description & Overview",
    description: "Company overview, valuation multiples, 52W range and peer snapshot",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}`,
    aliases: ["OVERVIEW", "PROFILE", "SUMMARY"],
  },
  {
    code: "FA",
    name: "Financial Analysis",
    description: "Standardised 10-year P&L, balance sheet and cash flow statements",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/statements`,
    aliases: ["FINANCIALS", "STATEMENTS", "PL", "BS", "CF"],
  },
  {
    code: "GP",
    name: "Graph Price / Technicals",
    description: "Multi-timeframe candlestick chart, support/resistance, RSI & MACD",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/technicals`,
    aliases: ["TECH", "CHART", "GRAPH", "INDICATORS"],
  },
  {
    code: "STATS",
    name: "Key Statistics",
    description: "Trading statistics, valuation multiples, enterprise value and margins",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/statistics`,
    aliases: ["STAT", "KEYSTATS", "RATIOS"],
  },
  {
    code: "ANR",
    name: "Analyst Recommendations",
    description: "Sell-side price targets, ratings distribution and earnings revisions",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/analysts`,
    aliases: ["ANALYSTS", "TARGETS", "CONSENSUS"],
  },
  {
    code: "HDS",
    name: "Holders & Shareholding",
    description: "Promoter pledge, FII/DII institutional holdings and insider transactions",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/shareholding`,
    aliases: ["SHR", "SHAREHOLDING", "PROMOTER", "PLEDGE", "INSIDER"],
  },
  {
    code: "FLOW",
    name: "Order Flow & Microstructure",
    description: "Volume profile, cumulative volume delta (CVD) and large print absorption",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/orderflow`,
    aliases: ["OF", "MICRO", "VOLPROFILE", "CVD"],
  },
  {
    code: "DOS",
    name: "Research Dossier",
    description: "Structured multi-pillar forensic dossier and automated valuation model",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/research`,
    aliases: ["DOSSIER", "REPORT", "DEEPDIVE"],
  },
  {
    code: "QNT",
    name: "Quantitative Risk Engine",
    description: "Conformal return forecast, Markov regime, volatility ensemble and VaR/ES",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/quant`,
    aliases: ["QUANT", "RISK", "VAR", "REGIME"],
  },
  {
    code: "HIST",
    name: "Historical Data",
    description: "Full split-adjusted historical OHLCV quotes with CSV export",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/history`,
    aliases: ["HISTORY", "OHLCV", "PRICES"],
  },
  {
    code: "CN",
    name: "Company News & Filings",
    description: "Exchange regulatory filings, corporate announcements and press coverage",
    category: "Company",
    contextTypes: ["EQ"],
    requiresSymbol: true,
    defaultSymbol: "RELIANCE",
    route: (sym = "RELIANCE") => `/company/${sym.toUpperCase()}/macro`,
    aliases: ["CORPNEWS", "FILINGS", "ANNOUNCEMENTS"],
  },

  // --- Derivatives & F&O Functions ---
  {
    code: "OMON",
    name: "Option Chain Monitor",
    description: "Full NSE option chain with Open Interest, Implied Greeks and Strike Walls",
    category: "Derivatives",
    contextTypes: ["IX", "EQ", "FUT"],
    requiresSymbol: false,
    defaultSymbol: "NIFTY",
    route: (sym = "NIFTY") => `/derivatives?symbol=${sym.toUpperCase()}`,
    aliases: ["CHAIN", "OPTIONS", "GREEKS", "OI"],
  },
  {
    code: "BUILD",
    name: "F&O Buildup Quadrant",
    description: "Long buildup, short covering, short buildup and long unwinding scanner",
    category: "Derivatives",
    contextTypes: ["IX", "EQ"],
    requiresSymbol: false,
    route: () => "/derivatives",
    aliases: ["FUTURES", "BUILDUP", "COVERS"],
  },
  {
    code: "FNOB",
    name: "F&O Ban & MWPL Tracker",
    description: "Real-time Market-Wide Position Limit (MWPL) surveillance & lockout tracker",
    category: "Derivatives",
    contextTypes: ["EQ"],
    requiresSymbol: false,
    route: () => "/derivatives",
    aliases: ["BAN", "MWPL", "FNOBAN"],
  },
  {
    code: "PART",
    name: "Participant OI & Positioning",
    description: "FII, DII, Pro vs Retail long/short derivatives positioning, net contracts & sentiment",
    category: "Derivatives",
    contextTypes: ["GLOBAL", "IX", "FUT"],
    requiresSymbol: false,
    route: () => "/participant-oi",
    aliases: ["PARTICIPANT", "INST", "FNO_OI", "FII_OI"],
  },
  {
    code: "OSB",
    name: "Options Strategy Builder",
    description: "Multi-leg option strategy payoffs, Black-Scholes Greeks, breakevens & risk/reward",
    category: "Derivatives",
    contextTypes: ["IX", "EQ", "OPT"],
    requiresSymbol: false,
    defaultSymbol: "NIFTY",
    route: (sym = "NIFTY") => `/strategy-builder?symbol=${sym.toUpperCase()}`,
    aliases: ["STRATEGY", "PAYOFF", "CONDOR", "SPREAD", "STRADDLE"],
  },
  {
    code: "OVDV",
    name: "Volatility Surface & Skew",
    description: "2D strike vs expiry IV surface, 25-Delta risk reversal, butterfly smile & contango",
    category: "Derivatives",
    contextTypes: ["IX", "EQ", "OPT"],
    requiresSymbol: false,
    defaultSymbol: "NIFTY",
    route: (sym = "NIFTY") => `/volatility?symbol=${sym.toUpperCase()}`,
    aliases: ["VOL", "SURFACE", "SKEW", "SMILE", "SVI"],
  },

  // --- Markets & Surveillance Functions ---
  {
    code: "LIVE",
    name: "Live Market Cockpit",
    description: "Real-time high-density institutional cockpit, market breadth & tick radar",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/live",
    aliases: ["COCKPIT", "RADAR", "TERMINAL"],
  },
  {
    code: "MOST",
    name: "Market Movers & Breadth",
    description: "Top gainers, top losers, sector rotation treemap & institutional flows",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/market-watch",
    aliases: ["MOVERS", "GAINERS", "LOSERS", "WATCH"],
  },
  {
    code: "BHAV",
    name: "Daily Bhavcopy & Delivery",
    description: "NSE official settlement file: institutional accumulation & circuit moves",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/bhavcopy",
    aliases: ["BHAVCOPY", "DELIVERY", "ACCUMULATION"],
  },
  {
    code: "SURV",
    name: "Surveillance & Price Bands",
    description: "SEBI/NSE ASM, GSM, Trade-to-Trade (T2T) & Circuit Band restrictions",
    category: "Surveillance",
    contextTypes: ["GLOBAL", "EQ"],
    requiresSymbol: false,
    route: () => "/surveillance",
    aliases: ["ASM", "GSM", "T2T", "CIRCUITS", "SURVEILLANCE"],
  },
  {
    code: "DEAL",
    name: "Bulk & Block Deals",
    description: "Large institutional trade disclosures directly from exchange windows",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/orderflow?tab=deals",
    aliases: ["BLOCK", "BULK", "DEALS"],
  },
  {
    code: "OF",
    name: "Order Flow Microstructure",
    description: "Volume profile, CVD delta imbalances and resting liquidity workbench",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/orderflow",
    aliases: ["ORDERFLOW", "VP", "FOOTPRINT"],
  },
  {
    code: "CMKT",
    name: "Commodities Desk",
    description: "Global & domestic energy, precious metals and industrial commodity contracts",
    category: "Markets",
    contextTypes: ["COMM", "GLOBAL"],
    requiresSymbol: false,
    route: () => "/commodities",
    aliases: ["COMMODITIES", "GOLD", "CRUDE", "SILVER"],
  },

  // --- Macro & Rates Functions ---
  {
    code: "GC",
    name: "Government Yield Curve",
    description: "India Sovereign G-Sec yield curve, T-Bills, 2s10s spread & RBI policy corridor",
    category: "Macro & Rates",
    contextTypes: ["MACRO", "GLOBAL"],
    requiresSymbol: false,
    route: () => "/yield-curve",
    aliases: ["YIELD", "GSEC", "CURVE", "RATES", "BONDS"],
  },
  {
    code: "ECO",
    name: "India Macro & Economics",
    description: "CPI, WPI, GDP, IIP, GST collections, E-Way bills, forex reserves & macro calendar",
    category: "Macro & Rates",
    contextTypes: ["MACRO", "GLOBAL"],
    requiresSymbol: false,
    route: () => "/macro",
    aliases: ["ECON", "MACRO", "INFLATION", "GDP", "CPI"],
  },
  {
    code: "FXM",
    name: "Foreign Exchange & INR Monitor",
    description: "INR spot cross-rates (USD, EUR, GBP, JPY), forward premia, FBIL references & REER",
    category: "Macro & Rates",
    contextTypes: ["MACRO", "GLOBAL"],
    requiresSymbol: false,
    route: () => "/fx",
    aliases: ["FOREX", "CURRENCY", "INR", "USDINR", "REER"],
  },

  // --- Screening & Research Functions ---
  {
    code: "MF",
    name: "Mutual Fund Master & Screener",
    description: "AMFI mutual fund scheme master, CAGRs (1Y, 3Y, 5Y), TER, AUM, Sharpe & Sortino ratios",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/funds",
    aliases: ["MFS", "FUNDS", "MUTUALFUNDS", "AMFI", "NAV"],
  },
  {
    code: "OVLP",
    name: "Fund Portfolio Overlap Analyzer",
    description: "Pairwise mutual fund stock holding overlap percentage and common constituent solver",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/funds?tab=overlap",
    aliases: ["OVERLAP", "DUPLICATION"],
  },
  {
    code: "EQS",
    name: "Fundamental Multi-Factor Screener",
    description: "Vetted fundamental screen with live price multiples and formula engine",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/screener",
    aliases: ["SCREENER", "SCREEN", "FILTER"],
  },
  {
    code: "MACD",
    name: "MACD Crossover Screener",
    description: "Fresh bullish & bearish MACD signal crosses across all bar frequencies",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/screener#macd",
    aliases: ["CROSSOVERS", "MOMENTUM"],
  },
  {
    code: "ANLZ",
    name: "Event Impact Analyzer",
    description: "Causal event-study engine: synthetic control & FinBERT emotion scoring",
    category: "Research",
    contextTypes: ["GLOBAL", "EQ"],
    requiresSymbol: false,
    route: (sym?: string) => (sym ? `/analyzer?symbol=${sym.toUpperCase()}` : "/analyzer"),
    aliases: ["ANALYZER", "EVENTSTUDY", "CEIA"],
  },
  {
    code: "COMP",
    name: "Comparison Matrix",
    description: "Side-by-side fundamental, multiple and growth comparison across peers",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/compare",
    aliases: ["COMPARE", "PEERS", "RV"],
  },
  {
    code: "IPO",
    name: "IPO & Primary Market Pipeline",
    description: "Mainboard & SME IPO pipeline, subscription demand & anchor lock-in dates",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/ipo",
    aliases: ["PRIMARY", "EMERGE", "ISSUES"],
  },
  {
    code: "UNL",
    name: "Unlisted & Pre-IPO Directory",
    description: "Private market valuations, illiquidity discounts and OTC transaction marks",
    category: "Research",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/unlisted",
    aliases: ["UNLISTED", "PREIPO", "STARTUPS"],
  },

  // --- Portfolio & User Functions ---
  {
    code: "PORT",
    name: "Portfolio Terminal & Tax Harvester",
    description: "Newton-Raphson XIRR solver, sector weights and Section 112A tax harvesting",
    category: "Portfolio",
    contextTypes: ["PORT", "GLOBAL"],
    requiresSymbol: false,
    route: () => "/portfolio",
    aliases: ["PORTFOLIO", "TAX", "XIRR", "HOLDINGS"],
  },
  {
    code: "PAPR",
    name: "Paper Trading Simulator & EMSX",
    description: "Virtual ₹10L cash account, realistic Indian STT/GST regulatory charges & order execution",
    category: "Portfolio",
    contextTypes: ["PORT", "GLOBAL", "EQ"],
    requiresSymbol: false,
    route: () => "/paper-trading",
    aliases: ["EMSX", "PAPER", "SIMULATOR", "EXEC", "TRADE"],
  },
  {
    code: "WL",
    name: "Watchlist Desk",
    description: "Multi-symbol institutional watchlist with real-time price updates",
    category: "Portfolio",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/watchlist",
    aliases: ["WATCHLIST", "LISTS"],
  },
  {
    code: "ALRT",
    name: "Alerts Workbench",
    description: "Custom metric triggers, price breakout alerts and notification delivery",
    category: "Portfolio",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/alerts",
    aliases: ["ALERTS", "BELL", "TRIGGERS"],
  },
  {
    code: "TRK",
    name: "Track Record",
    description: "Objective trade calls scored against benchmark at 1D, 5D and 20D intervals",
    category: "Portfolio",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/track-record",
    aliases: ["TRACK", "JOURNAL", "LOGBOOK"],
  },

  // --- Corporate Actions & News Functions ---
  {
    code: "ERN",
    name: "Results Season Scorecard",
    description: "Quarterly earnings beat/miss, implied move straddles and reporting schedule",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/results",
    aliases: ["RESULTS", "EARNINGS", "SCORECARD"],
  },
  {
    code: "CAL",
    name: "Corporate Action Calendar",
    description: "Ex-dividend dates, stock splits, bonus issues, buybacks and board meetings",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/calendar",
    aliases: ["CALENDAR", "DIVIDENDS", "SPLITS"],
  },
  {
    code: "CAT",
    name: "Upcoming Market Catalysts",
    description: "Calendar of high-impact regulatory, earnings and macroeconomic events",
    category: "Markets",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/catalysts",
    aliases: ["CATALYSTS", "EVENTS"],
  },
  {
    code: "NEWS",
    name: "Regulatory Filings & Market News",
    description: "Real-time NSE regulatory disclosures, corporate actions and financial press",
    category: "System",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/news",
    aliases: ["N", "FILINGS", "DISCLOSURES"],
  },
  {
    code: "BRIEF",
    name: "Morning Market Briefing",
    description: "Executive pre-market briefing: global cues, SGX/GIFT Nifty, FII flows & F&O ban",
    category: "System",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/briefing",
    aliases: ["BRIEFING", "MORNING", "ROUNDUP"],
  },
  {
    code: "METH",
    name: "Methodology & Provenance",
    description: "Mathematical formulations, reconciliation models and data source audits",
    category: "System",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/methodology",
    aliases: ["METHODOLOGY", "AUDIT", "SOURCES"],
  },
  {
    code: "STAT",
    name: "System & Exchange Feed Status",
    description: "Live telemetry, watchdog health checks, latency gauges and cache status",
    category: "System",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/status",
    aliases: ["STATUS", "HEALTH", "FEEDS"],
  },
  {
    code: "HELP",
    name: "Terminal Academy & Command Directory",
    description: "Complete command encyclopedia, Bloomberg syntax tutor, keyboard shortcuts and workflows",
    category: "System",
    contextTypes: ["GLOBAL"],
    requiresSymbol: false,
    route: () => "/help",
    aliases: ["LEARN", "MANUAL", "COMMANDS", "GUIDE", "TUTORIAL", "DIR", "DOCS"],
  },
];

/**
 * Parses user input into symbol, security type, and terminal function.
 * Recognised patterns:
 *   "RELIANCE DES"
 *   "TCS FA"
 *   "NIFTY OMON"
 *   "MOST"
 *   "BHAV"
 *   "PORT"
 *   "SURV"
 *   "GC IN"
 */
export function parseTerminalCommand(rawInput: string): ParsedCommand {
  const cleaned = rawInput.trim();
  if (!cleaned) {
    return {
      raw: "",
      symbol: null,
      securityType: "GLOBAL",
      functionCode: "",
      matchedFunction: null,
      targetUrl: null,
      isValid: false,
    };
  }

  const tokens = cleaned.split(/\s+/).map((t) => t.toUpperCase());

  // 1. Single Token command: e.g. "MOST", "BHAV", "PORT", "SURV", "HELP"
  if (tokens.length === 1) {
    const singleCode = tokens[0];
    const directMatch = TERMINAL_FUNCTIONS.find(
      (f) => f.code === singleCode || f.aliases.includes(singleCode)
    );

    if (directMatch) {
      return {
        raw: cleaned,
        symbol: null,
        securityType: directMatch.contextTypes[0] ?? "GLOBAL",
        functionCode: directMatch.code,
        matchedFunction: directMatch,
        targetUrl: directMatch.route(directMatch.defaultSymbol),
        isValid: true,
      };
    }

    // Single token is a ticker: defaults to DES overview
    return {
      raw: cleaned,
      symbol: singleCode,
      securityType: "EQ",
      functionCode: "DES",
      matchedFunction: TERMINAL_FUNCTIONS[0], // DES
      targetUrl: `/company/${singleCode}`,
      isValid: true,
    };
  }

  // 2. Multi-token command: e.g. "RELIANCE DES", "NIFTY OMON", "GC IN", "IN10Y GC"
  let possibleSymbol: string | null = null;
  let possibleCode: string = "";

  // Check if first token is a known function
  const firstAsFunc = TERMINAL_FUNCTIONS.find(
    (f) => f.code === tokens[0] || f.aliases.includes(tokens[0])
  );

  if (firstAsFunc && !firstAsFunc.requiresSymbol) {
    // e.g. "GC IN", "OMON NIFTY"
    possibleCode = firstAsFunc.code;
    possibleSymbol = tokens[1] ?? null;
  } else {
    // Normal Bloomberg style: "<TICKER> <FUNCTION>", e.g. "RELIANCE DES"
    possibleSymbol = tokens[0];
    possibleCode = tokens[1];
  }

  const funcMatch = TERMINAL_FUNCTIONS.find(
    (f) => f.code === possibleCode || f.aliases.includes(possibleCode)
  );

  if (funcMatch) {
    return {
      raw: cleaned,
      symbol: possibleSymbol,
      securityType: funcMatch.contextTypes[0] ?? "EQ",
      functionCode: funcMatch.code,
      matchedFunction: funcMatch,
      targetUrl: funcMatch.route(possibleSymbol ?? funcMatch.defaultSymbol),
      isValid: true,
    };
  }

  // Fallback: If second token isn't recognized, assume first is symbol and open DES
  return {
    raw: cleaned,
    symbol: tokens[0],
    securityType: "EQ",
    functionCode: "DES",
    matchedFunction: TERMINAL_FUNCTIONS[0],
    targetUrl: `/company/${tokens[0]}`,
    isValid: true,
  };
}

/**
 * Filter functions for autocomplete based on user query
 */
export function searchFunctions(query: string): TerminalFunction[] {
  const q = query.trim().toUpperCase();
  if (!q) return TERMINAL_FUNCTIONS.slice(0, 8);

  return TERMINAL_FUNCTIONS.filter(
    (f) =>
      f.code.includes(q) ||
      f.name.toUpperCase().includes(q) ||
      f.description.toUpperCase().includes(q) ||
      f.aliases.some((a) => a.includes(q))
  ).slice(0, 8);
}
