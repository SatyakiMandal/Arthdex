import type { Metadata } from "next";

import { SourceLine } from "@/components/ui/data-provenance";
import { SmeMarketsDesk } from "@/components/markets/sme-markets-desk";
import { getSmeBoard, getSmeIpos, getSmeOverview } from "@/lib/api/endpoints";

export const metadata: Metadata = {
  title: "SME board (NSE Emerge) · Arthdex",
  description: "Every NSE Emerge security traded today with price, market cap and turnover, and the SME IPO pipeline.",
};

export default async function SmePage() {
  const [overview, board, ipos] = await Promise.all([getSmeOverview(), getSmeBoard(), getSmeIpos()]);

  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">SME board</h1>
        <span className="font-mono text-3xs text-muted-foreground">NSE Emerge • live board and IPO pipeline</span>
      </div>

      <SmeMarketsDesk
        overview={overview.ok ? overview.data : null}
        rows={board.ok ? board.data.rows : []}
        ipos={ipos.ok ? ipos.data.issues : null}
        boardError={overview.ok ? null : overview.message}
        ipoError={ipos.ok ? null : ipos.message}
      />
      {overview.ok ? <SourceLine meta={overview.meta} /> : null}
    </div>
  );
}
