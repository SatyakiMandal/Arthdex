/**
 * Type definitions for Arthdex 14-Language Regional Localization System (M30).
 */

export type SupportedLocale =
  | "en"
  | "hi"
  | "bn"
  | "gu"
  | "mr"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "pa"
  | "or"
  | "as"
  | "raj"
  | "ks";

export interface LocaleMeta {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  bcp47: string;
  script: string;
  lakhScale: string;
  croreScale: string;
  flag?: string;
}

export interface Dictionary {
  meta: LocaleMeta;
  nav: {
    terminal: string;
    marketWatch: string;
    derivatives: string;
    yieldCurve: string;
    surveillance: string;
    commodities: string;
    screener: string;
    corporateNetwork: string;
    macro: string;
    funds: string;
    paperTrading: string;
    academy: string;
  };
  metrics: {
    marketCap: string;
    cmp: string;
    change: string;
    peRatio: string;
    pbRatio: string;
    roe: string;
    volume: string;
    openInterest: string;
    impliedVol: string;
    netProfit: string;
    eps: string;
    yield: string;
    turnover: string;
  };
  commands: {
    execute: string;
    searchPlaceholder: string;
    voiceCommand: string;
    listening: string;
    speakNow: string;
    recognized: string;
    transcribing: string;
    executing: string;
  };
  provenance: {
    actualFiling: string;
    modelled: string;
    indicative: string;
    consensus: string;
  };
}
