import "server-only";

import type { ApiTearSheetData } from "@/lib/api/types";

/**
 * The copilot's offline answer: the company's figures as the data service reports them,
 * arranged around what was asked. It computes nothing the site does not already show and
 * says plainly which questions need a desk or the language model instead.
 */
export interface CopilotBrief {
  title: string;
  markdown: string;
  provenance: string;
  sourceCitations: string[];
}

const DASH = "—";
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
const pct = (v: number | null | undefined, digits = 1) => (num(v, digits) === DASH ? DASH : `${num(v, digits)}%`);
const signed = (v: number | null | undefined, digits = 1) =>
  typeof v === "number" && Number.isFinite(v) ? `${v > 0 ? "+" : ""}${num(v, digits)}%` : DASH;
const crore = (v: number | null | undefined) => (num(v, 0) === DASH ? DASH : `₹${num(v, 0)} Cr`);

type Topic = "valuation" | "growth" | "returns" | "ownership" | "estimates";

const TOPIC_WORDS: Record<Topic, string[]> = {
  valuation: ["valuation", "dcf", "p/e", "pe ", "multiple", "fair value", "price"],
  growth: ["growth", "margin", "revenue", "profit", "earnings", "eps", "trend"],
  returns: ["dupont", "roe", "roce", "return on", "leverage", "debt"],
  ownership: ["promoter", "pledg", "sharehold", "governance", "fii", "dii"],
  estimates: ["consensus", "analyst", "target", "broker", "estimate", "surprise"],
};

/** Questions the figures on file cannot answer, and where on the site they are answered. */
const ELSEWHERE: { words: string[]; text: (symbol: string) => string }[] = [
  {
    words: ["option", "put-call", "pcr", "max pain", "gamma", "implied vol", "iv ", "rollover", "open interest"],
    text: () => "Options positioning is on the Derivatives desk (`/derivatives`), read from the live option chain.",
  },
  {
    words: ["stress", "var", "value at risk", "merton", "distance-to-default", "drawdown"],
    text: (s) => `Risk measures from daily prices are on the Quant tab (\`/company/${s}/quant\`).`,
  },
  {
    words: ["supply chain", "supplier", "off-take", "related party", "holding company", "subsidiar", "conglomerate"],
    text: (s) => `Group structure and supply chain, where compiled, are on the Network tab (\`/company/${s}/network\`).`,
  },
  {
    words: ["repo", "rbi", "yield", "g-sec", "sovereign", "inflation", "macro"],
    text: () => "Rates and macro series are on the Macro desk (`/macro`).",
  },
];

function sections(sheet: ApiTearSheetData): Record<Topic, string> {
  const { trading_stats: t, multiples: m, returns_on_capital: r, growth: g, analyst_consensus: c } = sheet;
  const holding = sheet.shareholding_trend[sheet.shareholding_trend.length - 1];
  const latest = sheet.financials[sheet.financials.length - 1];

  const growthRows = g.metrics.map((x) => `| ${x.metric} | ${signed(x.cagr_pct)} | ${signed(x.latest_yoy_pct)} |`).join("\n");

  return {
    valuation: [
      "### Valuation `[EXCHANGE DATA]`",
      `| Measure | Value |\n|---|---|`,
      `| Price | ₹${num(t.current_price)} (${signed(t.change_pct, 2)} today) |`,
      `| Market cap | ${crore(t.market_cap_cr)} |`,
      `| P/E (trailing) | ${num(m.pe_ttm)}${m.eps_basis ? `, EPS ₹${num(m.eps_ttm)} over the ${m.eps_basis}` : ""} |`,
      `| P/E (forward) | ${num(m.pe_forward)} |`,
      `| Price to book | ${num(m.price_to_book)} |`,
      `| EV/EBITDA | ${num(m.ev_ebitda)} |`,
      `| Dividend yield | ${pct(m.dividend_yield_pct, 2)} |`,
      `| 52-week range | ₹${num(t.week_52_low, 0)} to ₹${num(t.week_52_high, 0)} |`,
      "",
      `A discounted cash flow built on the company's reported cash flow is on the Valuation tab (\`/company/${sheet.header.symbol}/valuation\`).`,
    ].join("\n"),
    growth: g.metrics.length
      ? [
          `### Growth, ${g.from} to ${g.to} \`[ACTUAL FILING]\``,
          `| Metric | ${g.span_years}Y CAGR | Latest year |\n|---|---|---|`,
          growthRows,
          latest
            ? `\nLatest year (${latest.fiscal_year}): revenue ${crore(latest.revenue_cr)}, net profit ${crore(latest.pat_cr)}, operating margin ${pct(latest.operating_margin_pct)}, net margin ${pct(latest.pat_margin_pct)}.`
            : "",
          g.latest_quarter
            ? `${g.latest_quarter.quarter}: revenue ${signed(g.latest_quarter.revenue_yoy_pct)} and net profit ${signed(g.latest_quarter.net_profit_yoy_pct)} on the year-ago quarter.`
            : "",
        ].join("\n")
      : "### Growth\nAnnual financials are not available from the data sources for this company.",
    returns: [
      `### Returns and leverage${r.basis ? ` \`[${r.basis}]\`` : ""}`,
      `| Measure | Value |\n|---|---|`,
      `| Return on equity | ${pct(r.roe_pct)} |`,
      `| Return on capital employed | ${pct(r.roce_pct)} |`,
      `| Net margin (latest year) | ${pct(latest?.pat_margin_pct)} |`,
      `| Debt to equity | ${num(r.debt_to_equity)}x |`,
      `| Current ratio | ${num(r.current_ratio)}x |`,
      "",
      "A full DuPont split also needs asset turnover, which is not carried in this summary; the Statements tab has the balance sheet.",
    ].join("\n"),
    ownership: holding
      ? [
          `### Shareholding, ${holding.quarter} \`[ACTUAL FILING]\``,
          `| Holder | Stake |\n|---|---|`,
          `| Promoters | ${pct(holding.promoter_holding_pct, 2)} |`,
          `| Foreign institutions | ${pct(holding.fii_holding_pct, 2)} |`,
          `| Domestic institutions | ${pct(holding.dii_holding_pct, 2)} |`,
          `| Public | ${pct(holding.public_holding_pct, 2)} |`,
          sheet.promoter_pledge_status
            ? `\nShares pledged: ${pct(sheet.promoter_pledge_status.pledged_pct_of_total, 2)} of total${sheet.promoter_pledge_status.as_of ? ` (as of ${sheet.promoter_pledge_status.as_of})` : ""}.`
            : "\nPledge data is not available for this company.",
        ].join("\n")
      : "### Shareholding\nThe shareholding pattern is not available from the data sources for this company.",
    estimates: c
      ? [
          "### Analyst estimates `[CONSENSUS ESTIMATE]`",
          `Median target ₹${num(c.target_price.median)} (range ₹${num(c.target_price.low, 0)} to ₹${num(c.target_price.high, 0)}), ${signed(c.target_price.implied_upside_pct)} against the current price, from ${c.total_coverage ?? DASH} analysts.`,
          `Ratings: ${c.ratings_breakdown.buy} buy, ${c.ratings_breakdown.hold} hold, ${c.ratings_breakdown.sell} sell.`,
          "These are brokers' opinions collected by Yahoo Finance, not Arthdex views.",
        ].join("\n")
      : "### Analyst estimates\nNo analyst coverage is reported for this company.",
  };
}

export function buildBrief(prompt: string, sheet: ApiTearSheetData): CopilotBrief {
  const q = ` ${prompt.toLowerCase()} `;
  const all = sections(sheet);
  const asked = (Object.keys(TOPIC_WORDS) as Topic[]).filter((topic) => TOPIC_WORDS[topic].some((w) => q.includes(w)));
  const order: Topic[] = asked.length ? asked : ["valuation", "growth", "returns", "ownership", "estimates"];
  const pointers = ELSEWHERE.filter((e) => e.words.some((w) => q.includes(w))).map((e) => `- ${e.text(sheet.header.symbol)}`);

  const parts = [
    "> Information only. Arthdex is not a SEBI-registered investment adviser or research analyst, and nothing here is a recommendation.",
    `## ${sheet.header.name} (${sheet.header.symbol})`,
    [sheet.header.sector, sheet.header.sub_industry].filter(Boolean).join(" · "),
    ...order.map((topic) => all[topic]),
  ];
  if (pointers.length) {
    parts.push("### Not answered from these figures", pointers.join("\n"));
  }
  parts.push(
    asked.length || pointers.length
      ? "_This is the offline mode: it reports the figures on file and does not interpret them. Switch to the AI mode for a written analysis grounded in the same figures._"
      : "_The offline mode found no specific topic in the question, so this is the full summary. Switch to the AI mode for a written analysis grounded in the same figures._",
  );
  if (sheet.unavailable.length) parts.push(`_No source response for: ${sheet.unavailable.join(", ")}._`);

  return {
    title: `${sheet.header.symbol}: figures on file`,
    markdown: parts.filter(Boolean).join("\n\n"),
    provenance: "NSE, YAHOO FINANCE AND SCREENER.IN FIGURES, DELAYED",
    sourceCitations: ["NSE quote and shareholding disclosures", "Yahoo Finance statements and analyst estimates", "screener.in financials and peers"],
  };
}

/** Compact grounding for the language model: the same figures, as data. */
export function groundingFor(sheet: ApiTearSheetData): string {
  const slim = {
    company: { symbol: sheet.header.symbol, name: sheet.header.name, sector: sheet.header.sector, industry: sheet.header.sub_industry },
    price: sheet.trading_stats,
    multiples: sheet.multiples,
    returns_on_capital: sheet.returns_on_capital,
    annual_financials_inr_crore: sheet.financials,
    growth: sheet.growth,
    peers: sheet.peers,
    shareholding: sheet.shareholding_trend.slice(-4),
    pledge: sheet.promoter_pledge_status,
    analyst_consensus: sheet.analyst_consensus,
    sections_with_no_data: sheet.unavailable,
  };
  return JSON.stringify(slim);
}
