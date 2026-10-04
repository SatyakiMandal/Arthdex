import { Activity, AlertTriangle, BarChart3, Calculator, Droplets, Gauge, LineChart, Newspaper, Scale, Target, TrendingUp, Waves } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import type { UnlistedSummary } from "@/types/analyzer";
import { Pill, dash, stanceTone } from "@/components/analyzer/dossier/shared";
import { CompareChart, type CmpSeries } from "./compare-chart";
import { CompareSection, fBig, fInr, fNum, fPct, fPlain, g, indicatorRows, numRow, txtRow, type Any, type CmpRow } from "./compare-ui";

const call = (s: UnlistedSummary) => (s.verdict?.call ? <Pill label={s.verdict.call} tone={stanceTone(s.verdict.call)} /> : dash);

export function UnlistedCompare({ a, b }: { a: UnlistedSummary; b: UnlistedSummary }) {
  const A = a.company;
  const B = b.company;
  const ra: Any = a.research ?? {};
  const rb: Any = b.research ?? {};
  const va = a.verdict;
  const vb = b.verdict;

  const series: CmpSeries[] = [
    { name: A, color: "hsl(var(--accent))", step: true, points: (a.series ?? []).map((p) => ({ date: p.date, value: p.close })) },
    { name: B, color: "hsl(var(--flat))", step: true, points: (b.series ?? []).map((p) => ({ date: p.date, value: p.close })) },
  ];

  const callRows: CmpRow[] = [
    { label: "Call", a: call(a), b: call(b) },
    numRow("Conviction", va?.conviction, vb?.conviction, fNum(1), "high", "Capped lower than a listed call"),
    numRow("Quote", va?.price, vb?.price, fInr(2)),
    numRow("Target 1", va?.target1, vb?.target1, fInr(2)),
    numRow("Target 1 move", va?.target1Pct, vb?.target1Pct, fPct(1), "high"),
    numRow("Target 2", va?.target2, vb?.target2, fInr(2)),
    numRow("Target 2 move", va?.target2Pct, vb?.target2Pct, fPct(1), "high"),
    numRow("Stop", va?.stop, vb?.stop, fInr(2)),
    numRow("Stop distance", va?.stopPct, vb?.stopPct, fPct(1), "low"),
    txtRow("Risk / reward", va?.riskReward, vb?.riskReward),
  ];
  const names: string[] = [];
  for (const p of [...(va?.pillars ?? []), ...(vb?.pillars ?? [])]) if (p.name && !names.includes(p.name)) names.push(p.name);
  const pillarRows: CmpRow[] = names.map((name) => {
    const x = va?.pillars.find((p) => p.name === name);
    const y = vb?.pillars.find((p) => p.name === name);
    const f = (p: typeof x) => (p ? (p.stance === "Not assessed" ? "Not assessed" : `${p.stance} (${p.score?.toFixed(0) ?? dash})`) : dash);
    return { label: name, a: f(x), b: f(y), av: x && x.stance !== "Not assessed" ? x.score : null, bv: y && y.stance !== "Not assessed" ? y.score : null, better: "high" };
  });

  const sa: Any[] = g(ra, "sizing", "tiers") ?? [];
  const sb: Any[] = g(rb, "sizing", "tiers") ?? [];
  const sizeRows: CmpRow[] = [
    numRow("Prescribed allocation", g(ra, "sizing", "prescribed_pct"), g(rb, "sizing", "prescribed_pct"), fPct(1)),
    numRow("Half-Kelly weight", g(ra, "sizing", "half_kelly_pct"), g(rb, "sizing", "half_kelly_pct"), fPct(1)),
    ...sa.map((t, i): CmpRow => ({ label: `${t.portfolio_name} shares`, a: t.prescribed_shares?.toLocaleString("en-IN") ?? dash, b: sb[i]?.prescribed_shares?.toLocaleString("en-IN") ?? dash })),
    numRow("Minimum ticket (one lot)", g(ra, "risk", "liquidity", "min_ticket_inr"), g(rb, "risk", "liquidity", "min_ticket_inr"), fInr(0), "low"),
    txtRow("Core holding", g(ra, "holding", "core"), g(rb, "holding", "core")),
  ];

  // valuation
  const xa: Any = ra.valuation ?? {};
  const xb: Any = rb.valuation ?? {};
  const model = (v: Any, key: string) => (v.models ?? []).find((m: Any) => m.key === key);
  const valRows: CmpRow[] = [
    numRow("Quote", xa.price, xb.price, fInr(2)),
    numRow("Blended fair value", xa.blended_fair_value, xb.blended_fair_value, fInr(2)),
    numRow("Upside to fair value", xa.upside_pct, xb.upside_pct, fPct(1), "high"),
    txtRow("Valuation tier", xa.valuation_tier, xb.valuation_tier),
    numRow("Lowest model value", xa.fair_value_low, xb.fair_value_low, fInr(2)),
    numRow("Highest model value", xa.fair_value_high, xb.fair_value_high, fInr(2)),
    numRow("Relative P/B model", model(xa, "pb_relative")?.fair_value, model(xb, "pb_relative")?.fair_value, fInr(2)),
    numRow("Relative P/E model", model(xa, "pe_relative")?.fair_value, model(xb, "pe_relative")?.fair_value, fInr(2)),
    numRow("Justified P/B model", model(xa, "justified_pb")?.fair_value, model(xb, "justified_pb")?.fair_value, fInr(2)),
    numRow("12-month median anchor", model(xa, "reversion")?.fair_value, model(xb, "reversion")?.fair_value, fInr(2)),
    txtRow("Benchmark", g(xa, "benchmark", "name"), g(xb, "benchmark", "name")),
    numRow("Benchmark P/B", g(xa, "benchmark", "pb"), g(xb, "benchmark", "pb"), fNum(2)),
    numRow("Benchmark P/E", g(xa, "benchmark", "pe"), g(xb, "benchmark", "pe"), fNum(2)),
    numRow("Company P/B", g(xa, "company_multiples", "pb"), g(xb, "company_multiples", "pb"), fNum(2)),
    numRow("Company P/E", g(xa, "company_multiples", "pe"), g(xb, "company_multiples", "pe"), fNum(2)),
    numRow("Book value per share", g(xa, "company_multiples", "book_value"), g(xb, "company_multiples", "book_value"), fInr(2)),
    numRow("Return on equity (P/B ÷ P/E)", g(xa, "company_multiples", "roe_pct"), g(xb, "company_multiples", "roe_pct"), fPct(1), "high"),
    numRow("Debt to equity", g(xa, "company_multiples", "debt_equity"), g(xb, "company_multiples", "debt_equity"), fNum(2), "low"),
    numRow("Illiquidity discount", g(xa, "assumptions", "dlom_pct"), g(xb, "assumptions", "dlom_pct"), fPct(0)),
    numRow("Cost of equity", g(xa, "assumptions", "cost_of_equity_pct"), g(xb, "assumptions", "cost_of_equity_pct"), fPct(2)),
  ];

  // price profile
  const pa: Any = ra.price_profile ?? {};
  const pb: Any = rb.price_profile ?? {};
  const profRows: CmpRow[] = [
    numRow("Window return", pa.window_return_pct, pb.window_return_pct, fPct(1), "high"),
    numRow("Compound annual growth", pa.cagr_pct, pb.cagr_pct, fPct(1), "high"),
    numRow("1 month", pa.change_1m_pct, pb.change_1m_pct, fPct(1), "high"),
    numRow("3 months", pa.change_3m_pct, pb.change_3m_pct, fPct(1), "high"),
    numRow("6 months", pa.change_6m_pct, pb.change_6m_pct, fPct(1), "high"),
    numRow("12 months", pa.change_12m_pct, pb.change_12m_pct, fPct(1), "high"),
    numRow("Position in 52-week range", g(pa, "range_52w", "position_pct"), g(pb, "range_52w", "position_pct"), fPct(0)),
    numRow("Maximum drawdown", g(pa, "drawdown", "max_drawdown_pct"), g(pb, "drawdown", "max_drawdown_pct"), fPct(1), "high", "Less negative is stronger"),
    numRow("Current drawdown", g(pa, "drawdown", "current_drawdown_pct"), g(pb, "drawdown", "current_drawdown_pct"), fPct(1), "high"),
    numRow("Price revisions", g(pa, "revisions", "count"), g(pb, "revisions", "count"), fPlain),
    numRow("Median gap between revisions", g(pa, "revisions", "median_gap_days"), g(pb, "revisions", "median_gap_days"), fNum(0), undefined, "Days; a long gap means a stale quote"),
    numRow("Average revision size", g(pa, "revisions", "mean_abs_move_pct"), g(pb, "revisions", "mean_abs_move_pct"), fPct(1)),
    numRow("Revisions upward", g(pa, "revisions", "up_share_pct"), g(pb, "revisions", "up_share_pct"), fPct(0), "high"),
    numRow("Days since last revision", g(pa, "revisions", "days_since_last"), g(pb, "revisions", "days_since_last"), fPlain, "low"),
    txtRow("Window", `${a.start} to ${a.end}`, `${b.start} to ${b.end}`),
  ];

  // trend
  const ta: Any = ra.technical ?? {};
  const tb: Any = rb.technical ?? {};
  const trendRows: CmpRow[] = [
    txtRow("Composite rating", ta.composite_rating, tb.composite_rating),
    numRow("Composite score", ta.composite_score, tb.composite_score, fNum(0), "high"),
    numRow("RSI (14 weeks)", ta.rsi, tb.rsi, fNum(1)),
    numRow("MACD histogram", g(ta, "macd", "hist"), g(tb, "macd", "hist"), fNum(3), "high"),
    numRow("Bollinger %B", g(ta, "bollinger", "percent_b"), g(tb, "bollinger", "percent_b"), fNum(2)),
    numRow("Weekly bars", ta.weeks, tb.weeks, fPlain),
  ];

  // risk
  const ka: Any = ra.risk ?? {};
  const kb: Any = rb.risk ?? {};
  const riskRows: CmpRow[] = [
    numRow("Annualised volatility", ka.annualised_vol_pct, kb.annualised_vol_pct, fPct(1), "low"),
    numRow("Monthly volatility", ka.monthly_vol_pct, kb.monthly_vol_pct, fPct(1), "low"),
    numRow("Worst month", ka.worst_month_pct, kb.worst_month_pct, fPct(1), "high"),
    numRow("Best month", ka.best_month_pct, kb.best_month_pct, fPct(1), "high"),
    numRow("Positive months", ka.positive_months_pct, kb.positive_months_pct, fPct(0), "high"),
    numRow("Skew", ka.skew, kb.skew, fNum(2)),
    numRow("Excess kurtosis", ka.excess_kurtosis, kb.excess_kurtosis, fNum(2), "low"),
    txtRow("Volatility regime", g(ka, "regime", "state"), g(kb, "regime", "state")),
    numRow("1-month VaR 95, historical", g(ka, "var_1m", "historical_95_pct"), g(kb, "var_1m", "historical_95_pct"), fPct(1), "low"),
    numRow("1-month VaR 95, parametric", g(ka, "var_1m", "parametric_95_pct"), g(kb, "var_1m", "parametric_95_pct"), fPct(1), "low"),
    numRow("1-month VaR 95, Cornish-Fisher", g(ka, "var_1m", "cornish_fisher_95_pct"), g(kb, "var_1m", "cornish_fisher_95_pct"), fPct(1), "low"),
    numRow("1-month VaR 99, parametric", g(ka, "var_1m", "parametric_99_pct"), g(kb, "var_1m", "parametric_99_pct"), fPct(1), "low"),
    numRow("Expected shortfall 95", g(ka, "var_1m", "expected_shortfall_95_pct"), g(kb, "var_1m", "expected_shortfall_95_pct"), fPct(1), "low"),
    numRow("Price unchanged on", g(ka, "liquidity", "stale_day_share_pct"), g(kb, "liquidity", "stale_day_share_pct"), fPct(0), "low", "Share of days; high means a quote, not a market"),
    numRow("Lot size", g(ka, "liquidity", "lot_size"), g(kb, "liquidity", "lot_size"), fBig),
    numRow("Minimum ticket", g(ka, "liquidity", "min_ticket_inr"), g(kb, "liquidity", "min_ticket_inr"), fInr(0), "low"),
    numRow("Debt to equity", g(ka, "leverage", "debt_to_equity"), g(kb, "leverage", "debt_to_equity"), fNum(2), "low"),
  ];

  // market model
  const ma: Any = ra.market_model ?? {};
  const mb: Any = rb.market_model ?? {};
  const idxA = g(ra, "sector_index", "name");
  const idxB = g(rb, "sector_index", "name");
  const mmRows: CmpRow[] = [
    numRow("Beta to Nifty 50", g(ma, "Nifty 50", "beta"), g(mb, "Nifty 50", "beta"), fNum(2)),
    numRow("Beta t-statistic", g(ma, "Nifty 50", "beta_t"), g(mb, "Nifty 50", "beta_t"), fNum(1)),
    numRow("R squared vs Nifty 50", g(ma, "Nifty 50", "r_squared"), g(mb, "Nifty 50", "r_squared"), fNum(2)),
    numRow("Correlation with Nifty 50", g(ma, "Nifty 50", "correlation"), g(mb, "Nifty 50", "correlation"), fNum(2)),
    numRow("Months used", g(ma, "Nifty 50", "months"), g(mb, "Nifty 50", "months"), fPlain),
    txtRow("Sector index", idxA, idxB),
    numRow("Beta to sector index", idxA ? g(ma, idxA, "beta") : null, idxB ? g(mb, idxB, "beta") : null, fNum(2)),
    numRow("R squared vs sector index", idxA ? g(ma, idxA, "r_squared") : null, idxB ? g(mb, idxB, "r_squared") : null, fNum(2)),
  ];

  // outlook
  const fa: Any = ra.forecast ?? {};
  const fb: Any = rb.forecast ?? {};
  const h = (f: Any, months: number, key: string) => (f.horizons ?? []).find((x: Any) => x.months === months)?.[key] ?? null;
  const outlookRows: CmpRow[] = [
    txtRow("Confidence", fa.confidence, fb.confidence),
    txtRow("Bias", fa.bias, fb.bias),
    ...[1, 3, 6, 12].flatMap((m) => [
      numRow(`${m}-month weak case (10th)`, h(fa, m, "p10_return_pct"), h(fb, m, "p10_return_pct"), fPct(1), "high"),
      numRow(`${m}-month median`, h(fa, m, "p50_return_pct"), h(fb, m, "p50_return_pct"), fPct(1), "high"),
      numRow(`${m}-month strong case (90th)`, h(fa, m, "p90_return_pct"), h(fb, m, "p90_return_pct"), fPct(1), "high"),
      numRow(`${m}-month chance of a loss`, h(fa, m, "prob_loss_pct"), h(fb, m, "prob_loss_pct"), fPct(0), "low"),
    ]),
  ];

  // news and data quality
  const na: Any = ra.news_signal ?? {};
  const nb: Any = rb.news_signal ?? {};
  const dq = (r: Any, k: string) => g(r, "data_quality", k);
  const newsRows: CmpRow[] = [
    numRow("News items used", a.news.items, b.news.items, fPlain),
    numRow("Revisions with a clear headline", na.moves_with_headlines, nb.moves_with_headlines, fPlain),
    numRow("Headline agreed with the move", na.agreement_pct, nb.agreement_pct, fPct(0), "high"),
    numRow("Net headline tone", na.net_tone, nb.net_tone, fNum(2), "high"),
    numRow("Daily points", dq(ra, "daily_points"), dq(rb, "daily_points"), fPlain),
    numRow("Revisions in the record", dq(ra, "revisions"), dq(rb, "revisions"), fPlain),
    numRow("Monthly returns", dq(ra, "months"), dq(rb, "months"), fPlain),
    txtRow("Short record", dq(ra, "thin") ? "Yes, limited" : "No", dq(rb, "thin") ? "Yes, limited" : "No"),
  ];

  return (
    <div className="space-y-4">
      <CompareSection title="Investment call" subtitle="The verdict and its levels" icon={Target} rows={callRows} nameA={A} nameB={B} footnote="A model output for illiquid, off-exchange shares priced by a dealer. It is not investment advice." />
      <CompareSection title="Why each call" subtitle="Score of each weighted pillar, from -100 (bearish) to +100 (bullish)" icon={Scale} rows={pillarRows} nameA={A} nameB={B} />
      <DataCard title="Indicative price" subtitle="Each company's dealer price, rebased to 100 on the first date they share" icon={LineChart}>
        <CompareChart series={series} title="Dealer price, rebased to 100" />
      </DataCard>
      <CompareSection title="Position sizing" subtitle="Smaller and in whole lots, because the shares are illiquid" icon={Gauge} rows={sizeRows} nameA={A} nameB={B} />
      <CompareSection title="Valuation" subtitle="Fair value from book value, earnings and listed benchmarks, after an illiquidity discount" icon={Calculator} rows={valRows} nameA={A} nameB={B} footnote="The illiquidity discount, equity risk premium and growth rate are assumptions. Benchmarks are NSE index averages chosen by sector label." />
      <CompareSection title="Price profile and revisions" subtitle="Where the dealer price has been and how it is revised" icon={TrendingUp} rows={profRows} nameA={A} nameB={B} />
      <CompareSection title="Trend and momentum" subtitle="Weekly bars" icon={Activity} rows={trendRows} nameA={A} nameB={B} />
      <CompareSection title="Indicator signals" subtitle="Every weekly indicator, side by side" icon={BarChart3} rows={indicatorRows(ta.indicators_table, tb.indicators_table, "indicator", "signal", "value")} nameA={A} nameB={B} />
      <CompareSection title="Risk, leverage and liquidity" subtitle="Measured on monthly returns" icon={Droplets} rows={riskRows} nameA={A} nameB={B} />
      <CompareSection title="Market sensitivity" subtitle="Monthly returns against Nifty 50 and the sector index" icon={Waves} rows={mmRows} nameA={A} nameB={B} />
      <CompareSection title="Outcome ranges" subtitle="Block bootstrap of monthly returns" icon={TrendingUp} rows={outlookRows} nameA={A} nameB={B} footnote="A range of outcomes the past monthly moves allow, not a prediction." />
      <CompareSection title="News and data quality" subtitle="How much the analysis rests on" icon={Newspaper} rows={newsRows} nameA={A} nameB={B} />
      {[ra, rb].some((r) => g(r, "data_quality", "notes")?.length) ? (
        <DataCard title="Notes" icon={AlertTriangle}>
          <ul className="space-y-1.5 p-3 text-[0.8125rem] text-muted-foreground">
            {(g(ra, "data_quality", "notes") ?? []).map((t: string, i: number) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </DataCard>
      ) : null}
    </div>
  );
}
