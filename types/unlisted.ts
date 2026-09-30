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

export interface UnlistedCompany {
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
