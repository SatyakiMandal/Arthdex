import type { ISODate } from "./common";

export type IpoSegment = "mainboard" | "sme";
export type IpoStatus = "planning" | "upcoming" | "ongoing" | "closed" | "listed";

export interface SubscriptionBook {
  qibX: number;
  niiX: number;
  retailX: number;
  employeeX?: number;
  totalX: number;
}

export interface GmpPoint {
  date: ISODate;
  gmp: number;
  /** GMP expressed against the upper band of the issue price. */
  impliedListingGainPct: number;
}

export interface Ipo {
  id: string;
  name: string;
  segment: IpoSegment;
  status: IpoStatus;
  priceBandLow: number;
  priceBandHigh: number;
  lotSize: number;
  issueSizeCr: number;
  openDate?: ISODate;
  closeDate?: ISODate;
  listingDate?: ISODate;
  subscription?: SubscriptionBook;
  gmpHistory: GmpPoint[];
  listingPrice?: number;
  listingGainPct?: number;
  cmp?: number;
  cmpVsIssuePct?: number;
}

export type AlertCategory = "subscription" | "valuation" | "event" | "price";
export type AlertComparator = "gt" | "gte" | "lt" | "lte";

export interface SubscriptionAlert {
  id: string;
  ipoId: string;
  bucket: "qib" | "nii" | "retail" | "total";
  comparator: AlertComparator;
  thresholdX: number;
  enabled: boolean;
  createdOn: ISODate;
}
