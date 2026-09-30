import type { UnlistedCompany } from "@/types";
import { governanceVerdict } from "@/lib/illustrative/unlisted";
import { cn, formatINR, formatPct } from "@/lib/utils";
import { StatusPill } from "@/components/ui/data-card";

export function UnlistedHeader({ company }: { company: UnlistedCompany }) {
  const verdict = governanceVerdict(company);
  const m = company.metrics;

  const stats = [
    { label: "Implied Valuation", value: `₹${formatINR(company.impliedValuationCr, 0)} Cr` },
    { label: "Implied P/E", value: company.impliedPe.toFixed(1) },
    { label: "EV/EBITDA", value: company.impliedEvToEbitda.toFixed(1) },
    { label: "Order Book", value: `₹${formatINR(m.totalOrderBookCr, 0)} Cr` },
    { label: "Revenue CAGR 3Y", value: formatPct(m.revenueCagr3yPct, 1) },
    { label: "Free Cash Flow", value: `₹${formatINR(m.freeCashFlowCr, 1)} Cr` },
  ];

  return (
    <section className="border-b border-border bg-surface-muted/40">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <span className="rounded border border-flat/40 bg-flat/10 px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wide text-flat">
                Unlisted
              </span>
              <StatusPill label={verdict.label} tone={verdict.tone} />
            </div>
            <p className="mt-1 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              {company.sector} · {company.industry}
            </p>
          </div>

          <div className="text-right">
            <div className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
              Last deal price
            </div>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              ₹{formatINR(company.lastDealPrice, 0)}
            </div>
            <div className="mt-1 font-mono text-2xs text-muted-foreground">
              secondary market · per share
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface px-3 py-2">
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono text-sm font-medium tabular-nums",
                  s.label === "Free Cash Flow" && m.freeCashFlowCr < 0 && "text-down",
                )}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
