import { cn } from "@/lib/utils";
import type { ApiFundScreenerResponse } from "@/lib/api/types";

export interface FundFilters {
  category: string;
  sub_category: string;
  plan: string;
  option: string;
  q: string;
  sort: string;
}

const DASH = "—";
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${num(v)}%` : DASH);
const tone = (v: number | null | undefined) => (typeof v !== "number" || v === 0 ? "text-muted-foreground" : v > 0 ? "text-up" : "text-down");
const field = "border border-border bg-surface-muted px-2 py-1 text-2xs text-foreground focus:border-accent focus:outline-none";

/**
 * The screener is a plain GET form: choosing filters reloads the page with them in the
 * address, so a filtered view can be bookmarked and works without client-side script.
 */
export function FundScreenerDesk({ data, filters }: { data: ApiFundScreenerResponse; filters: FundFilters }) {
  const subCategories = filters.category && data.categories[filters.category] ? data.categories[filters.category] : [];

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <h1 className="text-base font-bold uppercase tracking-wider text-foreground">Mutual fund screener</h1>
        <span className="text-3xs text-muted-foreground">
          {num(data.totalSchemes, 0)} active schemes • NAVs to {data.asOf} • source: AMFI
        </span>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Scheme or fund house" maxLength={80} className={cn(field, "w-48")} />
        </label>
        <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
          Category
          <select name="category" defaultValue={filters.category} className={field}>
            <option value="">All categories</option>
            {Object.keys(data.categories).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        {subCategories.length ? (
          <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
            Type
            <select name="sub_category" defaultValue={filters.sub_category} className={field}>
              <option value="">All types</option>
              {subCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
          Plan
          <select name="plan" defaultValue={filters.plan} className={field}>
            <option value="Direct">Direct</option>
            <option value="Regular">Regular</option>
            <option value="all">Both</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
          Option
          <select name="option" defaultValue={filters.option} className={field}>
            <option value="Growth">Growth</option>
            <option value="IDCW">IDCW</option>
            <option value="all">Both</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
          Sort by
          <select name="sort" defaultValue={filters.sort} className={field}>
            <option value="schemeName">Name</option>
            <option value="return1yPct">1-year return</option>
            <option value="cagr3yPct">3-year return</option>
            <option value="cagr5yPct">5-year return</option>
          </select>
        </label>
        <button type="submit" className="bg-accent px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-accent-foreground hover:brightness-110">
          Apply
        </button>
      </form>

      <p className="text-3xs text-muted-foreground">
        Showing {data.schemes.length} of {num(data.matched, 0)} matching schemes{data.matched > data.schemes.length ? ". Narrow the filters to see the rest." : "."}
      </p>

      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full text-left text-2xs">
          <thead>
            <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
              <th className="px-2 py-1.5" scope="col">Scheme</th>
              <th className="px-2 py-1.5" scope="col">Type</th>
              <th className="px-2 py-1.5 text-right" scope="col">NAV (₹)</th>
              <th className="px-2 py-1.5 text-right" scope="col">1 year</th>
              <th className="px-2 py-1.5 text-right" scope="col">3 years (a year)</th>
              <th className="px-2 py-1.5 text-right" scope="col">5 years (a year)</th>
              <th className="px-2 py-1.5 text-right" scope="col">NAV date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {data.schemes.map((s) => (
              <tr key={s.schemeCode} className="hover:bg-surface-muted/50">
                <th className="px-2 py-1.5 font-bold" scope="row">
                  {s.schemeName}
                  <span className="ml-2 font-normal text-muted-foreground">{s.plan} • {s.option} • {s.amc}</span>
                </th>
                <td className="px-2 py-1.5 text-muted-foreground">{s.subCategory}</td>
                <td className="px-2 py-1.5 text-right">{num(s.nav, 4)}</td>
                <td className={cn("px-2 py-1.5 text-right font-bold", tone(s.return1yPct))}>{signed(s.return1yPct)}</td>
                <td className={cn("px-2 py-1.5 text-right", tone(s.cagr3yPct))}>{signed(s.cagr3yPct)}</td>
                <td className={cn("px-2 py-1.5 text-right", tone(s.cagr5yPct))}>{signed(s.cagr5yPct)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{s.navDate}</td>
              </tr>
            ))}
            {data.schemes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">No schemes match these filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-3xs text-muted-foreground">
        <p>
          Returns are NAV to NAV for growth options: one year is the simple change, three and five years are annualised. IDCW options show no return because their NAV falls when they pay out. Past returns do not predict future ones, and this is not a recommendation.
        </p>
        {data.returnsMissingFor.length ? <p>AMFI&apos;s history file could not be read for: {data.returnsMissingFor.join(", ")}.</p> : null}
        <ul className="list-disc space-y-0.5 pl-4">
          {Object.values(data.unavailable).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
