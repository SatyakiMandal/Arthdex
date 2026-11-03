import type { ApiProfile, ApiValuation } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Valuation multiples as reported, set as a ledger.
 *
 * Yahoo omits several of these for many Indian tickers — return on equity in
 * particular. A missing figure renders as an em dash rather than a zero, since
 * "not reported" and "zero" are very different claims.
 */
export function ValuationPanel({ valuation }: { valuation: ApiValuation }) {
  const rows = [
    { label: "Price to earnings", value: valuation.peRatio, digits: 2, suffix: "x" },
    { label: "Price to book", value: valuation.pbRatio, digits: 2, suffix: "x" },
    { label: "EV to EBITDA", value: valuation.evToEbitda, digits: 2, suffix: "x" },
    { label: "EV to sales", value: valuation.evToSales, digits: 2, suffix: "x" },
    { label: "Earnings per share", value: valuation.eps, digits: 2, prefix: "₹" },
    { label: "Book value per share", value: valuation.bookValue, digits: 2, prefix: "₹" },
    { label: "Return on equity", value: valuation.roePct, digits: 1, suffix: "%" },
    { label: "Profit margin", value: valuation.profitMarginPct, digits: 1, suffix: "%" },
    { label: "Dividend yield, last 12 months", value: valuation.dividendYieldPct, digits: 2, suffix: "%" },
  ];
  const missing = rows.filter((row) => row.value === null).length;

  return (
    <div>
      <dl className="grid gap-x-8 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border py-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className={cn("font-mono text-[15px] font-medium tabular-nums", row.value === null && "text-muted-foreground")}>
              {row.value === null ? "—" : `${row.prefix ?? ""}${row.value.toFixed(row.digits)}${row.suffix ?? ""}`}
            </dd>
          </div>
        ))}
      </dl>
      {missing > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          A dash is a figure the data source does not report for this company, not a zero.
        </p>
      ) : null}
    </div>
  );
}

/** What the company does, from its filed profile, with the identifiers a reader may need. */
export function CompanyAbout({ profile }: { profile: ApiProfile }) {
  const facts = [
    { label: "Sector", value: profile.sector },
    { label: "Industry", value: profile.industry },
    { label: "Employees", value: profile.employees ? profile.employees.toLocaleString("en-IN") : null },
    { label: "ISIN", value: profile.isin, mono: true },
  ].filter((fact) => fact.value);
  const site = profile.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  return (
    <div>
      {profile.summary ? (
        <p className="line-clamp-[8] max-w-[65ch] text-pretty text-[15px] leading-relaxed text-foreground/85">
          {profile.summary}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">The data source has no business description for this company.</p>
      )}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className={cn("mt-0.5 text-sm", fact.mono && "font-mono")}>{fact.value}</dd>
          </div>
        ))}
        {profile.website && site ? (
          <div>
            <dt className="text-xs text-muted-foreground">Website</dt>
            <dd className="mt-0.5 text-sm">
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border underline-offset-4 transition-colors hover:decoration-gold"
              >
                {site}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
