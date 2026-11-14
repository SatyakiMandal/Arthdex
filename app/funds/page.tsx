import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { FundScreenerDesk, type FundFilters } from "@/components/funds/fund-screener-desk";
import { DataUnavailable, SourceLine } from "@/components/ui/data-provenance";
import { getFundsScreener } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "Mutual fund screener · Arthdex",
  description: "Every active mutual fund scheme with its latest NAV and one, three and five-year returns, from AMFI's NAV files.",
};

const one = (value: string | string[] | undefined, fallback = "") => (Array.isArray(value) ? value[0] : value) ?? fallback;
const SORTS = ["schemeName", "return1yPct", "cagr3yPct", "cagr5yPct"];
const CHOICE = ["Direct", "Regular", "Growth", "IDCW", "all"];

export default async function FundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters: FundFilters = {
    category: one(sp.category).slice(0, 80),
    sub_category: one(sp.sub_category).slice(0, 120),
    plan: CHOICE.includes(one(sp.plan)) ? one(sp.plan) : "Direct",
    option: CHOICE.includes(one(sp.option)) ? one(sp.option) : "Growth",
    q: one(sp.q).slice(0, 80),
    sort: SORTS.includes(one(sp.sort)) ? one(sp.sort) : "schemeName",
  };
  const res = await getFundsScreener({ ...filters });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1920px] flex-1 px-2 pb-4 pt-2 sm:px-3 lg:px-4">
        {res.ok ? (
          <>
            <FundScreenerDesk data={res.data} filters={filters} />
            <div className="mt-3 px-2">
              <SourceLine meta={res.meta} />
            </div>
          </>
        ) : (
          <div className="py-12">
            <DataUnavailable title="Fund data unavailable" message={res.message} />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
