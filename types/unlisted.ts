import type { ISODate } from "./common";

export type GovernanceSeverity = "info" | "watch" | "red-flag";

export interface GovernanceFlag {
  id: string;
  severity: GovernanceSeverity;
  category: "audit-remark" | "litigation" | "statutory" | "related-party";
  title: string;
  detail: string;
  source: string;
  reportedOn: ISODate;
}

export type MilestoneKind = "client-win" | "key-hire" | "order-book" | "funding" | "certification";

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  title: string;
  detail: string;
  valueCr?: number;
  occurredOn: ISODate;
}

export interface UnlistedScaleMetrics {
  revenueCagr3yPct: number;
  ebitdaCagr3yPct: number;
  operatingCashFlowCr: number;
  freeCashFlowCr: number;
  totalOrderBookCr: number;
  orderBookToRevenue: number;
}

export type HolderType = "promoter" | "institutional" | "angel" | "employee" | "strategic" | "other";

export interface UnlistedHolder {
  name: string;
  type: HolderType;
  /** Fully diluted ownership, in percent. */
  stakePct: number;
  note?: string;
}

export interface UnlistedFundingRound {
  date: ISODate;
  round: string;
  amountCr: number;
  postMoneyCr?: number;
  pricePerShare?: number;
  investors: string[];
}

/** Cap-table data, entered by hand from filings the operator is entitled to use. */
export interface UnlistedShareholding {
  asOf: ISODate;
  /** Where the figures came from; rendered verbatim. */
  source: string;
  holders: UnlistedHolder[];
  rounds?: UnlistedFundingRound[];
  esopPoolPct?: number;
}

export interface UnlistedCompany {
  /** Optional: absent until someone enters cap-table data. */
  shareholding?: UnlistedShareholding;
  id: string;
  name: string;
  sector: string;
  industry: string;
  lastDealPrice: number;
  impliedValuationCr: number;
  impliedPe: number;
  impliedEvToEbitda: number;
  metrics: UnlistedScaleMetrics;
  governanceFlags: GovernanceFlag[];
  milestones: Milestone[];
  /** Listed tickers used for the side-by-side multiples comparison. */
  listedPeerSymbols: string[];
}
