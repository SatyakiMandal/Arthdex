import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ApiBuybackResponse } from "@/lib/api/types";

export function BuybackArbitrageDesk({ initialData }: { initialData: ApiBuybackResponse }) {
  const { buybacks, recordDateRule, notShown } = initialData;

  if (buybacks.length === 0) {
    return (
      <p className="border border-border bg-surface p-4 font-mono text-2xs text-muted-foreground">
        NSE&apos;s corporate-actions list shows no buybacks at the moment.
      </p>
    );
  }

  return (
    <div className="space-y-2 font-mono">
      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left text-2xs">
          <caption className="sr-only">Buybacks listed in NSE corporate actions</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-3xs font-bold uppercase text-muted-foreground">
              <th className="px-2 py-1.5" scope="col">Company</th>
              <th className="px-2 py-1.5" scope="col">Action</th>
              <th className="px-2 py-1.5" scope="col">Ex-date</th>
              <th className="px-2 py-1.5" scope="col">Record date</th>
              <th className="px-2 py-1.5 text-right" scope="col">Days to record date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {buybacks.map((b) => (
              <tr key={`${b.symbol}-${b.recordDate}`} className={cn(b.status !== "UPCOMING" && "text-muted-foreground")}>
                <th className="px-2 py-1.5 font-bold" scope="row">
                  {b.symbol ? (
                    <Link href={`/company/${encodeURIComponent(b.symbol)}`} className="hover:text-accent">{b.symbol}</Link>
                  ) : null}
                  <span className="ml-2 font-normal text-muted-foreground">{b.companyName}</span>
                </th>
                <td className="px-2 py-1.5">{b.subject}</td>
                <td className="px-2 py-1.5">{b.exDate ?? "—"}</td>
                <td className="px-2 py-1.5">{b.recordDate ?? "—"}</td>
                <td className="px-2 py-1.5 text-right font-bold">
                  {b.daysToRecordDate === null ? "—" : b.daysToRecordDate >= 0 ? b.daysToRecordDate : "Passed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-3xs text-muted-foreground">{recordDateRule}</p>
      <p className="text-3xs text-muted-foreground">{notShown}</p>
    </div>
  );
}
