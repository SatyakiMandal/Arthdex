import Link from "next/link";

import type { ApiOwnership, ApiOwnershipHolder } from "@/lib/api/types";

const DASH = "—";
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;

function HolderTable({ caption, rows }: { caption: string; rows: ApiOwnershipHolder[] }) {
  return (
    <div className="overflow-x-auto border border-border bg-surface">
      <table className="w-full text-left text-2xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
            <th className="px-2 py-1.5" scope="col">Holder</th>
            <th className="px-2 py-1.5" scope="col">Type</th>
            <th className="px-2 py-1.5 text-right" scope="col">Shares</th>
            <th className="px-2 py-1.5 text-right" scope="col">Stake</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((h) => (
            <tr key={`${h.name}-${h.shares}`} className="hover:bg-surface-muted/50">
              <th className="px-2 py-1.5 font-bold" scope="row">
                {h.symbol ? (
                  <Link href={`/company/${encodeURIComponent(h.symbol)}/network`} className="text-foreground underline decoration-border underline-offset-2 hover:text-accent">
                    {h.name}
                  </Link>
                ) : (
                  h.name
                )}
                {h.symbol ? <span className="ml-2 font-normal text-muted-foreground">NSE: {h.symbol}</span> : null}
              </th>
              <td className="px-2 py-1.5 text-muted-foreground">{h.holderType}</td>
              <td className="px-2 py-1.5 text-right">{num(h.shares, 0)}</td>
              <td className="px-2 py-1.5 text-right font-bold">{h.pct === null ? DASH : `${num(h.pct)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OwnershipView({ data }: { data: ApiOwnership }) {
  const group = data.promoterGroupWithoutShares;

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h2 className="text-base font-bold uppercase tracking-wider text-foreground">Who owns {data.companyName}</h2>
        <span className="text-3xs text-muted-foreground">
          Shareholding filing for the quarter ended {data.asOf ?? DASH}
          {data.filedOn ? `, filed ${data.filedOn}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          ["Promoters and group", data.promoterAndGroupPct === null ? DASH : `${num(data.promoterAndGroupPct)}%`, `${data.promoters.length} with shares`],
          ["Public", data.publicPct === null ? DASH : `${num(data.publicPct)}%`, `${data.publicHoldersAbove1Pct.length} named above 1%`],
          ["Largest promoter", data.promoters[0] ? `${num(data.promoters[0].pct)}%` : DASH, data.promoters[0]?.name ?? "None named"],
          ["Group entities holding nothing", String(data.promoterGroupWithoutSharesCount), "Named in the filing"],
        ].map(([label, value, sub]) => (
          <div key={label} className="border border-border bg-surface p-3">
            <span className="text-3xs font-bold uppercase text-muted-foreground">{label}</span>
            <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
            <span className="line-clamp-1 text-3xs text-muted-foreground" title={sub}>{sub}</span>
          </div>
        ))}
      </div>

      <section className="space-y-2" aria-label="Promoters">
        <h3 className="text-3xs font-bold uppercase text-muted-foreground">Promoters and promoter group, with their holdings</h3>
        {data.promoters.length ? (
          <HolderTable caption="Promoter and promoter-group holders" rows={data.promoters} />
        ) : (
          <p className="border border-border bg-surface p-3 text-2xs text-muted-foreground">The filing names no promoter holding shares. The company may be professionally managed with no identified promoter.</p>
        )}
        {data.promoterNamedTotalPct !== null && data.promoterAndGroupPct !== null ? (
          <p className="text-3xs text-muted-foreground">
            The named holders add up to {num(data.promoterNamedTotalPct)}%, against the filed promoter total of {num(data.promoterAndGroupPct)}%.
          </p>
        ) : null}
      </section>

      <section className="space-y-2" aria-label="Public shareholders above one per cent">
        <h3 className="text-3xs font-bold uppercase text-muted-foreground">Public shareholders above 1%</h3>
        {data.publicHoldersAbove1Pct.length ? (
          <HolderTable caption="Public shareholders holding more than one per cent" rows={data.publicHoldersAbove1Pct} />
        ) : (
          <p className="border border-border bg-surface p-3 text-2xs text-muted-foreground">The filing names no public shareholder above 1%.</p>
        )}
      </section>

      {group.length ? (
        <details className="border border-border bg-surface p-3">
          <summary className="cursor-pointer text-3xs font-bold uppercase text-muted-foreground">
            Promoter-group entities that hold no shares ({data.promoterGroupWithoutSharesCount})
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-2xs text-foreground sm:grid-cols-2 lg:grid-cols-3">
            {group.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {data.promoterGroupWithoutSharesCount > group.length ? (
            <p className="mt-2 text-3xs text-muted-foreground">Showing the first {group.length}.</p>
          ) : null}
        </details>
      ) : null}

      {data.notes ? <p className="text-3xs text-muted-foreground">Company&apos;s note in the filing: {data.notes}</p> : null}

      <div className="space-y-1 text-3xs text-muted-foreground">
        <p>
          Names and stakes are the company&apos;s own disclosure to the exchange.{" "}
          <a href={data.filingUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">Open the filing (XBRL)</a>.
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          {Object.values(data.unavailable).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
