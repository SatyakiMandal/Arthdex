import type { UnlistedCompany } from "@/types";
import dataset from "@/data/unlisted.json";

/**
 * Manually maintained unlisted-equity data.
 *
 * This is the one dataset in Arthdex that is not fetched, and it cannot be.
 * No exchange publishes unlisted share prices, and the dealer sites that carry
 * them prohibit automated access: UnlistedZone's Terms of Use state that users
 * "shall not... Use automated systems (bots, scrapers) without authorization"
 * and may not "Scrape, copy, or systematically extract data".
 *
 * So the records live in `data/unlisted.json`, which is edited by hand. Each
 * carries a `source` and `lastUpdated` that the UI renders, and any record
 * still describing itself as illustrative gets a warning banner. Replacing a
 * record with figures you are entitled to use is a JSON edit, not a code change.
 */

export interface MaintainedUnlistedCompany extends UnlistedCompany {
  /** Where the figures came from. Rendered verbatim in the UI. */
  source: string;
  /** ISO date the record was last edited. Rendered in the UI. */
  lastUpdated: string;
}

const COMPANIES = (dataset as { companies: Record<string, MaintainedUnlistedCompany> }).companies;

export const UNLISTED_COMPANIES = COMPANIES;
export const UNLISTED_IDS = Object.keys(COMPANIES);

export function getUnlistedCompany(id: string): MaintainedUnlistedCompany | undefined {
  return COMPANIES[id.toLowerCase()];
}

export function listUnlistedCompanies(): MaintainedUnlistedCompany[] {
  return Object.values(COMPANIES);
}

/** A record is illustrative until someone replaces it with a real source. */
export function isIllustrative(company: MaintainedUnlistedCompany): boolean {
  return /illustrative|sample/i.test(company.source ?? "");
}

/**
 * Governance risk scoring.
 *
 * Deliberately non-linear: one red flag outweighs a pile of informational
 * notes. A linear count would let a company with many well-documented
 * disclosures score worse than an opaque one that filed nothing.
 */
const SEVERITY_WEIGHT = { "red-flag": 6, watch: 2, info: 0 } as const;

export function governanceScore(company: UnlistedCompany): number {
  return company.governanceFlags.reduce((sum, flag) => sum + SEVERITY_WEIGHT[flag.severity], 0);
}

export function governanceVerdict(company: UnlistedCompany): {
  label: string;
  tone: "up" | "flat" | "down";
} {
  const score = governanceScore(company);
  if (score >= 6) return { label: "Red Flag", tone: "down" };
  if (score >= 2) return { label: "Watchlist", tone: "flat" };
  return { label: "Clean", tone: "up" };
}
