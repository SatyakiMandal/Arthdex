"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ExportCsv } from "@/components/ui/export-csv";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, formatINR } from "@/lib/utils";
import type { ApiDeal, ApiDeals } from "@/lib/api/types";

type Kind = "bulk" | "block" | "short";
type Side = "all" | "BUY" | "SELL";

const SIDES = [
  { id: "all" as const, label: "All" },
  { id: "BUY" as const, label: "Buy" },
  { id: "SELL" as const, label: "Sell" },
];

export function DealsView({ deals }: { deals: ApiDeals }) {
  const [kind, setKind] = useState<Kind>("bulk");
  const [side, setSide] = useState<Side>("all");
  const [query, setQuery] = useState("");

  const kinds = [
    { id: "bulk" as const, label: `Bulk (${deals.bulk.length})` },
    { id: "block" as const, label: `Block (${deals.block.length})` },
    { id: "short" as const, label: `Short selling (${deals.short.length})` },
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (deals[kind] as ApiDeal[]).filter(
      (d) =>
        (side === "all" || d.side === side) &&
        (!q || d.name.toLowerCase().includes(q) || (d.symbol ?? "").toLowerCase().includes(q) || d.client.toLowerCase().includes(q)),
    );
  }, [deals, kind, side, query]);

  // Net by stock shows where the real pressure is once buys and sells of the same block cancel out
  const netBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals.bulk) {
      if (!d.symbol || d.valueCr == null) continue;
      map.set(d.symbol, (map.get(d.symbol) ?? 0) + (d.side === "BUY" ? d.valueCr : -d.valueCr));
    }
    return map;
  }, [deals.bulk]);

  const label = "mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
        <div>
          <span className={label}>Disclosure</span>
          <SegmentedControl options={kinds} value={kind} onChange={setKind} layoutGroupId="deals-kind" />
        </div>
        <div>
          <span className={label}>Side</span>
          <SegmentedControl options={SIDES} value={side} onChange={setSide} layoutGroupId="deals-side" />
        </div>
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="deals-search" className={label}>
            Stock or client
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="deals-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Edelweiss, a fund name"
              className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60"
            />
          </div>
        </div>
        <ExportCsv
          filename={`arthdex-${kind}-deals`}
          header={["Date", "Symbol", "Company", "Client", "Side", "Quantity", "Avg price", "Value (Cr)", "Remarks"]}
          rows={rows.map((d) => [d.date, d.symbol, d.name, d.client, d.side, d.quantity, d.price, d.valueCr, d.remarks])}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {rows.length} {kind} {kind === "short" ? "disclosures" : "deals"}
          </h2>
          <p className="font-mono text-2xs text-muted-foreground">Largest value first{deals.asOn ? ` · session of ${deals.asOn}` : ""}</p>
        </header>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches those filters.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="data-table data-table-sticky w-full min-w-[820px] text-sm">
              <thead className="text-2xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium">Company</th>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">Side</th>
                  <th className="px-4 py-2 text-right font-medium">Quantity</th>
                  <th className="px-4 py-2 text-right font-medium">Avg price</th>
                  <th className="px-4 py-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => (
                  <tr key={`${d.symbol}-${d.client}-${d.side}-${i}`} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2">
                      {d.symbol ? (
                        <Link href={`/company/${d.symbol}`} className="font-mono text-xs font-semibold hover:text-accent">
                          {d.symbol}
                        </Link>
                      ) : null}
                      <div className="max-w-[240px] truncate text-2xs text-muted-foreground">{d.name}</div>
                    </td>
                    <td className="max-w-[320px] truncate px-4 py-2 text-xs" title={d.client}>
                      {d.client}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-2xs font-semibold",
                          d.side === "BUY" ? "bg-up/10 text-up" : "bg-down/10 text-down",
                        )}
                      >
                        {d.side}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{d.quantity == null ? "n/a" : formatINR(d.quantity, 0)}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">{d.price == null ? "n/a" : `₹${formatINR(d.price, 2)}`}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {d.valueCr == null ? "n/a" : `₹${formatINR(d.valueCr, 2)} Cr`}
                      {kind === "bulk" && d.symbol && netBySymbol.has(d.symbol) && Math.abs(netBySymbol.get(d.symbol)!) < 0.005 ? (
                        <div className="text-2xs font-normal text-muted-foreground">nets to zero today</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
