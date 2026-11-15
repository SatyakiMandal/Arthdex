"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiTearSheetData } from "@/lib/api/types";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

const num = (v: number | null | undefined, digits = 2) => (v == null ? "—" : formatINR(v, digits));
const pct = (v: number | null | undefined, digits = 1) => (v == null ? "—" : `${v.toFixed(digits)}%`);
const MISSING_LABEL: Record<string, string> = {
  price: "Price",
  statistics: "Statistics",
  financials: "Results",
  peers: "Peers",
  shareholding: "Shareholding",
  analysts: "Analyst estimates",
  returns: "Returns",
};

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("break-inside-avoid", className)}>
      <h2 className="border-b border-foreground/70 pb-1 text-xs font-semibold uppercase tracking-wider">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Pairs({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={cn("font-mono tabular-nums", v === "—" && "text-muted-foreground")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TearSheetView({ symbol, initialData: d }: { symbol: string; initialData: ApiTearSheetData | null }) {
  const router = useRouter();
  const [ticker, setTicker] = useState(symbol);

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 print:hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = ticker.trim().toUpperCase();
          if (t && t !== symbol) router.push(`/company/${encodeURIComponent(t)}/tear`);
        }}
        className="flex items-center gap-1.5"
      >
        <label htmlFor="tear-ticker" className="sr-only">Company</label>
        <input
          id="tear-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="NSE symbol or BSE code"
          className="w-44 border border-border bg-surface px-2 py-1 font-mono text-xs"
        />
        <button type="submit" className="border border-border px-2.5 py-1 text-xs">Load</button>
      </form>
      <button type="button" onClick={() => window.print()} className="btn-primary h-8 px-3 text-xs">Print</button>
    </div>
  );

  if (!d) {
    return (
      <div className="space-y-4">
        {toolbar}
        <p className="text-sm text-muted-foreground">No summary could be built for {symbol}: the company&apos;s data did not load.</p>
      </div>
    );
  }

  const h = d.header;
  const p = d.price;
  const missing = Object.entries(d.missing);
  const latestRec = d.analysts?.latest;

  return (
    <div className="space-y-5 text-sm">
      {toolbar}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{h.name ?? d.symbol}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {[h.nseSymbol && `NSE ${h.nseSymbol}`, h.bseCode && `BSE ${h.bseCode}`, h.isin].filter(Boolean).join(" · ")}
            {h.sector ? ` · ${h.sector}${h.industry ? `, ${h.industry}` : ""}` : ""}
          </p>
        </div>
        {p?.cmp != null ? (
          <div className="text-right">
            <p className="font-mono text-2xl font-semibold tabular-nums">₹{num(p.cmp)}</p>
            <p className={cn("font-mono text-xs tabular-nums", deltaColor(p.changePct ?? 0))}>
              {p.change != null ? `${p.change > 0 ? "+" : ""}${num(p.change)}` : "—"} ({p.changePct != null ? formatPct(p.changePct) : "—"}) · {p.exchange}
            </p>
          </div>
        ) : null}
      </header>

      {missing.length ? (
        <p role="note" className="text-xs text-muted-foreground">
          Not available: {missing.map(([k, why]) => `${MISSING_LABEL[k] ?? k} (${why})`).join("; ")}.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Price and size">
          <Pairs
            rows={[
              ["Market cap", p?.marketCapCr != null ? `₹${num(p.marketCapCr, 0)} Cr` : "—"],
              ["Enterprise value", p?.enterpriseValueCr != null ? `₹${num(p.enterpriseValueCr, 0)} Cr` : "—"],
              ["Day range", p?.dayLow != null && p.dayHigh != null ? `${num(p.dayLow)} – ${num(p.dayHigh)}` : "—"],
              ["52-week range", p?.low52w != null && p.high52w != null ? `${num(p.low52w)} – ${num(p.high52w)}` : "—"],
              ["Shares outstanding", p?.sharesOutstanding != null ? `${num(p.sharesOutstanding / 1e7, 2)} Cr` : "—"],
              ["Beta", p?.beta != null ? p.beta.toFixed(2) : "—"],
            ]}
          />
        </Section>

        <Section title="Valuation and returns">
          <Pairs
            rows={[
              ["P/E (trailing)", d.valuation?.trailingPE != null ? d.valuation.trailingPE.toFixed(2) : "—"],
              ["P/E (forward)", d.valuation?.forwardPE != null ? d.valuation.forwardPE.toFixed(2) : "—"],
              ["Price to book", d.valuation?.priceToBook != null ? d.valuation.priceToBook.toFixed(2) : "—"],
              ["EV to EBITDA", d.valuation?.evToEbitda != null ? d.valuation.evToEbitda.toFixed(2) : "—"],
              ["Dividend yield", pct(d.valuation?.dividendYieldPct, 2)],
              ...(["1M", "3M", "6M", "1Y", "3Y", "5Y"] as const).map((k): [string, string] => [`Return ${k}`, d.returns?.[k] != null ? formatPct(d.returns[k]!, 1) : "—"]),
            ]}
          />
        </Section>
      </div>

      <Section title={`Annual results${d.annualSource ? ` (shown from ${d.annualSource === "screener" ? "screener.in" : "Yahoo Finance"})` : ""}, ₹ crore`}>
        {d.annual.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 text-left font-medium">Year</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Revenue</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Operating profit</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Margin</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Net profit</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">EPS (₹)</th>
                </tr>
              </thead>
              <tbody>
                {d.annual.map((r) => (
                  <tr key={r.periodEnd} className="border-b border-border/50">
                    <th scope="row" className="py-1 pr-3 text-left font-normal">{r.period}</th>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{num(r.revenue, 0)}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{num(r.operatingProfit, 0)}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{pct(r.opmPct)}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{num(r.netProfit, 0)}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{num(r.eps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No annual results loaded.</p>
        )}
        {d.ratios ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            Last four quarters: ROE {pct(d.ratios.roePct)} · ROCE {pct(d.ratios.rocePct)} · debt to equity{" "}
            {d.ratios.debtToEquity != null ? d.ratios.debtToEquity.toFixed(2) : "—"} · current ratio {d.ratios.currentRatio != null ? d.ratios.currentRatio.toFixed(2) : "—"}
          </p>
        ) : null}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Peers${d.peers?.industry ? `: ${d.peers.industry}` : ""}`}>
          {d.peers?.rows.length ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 text-left font-medium">Company</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Mkt cap (Cr)</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">P/E</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">ROCE</th>
                </tr>
              </thead>
              <tbody>
                {d.peers.rows.filter(Boolean).map((r) => (
                  <tr key={r!.symbol} className={cn("border-b border-border/50", r!.symbol === d.symbol && "font-semibold")}>
                    <th scope="row" className="py-1 pr-2 text-left font-normal">{r!.name}</th>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{num(r!.marketCapCr, 0)}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{r!.pe != null ? r!.pe.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums">{pct(r!.rocePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">No peer table loaded.</p>
          )}
        </Section>

        <Section title="Shareholding, %">
          {d.shareholding.length ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 text-left font-medium">Quarter</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Promoters</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">FIIs</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">DIIs</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Public</th>
                </tr>
              </thead>
              <tbody>
                {d.shareholding.map((q) => (
                  <tr key={q.quarter} className="border-b border-border/50">
                    <th scope="row" className="py-1 pr-2 text-left font-normal">{q.quarter}</th>
                    {(["promoters", "fiis", "diis", "public"] as const).map((k) => (
                      <td key={k} className="px-2 py-1 text-right font-mono tabular-nums">{q[k] != null ? q[k]!.toFixed(2) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted-foreground">No shareholding pattern loaded.</p>
          )}
          {d.pledgePct != null ? <p className="mt-1 text-xs text-muted-foreground">Promoter shares pledged: {pct(d.pledgePct, 2)}</p> : null}
        </Section>
      </div>

      {d.analysts?.targets || latestRec ? (
        <Section title="What analysts say (Yahoo Finance)">
          <Pairs
            rows={[
              ["Analysts", d.analysts?.targets?.analysts != null ? String(d.analysts.targets.analysts) : "—"],
              ["Median target", d.analysts?.targets?.median != null ? `₹${num(d.analysts.targets.median)}` : "—"],
              ["Target range", d.analysts?.targets?.low != null && d.analysts.targets.high != null ? `₹${num(d.analysts.targets.low)} – ₹${num(d.analysts.targets.high)}` : "—"],
              ["Ratings now", latestRec ? `${latestRec.strongBuy + latestRec.buy} buy · ${latestRec.hold} hold · ${latestRec.sell + latestRec.strongSell} sell` : "—"],
              ["Next results", d.analysts?.nextEarnings?.date ?? "—"],
            ]}
          />
        </Section>
      ) : null}

      {h.summary ? (
        <Section title="Business">
          <p className="text-xs leading-relaxed text-muted-foreground">{h.summary}</p>
        </Section>
      ) : null}

      <footer className="border-t border-border pt-2 text-3xs text-muted-foreground">
        Sources: {d.sources.join("; ")}. Built {new Date(d.asOf).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. Not investment advice.
      </footer>
    </div>
  );
}
