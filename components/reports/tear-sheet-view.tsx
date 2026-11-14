"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApiTearSheetData } from "@/lib/api/types";

interface TearSheetViewProps {
  symbol?: string;
  initialData?: ApiTearSheetData | null;
  /** Why there is no sheet, when initialData is null. */
  error?: string | null;
}

const DASH = "—";

/** A figure the sources do not carry prints as a dash, never as a stand-in number. */
function num(value: number | null | undefined, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
}
const rupee = (value: number | null | undefined, digits = 2) => (num(value, digits) === DASH ? DASH : `₹${num(value, digits)}`);
const crore = (value: number | null | undefined) => (num(value, 0) === DASH ? DASH : `₹${num(value, 0)} Cr`);
const pct = (value: number | null | undefined, digits = 1) => (num(value, digits) === DASH ? DASH : `${num(value, digits)}%`);
const signedPct = (value: number | null | undefined, digits = 1) =>
  num(value, digits) === DASH ? DASH : `${(value as number) > 0 ? "+" : ""}${num(value, digits)}%`;
const times = (value: number | null | undefined) => (num(value, 2) === DASH ? DASH : `${num(value, 2)}x`);
const tone = (value: number | null | undefined) =>
  typeof value !== "number" ? "text-muted-foreground" : value >= 0 ? "text-up" : "text-down";

function Section({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1">
        <h3 className="text-xs font-bold uppercase text-foreground">{title}</h3>
        {tag ? <span className="text-3xs font-bold text-accent">{tag}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ what }: { what: string }) {
  return <p className="py-2 text-2xs text-muted-foreground">{what} is not available from the data sources for this company.</p>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <span className="text-3xs font-bold uppercase text-muted-foreground">{label}</span>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
      {sub ? <span className="text-3xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

export function TearSheetView({ symbol = "", initialData = null, error = null }: TearSheetViewProps) {
  const router = useRouter();
  const sym = symbol.toUpperCase();
  const [tickerInput, setTickerInput] = useState(sym);
  const data = initialData;

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tickerInput.trim().toUpperCase();
    if (/^[A-Z0-9&_-]{1,20}$/.test(clean) && clean !== sym) {
      router.push(`/company/${encodeURIComponent(clean)}/tear`);
    }
  };

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-surface p-2.5 print:hidden">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-accent" aria-hidden />
        <span className="font-bold uppercase text-foreground">Company tear sheet</span>
      </div>
      <div className="flex items-center gap-3">
        <form onSubmit={handleTickerSubmit} className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="tear-ticker">Ticker</label>
          <input
            id="tear-ticker"
            type="text"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="TICKER (e.g. TCS)"
            maxLength={20}
            className="w-32 border border-border bg-surface-muted px-2 py-1 text-2xs uppercase text-foreground focus:border-accent focus:outline-none"
          />
          <button type="submit" className="border border-border bg-surface-raised px-2.5 py-1 text-3xs font-bold uppercase text-foreground hover:border-accent">
            Load
          </button>
        </form>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!data}
          className="flex items-center gap-1.5 bg-accent px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-accent-foreground transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          <span>Print / save PDF</span>
        </button>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="w-full space-y-4 font-mono text-xs">
        {toolbar}
        <div className="border border-border bg-surface p-6 text-2xs text-muted-foreground" role="status">
          <p className="font-bold uppercase text-foreground">No tear sheet for {sym || "this symbol"}</p>
          <p className="mt-1">{error ?? "The data service returned no quote for this symbol, so there is nothing to print."}</p>
        </div>
      </div>
    );
  }

  const { header, trading_stats: stats, multiples, returns_on_capital: roc, growth, analyst_consensus: consensus } = data;
  const latestHolding = data.shareholding_trend[data.shareholding_trend.length - 1];
  const ratings = consensus?.ratings_breakdown;
  const ratingTotal = ratings ? ratings.buy + ratings.hold + ratings.sell : 0;
  const share = (n: number) => (ratingTotal ? `${(n / ratingTotal) * 100}%` : "0%");

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-surface-muted/40 p-2.5 text-2xs print:hidden">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span className="font-bold uppercase tracking-wider text-foreground">
            Information only. Arthdex is not a SEBI-registered investment adviser or research analyst.
          </span>
        </div>
        <span className="text-3xs text-muted-foreground">Prices are delayed. Figures come from NSE, Yahoo Finance and screener.in.</span>
      </div>

      {toolbar}

      <div className="space-y-6 border border-border bg-surface p-6 text-foreground shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{header.name}</h2>
              <span className="border border-accent/40 bg-accent/20 px-1.5 py-0.5 text-3xs font-bold text-accent">
                {header.exchange}: {sym}
              </span>
            </div>
            <p className="mt-0.5 text-3xs text-muted-foreground">
              {[header.isin ? `ISIN ${header.isin}` : null, header.sector, header.sub_industry, header.headquarters].filter(Boolean).join(" • ")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{rupee(stats.current_price)}</div>
            <div className={cn("text-3xs font-bold", tone(stats.change_pct))}>{signedPct(stats.change_pct, 2)} today</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-border/80 py-2 md:grid-cols-4">
          <Stat label="Market cap" value={crore(stats.market_cap_cr)} sub={`Enterprise value ${crore(stats.enterprise_value_cr)}`} />
          <Stat
            label="52-week range"
            value={`${rupee(stats.week_52_low, 0)} – ${rupee(stats.week_52_high, 0)}`}
            sub={`Free float ${pct(stats.free_float_pct)}`}
          />
          <Stat label="Valuation" value={`P/E ${num(multiples.pe_ttm)} • P/B ${num(multiples.price_to_book)}`} sub={`EV/EBITDA ${times(multiples.ev_ebitda)} • Fwd P/E ${num(multiples.pe_forward)}`} />
          <Stat
            label="Price return"
            value={`1Y ${signedPct(stats.returns["1Y_pct"])}`}
            sub={`1M ${signedPct(stats.returns["1M_pct"])} • 3M ${signedPct(stats.returns["3M_pct"])} • 6M ${signedPct(stats.returns["6M_pct"])}`}
          />
        </div>

        {header.business_summary ? <p className="line-clamp-4 text-2xs leading-relaxed text-muted-foreground print:line-clamp-6">{header.business_summary}</p> : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Section title={growth.span_years ? `Growth, ${growth.from} to ${growth.to}` : "Growth"} tag="[ACTUAL FILING]">
            {growth.metrics.length ? (
              <table className="w-full text-left text-2xs">
                <thead>
                  <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                    <th className="py-1" scope="col">Metric</th>
                    <th className="py-1 text-right" scope="col">{growth.span_years}Y CAGR</th>
                    <th className="py-1 text-right" scope="col">Latest year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {growth.metrics.map((m) => (
                    <tr key={m.metric}>
                      <th className="py-1 font-bold" scope="row">{m.metric}</th>
                      <td className={cn("py-1 text-right", tone(m.cagr_pct))}>{signedPct(m.cagr_pct)}</td>
                      <td className={cn("py-1 text-right", tone(m.latest_yoy_pct))}>{signedPct(m.latest_yoy_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty what="Annual growth" />
            )}
            {growth.latest_quarter ? (
              <p className="text-3xs text-muted-foreground">
                {growth.latest_quarter.quarter}: revenue {signedPct(growth.latest_quarter.revenue_yoy_pct)} and net profit{" "}
                {signedPct(growth.latest_quarter.net_profit_yoy_pct)} on the same quarter a year earlier.
              </p>
            ) : null}
          </Section>

          <Section title="Returns and balance sheet" tag={roc.basis ? `[${roc.basis}]` : undefined}>
            <div className="grid grid-cols-2 gap-2 text-2xs">
              {[
                ["Return on equity", pct(roc.roe_pct)],
                ["Return on capital employed", pct(roc.roce_pct)],
                ["Debt to equity", times(roc.debt_to_equity)],
                ["Current ratio", times(roc.current_ratio)],
              ].map(([label, value]) => (
                <div key={label} className="border border-border bg-surface-muted/30 p-2">
                  <span className="text-3xs uppercase text-muted-foreground">{label}</span>
                  <div className="mt-0.5 text-sm font-bold text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Annual financials (₹ crore)" tag="[ACTUAL FILING]">
          {data.financials.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-2xs">
                <thead>
                  <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                    <th className="py-1" scope="col">Year</th>
                    <th className="py-1 text-right" scope="col">Revenue</th>
                    <th className="py-1 text-right" scope="col">Growth</th>
                    <th className="py-1 text-right" scope="col">Op. profit</th>
                    <th className="py-1 text-right" scope="col">OPM</th>
                    <th className="py-1 text-right" scope="col">Net profit</th>
                    <th className="py-1 text-right" scope="col">EPS (₹)</th>
                    <th className="py-1 text-right" scope="col">ROE</th>
                    <th className="py-1 text-right" scope="col">D/E</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.financials.map((row) => (
                    <tr key={row.fiscal_year}>
                      <th className="py-1 font-bold" scope="row">{row.fiscal_year}</th>
                      <td className="py-1 text-right">{num(row.revenue_cr, 0)}</td>
                      <td className={cn("py-1 text-right", tone(row.revenue_growth_pct))}>{signedPct(row.revenue_growth_pct)}</td>
                      <td className="py-1 text-right">{num(row.operating_profit_cr, 0)}</td>
                      <td className="py-1 text-right">{pct(row.operating_margin_pct)}</td>
                      <td className="py-1 text-right">{num(row.pat_cr, 0)}</td>
                      <td className="py-1 text-right">{num(row.eps)}</td>
                      <td className="py-1 text-right">{pct(row.roe_pct)}</td>
                      <td className="py-1 text-right">{times(row.debt_to_equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty what="The annual financial summary" />
          )}
        </Section>

        <Section title={data.peer_industry ? `Peers: ${data.peer_industry}` : "Peers"} tag="[EXCHANGE DATA]">
          {data.peers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-2xs">
                <thead>
                  <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                    <th className="py-1" scope="col">Company</th>
                    <th className="py-1 text-right" scope="col">Market cap (₹ Cr)</th>
                    <th className="py-1 text-right" scope="col">P/E</th>
                    <th className="py-1 text-right" scope="col">ROCE</th>
                    <th className="py-1 text-right" scope="col">Div. yield</th>
                    <th className="py-1 text-right" scope="col">Sales growth (qtr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.peers.map((p) => (
                    <tr key={p.symbol} className={p.symbol === sym ? "font-bold text-accent" : undefined}>
                      <th className="py-1 font-[inherit]" scope="row">{p.name ?? p.symbol}</th>
                      <td className="py-1 text-right">{num(p.market_cap_cr, 0)}</td>
                      <td className="py-1 text-right">{num(p.pe_ttm)}</td>
                      <td className="py-1 text-right">{pct(p.roce_pct)}</td>
                      <td className="py-1 text-right">{pct(p.dividend_yield_pct, 2)}</td>
                      <td className="py-1 text-right">{signedPct(p.sales_growth_qtr_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty what="A peer comparison" />
          )}
        </Section>

        <div className="grid grid-cols-1 gap-6 border-t border-border pt-2 md:grid-cols-2">
          <Section title={latestHolding ? `Shareholding, ${latestHolding.quarter}` : "Shareholding"} tag="[ACTUAL FILING]">
            {latestHolding ? (
              <dl className="space-y-1.5 text-2xs">
                {[
                  ["Promoters", latestHolding.promoter_holding_pct],
                  ["Foreign institutions (FII)", latestHolding.fii_holding_pct],
                  ["Domestic institutions (DII)", latestHolding.dii_holding_pct],
                  ["Government", latestHolding.government_holding_pct],
                  ["Public", latestHolding.public_holding_pct],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex justify-between">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-bold text-foreground">{pct(value as number | null, 2)}</dd>
                  </div>
                ))}
                {data.promoter_pledge_status ? (
                  <div className="flex justify-between border-t border-border/40 pt-1.5">
                    <dt className="text-muted-foreground">Shares pledged (of total){data.promoter_pledge_status.as_of ? `, ${data.promoter_pledge_status.as_of}` : ""}</dt>
                    <dd className="font-bold text-foreground">{pct(data.promoter_pledge_status.pledged_pct_of_total, 2)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <Empty what="The shareholding pattern" />
            )}
          </Section>

          <Section title="Analyst estimates" tag="[CONSENSUS ESTIMATE]">
            {consensus ? (
              <>
                <div className="flex items-center justify-between text-2xs">
                  <div>
                    <span className="text-muted-foreground">Median price target</span>
                    <div className="text-base font-bold text-accent">{rupee(consensus.target_price.median)}</div>
                    <span className="text-3xs text-muted-foreground">
                      Range {rupee(consensus.target_price.low, 0)} to {rupee(consensus.target_price.high, 0)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Against the current price</span>
                    <div className={cn("text-base font-bold", tone(consensus.target_price.implied_upside_pct))}>
                      {signedPct(consensus.target_price.implied_upside_pct)}
                    </div>
                    <span className="text-3xs text-muted-foreground">{consensus.total_coverage ?? DASH} analysts</span>
                  </div>
                </div>
                {ratings && ratingTotal ? (
                  <>
                    <div className="mt-2 flex h-3 gap-1" role="img" aria-label={`${ratings.buy} buy, ${ratings.hold} hold, ${ratings.sell} sell`}>
                      <div className="h-full bg-up" style={{ width: share(ratings.buy) }} />
                      <div className="h-full bg-muted-foreground/50" style={{ width: share(ratings.hold) }} />
                      <div className="h-full bg-down" style={{ width: share(ratings.sell) }} />
                    </div>
                    <div className="mt-1 flex justify-between text-3xs text-muted-foreground">
                      <span>Buy ({ratings.buy})</span>
                      <span>Hold ({ratings.hold})</span>
                      <span>Sell ({ratings.sell})</span>
                    </div>
                  </>
                ) : null}
                <p className="text-3xs text-muted-foreground">Broker estimates collected by Yahoo Finance. They are opinions, not Arthdex recommendations.</p>
              </>
            ) : (
              <Empty what="Analyst coverage" />
            )}
          </Section>
        </div>

        {header.key_executives.length ? (
          <Section title="Management">
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-2xs sm:grid-cols-2">
              {header.key_executives.map((e) => (
                <li key={`${e.name}-${e.designation}`} className="flex justify-between gap-3">
                  <span className="font-bold">{e.name}</span>
                  <span className="text-right text-muted-foreground">{e.designation ?? DASH}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-3xs text-muted-foreground">
          <span>
            Arthdex • generated {new Date(data.generated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {data.unavailable.length ? ` • no response for: ${data.unavailable.join(", ")}` : ""}
          </span>
          <span className="font-bold uppercase text-accent">{data.provenance}</span>
        </div>
      </div>
    </div>
  );
}
