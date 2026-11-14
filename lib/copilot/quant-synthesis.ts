/**
 * Copilot roles and suggested questions.
 *
 * The answers are built server-side from the company's own figures (lib/copilot/brief.ts);
 * no company data lives in this file.
 */

export type FinancialRole = "equity_analyst" | "derivatives_trader" | "risk_officer" | "macro_splc";

/** The copilot's header strip for a symbol, read from the live quote and valuation routes. */
export interface StockDossier {
  symbol: string;
  name: string;
  sector: string | null;
  cmp: number;
  changePct: number | null;
  pe: number | null;
  evEbitda: number | null;
  roePct: number | null;
  asOf: string | null;
}

export interface RoleDef {
  id: FinancialRole;
  label: string;
  tagline: string;
  chips: string[];
}

export const FINANCIAL_ROLES: RoleDef[] = [
  {
    id: "equity_analyst",
    label: "Equity Analyst",
    tagline: "DuPont decomposition · margin trends · consensus earnings surprises",
    chips: [
      "DuPont 3-Way & 5-Way Analysis",
      "2-Stage FCFF DCF vs Market Price",
      "Operating Margin Trends & Raw Material Pass-Through",
      "Consensus EPS Surprises & Broker Revisions",
    ],
  },
  {
    id: "derivatives_trader",
    label: "Derivatives Trader",
    tagline: "Max Pain · PCR · IV skew · gamma flip · rollover analysis",
    chips: [
      "Options OI Build-up & Put-Call Ratio",
      "Max Pain & Expiry Gamma Flip Levels",
      "Implied Volatility (IV) Skew & 30-Day Smile",
      "Near-Month vs Next-Month Rollover Velocity",
    ],
  },
  {
    id: "risk_officer",
    label: "Risk Officer",
    tagline: "VaR 99% · stress tests (rates +100bps, crude +20%) · promoter pledging audit",
    chips: [
      "Stress Test: Rates +100bps & Rupee Deprec.",
      "Promoter Pledging & Governance Audit",
      "Parametric & Historical VaR (99% 1-Day)",
      "Merton Distance-to-Default & Debt Barrier",
    ],
  },
  {
    id: "macro_splc",
    label: "Macro & SPLC",
    tagline: "Multi-tier supply chain bottlenecks · sovereign yield curve · RBI repo stance",
    chips: [
      "Supply Chain & Off-Take Bottlenecks",
      "RBI Repo Stance & 10Y Sovereign Yield Spread",
      "Ind AS 24 Note 34 Related Party Transaction Audit",
      "Conglomerate Holding Company Discount Analysis",
    ],
  },
];

export const CORE_INSTITUTIONAL_CHIPS: string[] = [
  "DuPont 3-Way & 5-Way Analysis",
  "2-Stage FCFF DCF vs Market Price",
  "Stress Test: Rates +100bps & Rupee Deprec.",
  "Promoter Pledging & Governance Audit",
  "Supply Chain & Off-Take Bottlenecks",
  "Options OI Build-up & Put-Call Ratio",
];
