import Link from "next/link";
import { ArrowUpRight, History } from "lucide-react";
import { PriceHistoryChart } from "@/components/unlisted/price-history-chart";
import { formatPct } from "@/lib/utils";
import type { ApiUnlistedCompany } from "@/lib/api/types";

/** The private-market price history of a company that has since listed. */
export function PreIpoPanel({ company }: { company: ApiUnlistedCompany }) {
  const last = company.series[company.series.length - 1];
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
            <History className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Before it listed</h2>
            <p className="text-2xs text-muted-foreground">
              Indicative unlisted-market price since {company.firstDate}
              {company.sinceFirstPct != null ? `, ${formatPct(company.sinceFirstPct, 0)} to the last quote` : ""}
              {last ? ` (${last.date})` : ""}
            </p>
          </div>
        </div>
        <Link href={`/unlisted/${company.id}`} className="inline-flex items-center gap-1 text-2xs font-medium text-accent hover:underline">
          Full unlisted profile <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <PriceHistoryChart series={company.series} />
      <p className="text-2xs text-muted-foreground">
        These were dealer-quoted levels in the unlisted market, not exchange prices, so they will not line up exactly with the
        listing price.
      </p>
    </section>
  );
}
