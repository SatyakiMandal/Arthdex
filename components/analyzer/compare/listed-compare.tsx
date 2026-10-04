import { Activity, AlertTriangle, BarChart3, Calculator, Droplets, FlaskConical, Gauge, Globe2, Landmark, LineChart, Newspaper, Scale, Target, TrendingUp, Users, Waves } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import type { ListedSummary } from "@/types/analyzer";
import { Pill, dash, stanceTone } from "@/components/analyzer/dossier/shared";
import { CompareChart, type CmpSeries } from "./compare-chart";
import { CompareSection, fBig, fFrac, fInr, fNum, fPct, fPlain, fX, g, indicatorRows, n, numRow, txtRow, type Any, type CmpRow } from "./compare-ui";

const call = (s: ListedSummary) => (s.verdict?.call ? <Pill label={s.verdict.call} tone={stanceTone(s.verdict.call)} /> : dash);

/** Max drawdown, realised volatility and the best and worst day, from the run's own price path. */
function pathStats(prices: (number | null)[] | undefined) {
  const p = (prices ?? []).filter((v): v is number => typeof v === "number" && v > 0);
  if (p.length < 5) return null;
  let peak = p[0];
  let dd = 0;
  const rets: number[] = [];
  for (let i = 1; i < p.length; i++) {
    peak = Math.max(peak, p[i]);
    dd = Math.min(dd, p[i] / peak - 1);
    rets.push(p[i] / p[i - 1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  return { window: (p[p.length - 1] / p[0] - 1) * 100, maxDd: dd * 100, vol: sd * Math.sqrt(252) * 100, best: Math.max(...rets) * 100, worst: Math.min(...rets) * 100 };
}

function incidentStats(s: ListedSummary) {
  const inc: Any[] = g(s, "detail", "event_study", "incidents") ?? [];
  if (inc.length === 0) return { count: s.incidentCount ?? 0, agree: null, car: null, maxAr: null, z: null, sentiment: null };
  const avg = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const agrees = inc.filter((i) => i.direction_agrees != null);
  return {
    count: s.incidentCount ?? inc.length,
    agree: agrees.length ? (agrees.filter((i) => i.direction_agrees).length / agrees.length) * 100 : null,
    car: avg(inc.map((i) => (typeof i.car === "number" ? i.car * 100 : null))),
    maxAr: inc.reduce<number | null>((m, i) => (typeof i.abnormal_return === "number" && (m == null || Math.abs(i.abnormal_return) > Math.abs(m)) ? i.abnormal_return : m), null),
    z: avg(inc.map((i) => (typeof i.abnormal_return_z === "number" ? Math.abs(i.abnormal_return_z) : null))),
    sentiment: avg(inc.map((i) => i.mean_sentiment)),
  };
}

export function ListedCompare({ a, b }: { a: ListedSummary; b: ListedSummary }) {
  const A = a.company;
  const B = b.company;
  const da: Any = a.detail ?? {};
  const db: Any = b.detail ?? {};
  const va = a.verdict;
  const vb = b.verdict;

  // chart: both companies and the benchmark, each rebased
  const tl = (s: ListedSummary): CmpSeries["points"] => {
    const t = g(s, "detail", "timeline");
    if (!t?.dates) return [];
    return (t.dates as string[]).map((d, i) => ({ date: d, value: t.price?.[i] })).filter((p) => typeof p.value === "number" && p.value > 0) as CmpSeries["points"];
  };
  const bench = (s: ListedSummary): CmpSeries["points"] => {
    const t = g(s, "detail", "timeline");
    if (!t?.dates) return [];
    return (t.dates as string[]).map((d, i) => ({ date: d, value: t.benchRebased?.[i] })).filter((p) => typeof p.value === "number" && p.value > 0) as CmpSeries["points"];
  };
  const series: CmpSeries[] = [
    { name: A, color: "hsl(var(--accent))", points: tl(a) },
    { name: B, color: "hsl(var(--flat))", points: tl(b) },
    { name: `Benchmark (${g(a, "benchmark") ?? "index"})`, color: "hsl(var(--muted-foreground))", points: bench(a), dashed: true },
  ];

  const pa = pathStats(g(da, "timeline", "price"));
  const pb = pathStats(g(db, "timeline", "price"));
  const ia = incidentStats(a);
  const ib = incidentStats(b);

  // ── call ──
  const callRows: CmpRow[] = [
    { label: "Call", a: call(a), b: call(b) },
    numRow("Conviction", va?.conviction, vb?.conviction, fNum(1), "high", "Out of 100"),
    numRow("Price at analysis", va?.price, vb?.price, fInr(2)),
    txtRow("Entry zone", va?.entryLow != null ? `₹${va.entryLow?.toFixed(0)} to ₹${va.entryHigh?.toFixed(0)}` : null, vb?.entryLow != null ? `₹${vb.entryLow?.toFixed(0)} to ₹${vb.entryHigh?.toFixed(0)}` : null),
    numRow("Target 1", va?.target1, vb?.target1, fInr(2)),
    numRow("Target 1 move", va?.target1Pct, vb?.target1Pct, fPct(1), "high"),
    numRow("Target 2", va?.target2, vb?.target2, fInr(2)),
    numRow("Target 2 move", va?.target2Pct, vb?.target2Pct, fPct(1), "high"),
    numRow("Stop", va?.stop, vb?.stop, fInr(2)),
    numRow("Stop distance", va?.stopPct, vb?.stopPct, fPct(1), "low"),
    txtRow("Risk / reward", va?.riskReward, vb?.riskReward),
    txtRow("As of", va?.asOf, vb?.asOf),
  ];
  const pillarNames: string[] = [];
  for (const p of [...(va?.pillars ?? []), ...(vb?.pillars ?? [])]) if (p.name && !pillarNames.includes(p.name)) pillarNames.push(p.name);
  const pillarRows: CmpRow[] = pillarNames.map((name) => {
    const pa_ = va?.pillars.find((p) => p.name === name);
    const pb_ = vb?.pillars.find((p) => p.name === name);
    const f = (p: typeof pa_) => (p ? (p.stance === "Not assessed" ? "Not assessed" : `${p.stance} (${p.score?.toFixed(0) ?? dash})`) : dash);
    return { label: name, a: f(pa_), b: f(pb_), av: pa_ && pa_.stance !== "Not assessed" ? pa_.score : null, bv: pb_ && pb_.stance !== "Not assessed" ? pb_.score : null, better: "high" };
  });

  const sizeA: Any[] = g(da, "sizing", "tiers") ?? [];
  const sizeB: Any[] = g(db, "sizing", "tiers") ?? [];
  const sizingRows: CmpRow[] = [
    numRow("Prescribed allocation", g(da, "sizing", "prescribed_pct"), g(db, "sizing", "prescribed_pct"), fPct(1)),
    numRow("Half-Kelly weight", g(da, "sizing", "half_kelly_pct"), g(db, "sizing", "half_kelly_pct"), fPct(1)),
    numRow("Full-Kelly weight", g(da, "sizing", "raw_kelly_pct"), g(db, "sizing", "raw_kelly_pct"), fPct(1)),
    ...sizeA.map((t, i): CmpRow => ({
      label: `${t.portfolio_name} shares`,
      a: t.prescribed_shares?.toLocaleString("en-IN") ?? dash,
      b: sizeB[i]?.prescribed_shares?.toLocaleString("en-IN") ?? dash,
    })),
    ...sizeA.map((t, i) => numRow(`${String(t.portfolio_name).split("(")[0].trim()} book risk at stop`, t.portfolio_risk_pct, sizeB[i]?.portfolio_risk_pct, fPct(2), "low")),
    txtRow("Core holding", g(da, "holding", "core"), g(db, "holding", "core")),
  ];

  // ── performance ──
  const perfRows: CmpRow[] = [
    numRow("Window return", pa?.window, pb?.window, fPct(1), "high"),
    numRow("Maximum drawdown", pa?.maxDd, pb?.maxDd, fPct(1), "high", "Less negative is stronger"),
    numRow("Realised volatility (annualised)", pa?.vol, pb?.vol, fPct(1), "low"),
    numRow("Best day", pa?.best, pb?.best, fPct(2), "high"),
    numRow("Worst day", pa?.worst, pb?.worst, fPct(2), "high"),
    txtRow("Window", `${a.start} to ${a.end}`, `${b.start} to ${b.end}`),
  ];

  // ── market model and event study ──
  const marketRows: CmpRow[] = [
    numRow("Market beta", a.market.beta, b.market.beta, fNum(2), undefined, "Sensitivity to the benchmark"),
    numRow("Alpha (daily)", a.market.alpha, b.market.alpha, fNum(5), "high"),
    numRow("R squared", a.market.rSquared, b.market.rSquared, fNum(2), undefined, "Share of daily moves the market explains"),
    numRow("Trading days in window", a.market.tradingDays, b.market.tradingDays, fPlain),
    numRow("News items used", a.news.items, b.news.items, fPlain),
    numRow("Flagged event days", ia.count, ib.count, fPlain),
    numRow("Events where tone and price agreed", ia.agree, ib.agree, fPct(0), "high"),
    numRow("Mean cumulative abnormal return", ia.car, ib.car, fPct(2)),
    numRow("Mean abnormal-return z on event days", ia.z, ib.z, fNum(2)),
    numRow("Mean headline sentiment on event days", ia.sentiment, ib.sentiment, fNum(2)),
    numRow("Sentiment to return correlation", a.news.sentimentReturnR, b.news.sentimentReturnR, fNum(2)),
    numRow("Backtest events", a.backtest.events, b.backtest.events, fPlain),
    numRow("Event backtest win rate", a.backtest.winRatePct, b.backtest.winRatePct, fPct(1), "high"),
    numRow("Event backtest profit factor", a.backtest.profitFactor, b.backtest.profitFactor, fNum(2), "high"),
    numRow("Conformal coverage observed", a.backtest.conformalCoveragePct, b.backtest.conformalCoveragePct, fPct(1)),
  ];

  // ── technicals ──
  const ta = da.technical ?? {};
  const tb = db.technical ?? {};
  const techRows: CmpRow[] = [
    txtRow("Composite rating", a.technical.rating, b.technical.rating),
    numRow("Composite score", a.technical.score, b.technical.score, fNum(0), "high"),
    numRow("RSI (14)", a.technical.rsi, b.technical.rsi, fNum(1)),
    numRow("ADX (14)", a.technical.adx, b.technical.adx, fNum(1), undefined, "Trend strength, not direction"),
    txtRow("MACD crossover", a.technical.macd, b.technical.macd),
    txtRow("Moving-average trend", a.technical.trend, b.technical.trend),
    numRow("Distance to 20-day average", g(ta, "moving_averages", "dist_to_sma_20_pct"), g(tb, "moving_averages", "dist_to_sma_20_pct"), fPct(1)),
    numRow("Distance to 50-day average", g(ta, "moving_averages", "dist_to_sma_50_pct"), g(tb, "moving_averages", "dist_to_sma_50_pct"), fPct(1)),
    numRow("Distance to 200-day average", g(ta, "moving_averages", "dist_to_sma_200_pct"), g(tb, "moving_averages", "dist_to_sma_200_pct"), fPct(1)),
    numRow("Bollinger %B", g(ta, "bollinger", "percent_b"), g(tb, "bollinger", "percent_b"), fNum(2)),
    numRow("Bollinger bandwidth", g(ta, "bollinger", "bandwidth_pct"), g(tb, "bollinger", "bandwidth_pct"), fPct(1)),
    txtRow("Bollinger state", g(ta, "bollinger", "squeeze_status"), g(tb, "bollinger", "squeeze_status")),
    numRow("Stochastic %K", g(ta, "stochastic", "slow_k"), g(tb, "stochastic", "slow_k"), fNum(1)),
    txtRow("Stochastic condition", g(ta, "stochastic", "condition"), g(tb, "stochastic", "condition")),
    txtRow("Verdict", a.technical.verdict, b.technical.verdict),
  ];
  const techBack: CmpRow[] = [
    numRow("Trades", g(ta, "backtest", "total_trades"), g(tb, "backtest", "total_trades"), fPlain),
    numRow("Strategy return", g(ta, "backtest", "strategy_return_pct"), g(tb, "backtest", "strategy_return_pct"), fPct(1), "high"),
    numRow("Buy and hold return", g(ta, "backtest", "buy_and_hold_return_pct"), g(tb, "backtest", "buy_and_hold_return_pct"), fPct(1), "high"),
    numRow("Strategy alpha over buy and hold", g(ta, "backtest", "alpha_pct"), g(tb, "backtest", "alpha_pct"), fPct(1), "high"),
    numRow("Win rate", g(ta, "backtest", "win_rate_pct"), g(tb, "backtest", "win_rate_pct"), fPct(1), "high"),
    numRow("Profit factor", g(ta, "backtest", "profit_factor"), g(tb, "backtest", "profit_factor"), fNum(2), "high"),
    numRow("Max drawdown", g(ta, "backtest", "max_drawdown_pct"), g(tb, "backtest", "max_drawdown_pct"), fPct(1), "high"),
    numRow("Sharpe ratio", g(ta, "backtest", "strategy_sharpe_ratio"), g(tb, "backtest", "strategy_sharpe_ratio"), fNum(2), "high"),
  ];

  // ── fundamentals ──
  const fa = da.fundamental ?? {};
  const fb = db.fundamental ?? {};
  const ra = fa.ratios ?? {};
  const rb = fb.ratios ?? {};
  const bsA = fa.balance_sheet ?? {};
  const bsB = fb.balance_sheet ?? {};
  const de = (bs: Any) => (n(bs.total_debt) != null && n(bs.total_equity) ? bs.total_debt / bs.total_equity : null);
  const ratioKeys = ["ROE", "ROCE", "Stock P/E", "Book Value", "Dividend Yield", "Debtor Days", "Cash Conversion Cycle", "Working Capital Days"];
  const fundRows: CmpRow[] = [
    txtRow("Statement basis", fa.statement_kind, fb.statement_kind),
    txtRow("As of", a.fundamental.asOf, b.fundamental.asOf),
    numRow(`Revenue (${a.fundamental.unit ?? "units"})`, a.fundamental.revenue, b.fundamental.revenue, fBig),
    numRow("Revenue growth, year on year", a.fundamental.revenueYoY, b.fundamental.revenueYoY, fPct(1), "high"),
    numRow(`Net profit (${a.fundamental.unit ?? "units"})`, a.fundamental.netProfit, b.fundamental.netProfit, fBig),
    numRow("Net profit growth, year on year", a.fundamental.netProfitYoY, b.fundamental.netProfitYoY, fPct(1), "high"),
    numRow("NOPAT", fa.nopat, fb.nopat, fBig),
    numRow("Tax rate", fa.tax_rate_pct, fb.tax_rate_pct, fPct(1)),
    ...ratioKeys.map((k) =>
      numRow(k, ra[k], rb[k], fNum(1), k === "ROE" || k === "ROCE" || k === "Dividend Yield" ? "high" : k === "Debtor Days" || k === "Cash Conversion Cycle" || k === "Working Capital Days" ? "low" : undefined),
    ),
    numRow("P/E", a.fundamental.pe, b.fundamental.pe, fX(1)),
    numRow("P/B", a.fundamental.pb, b.fundamental.pb, fX(1)),
    numRow("EV / EBITDA", a.fundamental.evEbitda, b.fundamental.evEbitda, fX(1)),
    numRow("Total debt", bsA.total_debt, bsB.total_debt, fBig),
    numRow("Total equity", bsA.total_equity, bsB.total_equity, fBig),
    numRow("Debt to equity", de(bsA), de(bsB), fNum(2), "low"),
    numRow("Total assets", bsA.total_assets, bsB.total_assets, fBig),
    txtRow("Valuation rating", a.fundamental.valuationRating, b.fundamental.valuationRating),
    txtRow("Relative valuation stance", a.fundamental.valuationStance, b.fundamental.valuationStance),
  ];

  // ── valuation ──
  const va_: Any = da.valuation ?? {};
  const vb_: Any = db.valuation ?? {};
  const cA = va_.core ?? {};
  const cB = vb_.core ?? {};
  const sA = va_.scenario ?? {};
  const sB = vb_.scenario ?? {};
  const bA = va_.bayesian ?? {};
  const bB = vb_.bayesian ?? {};
  const dpA = va_.dupont ?? {};
  const dpB = vb_.dupont ?? {};
  const dsA = va_.distress ?? {};
  const dsB = vb_.distress ?? {};
  const wA = va_.wacc ?? {};
  const wB = vb_.wacc ?? {};
  const valRows: CmpRow[] = [
    txtRow("Method", cA.methodology, cB.methodology),
    numRow("Quote", cA.current_price, cB.current_price, fInr(2)),
    numRow("DCF intrinsic value per share", cA.intrinsic_value_per_share, cB.intrinsic_value_per_share, fInr(2)),
    numRow("Upside to DCF value", cA.upside_downside_pct, cB.upside_downside_pct, fPct(1), "high"),
    txtRow("Valuation tier", cA.valuation_tier, cB.valuation_tier),
    numRow("WACC", wA.wacc ?? cA.wacc, wB.wacc ?? cB.wacc, fFrac(2)),
    numRow("Cost of equity", wA.cost_of_equity, wB.cost_of_equity, fFrac(2)),
    numRow("Beta used", wA.beta, wB.beta, fNum(2)),
    numRow("Projected growth", cA.projected_growth_rate, cB.projected_growth_rate, fFrac(1)),
    numRow("Terminal growth", cA.terminal_growth_rate, cB.terminal_growth_rate, fFrac(1)),
    numRow("Enterprise value", cA.enterprise_value, cB.enterprise_value, fBig),
    numRow("Equity value", cA.equity_value, cB.equity_value, fBig),
    numRow("Bull case price", sA.bull_case_price, sB.bull_case_price, fInr(2)),
    numRow("Bull case upside", sA.bull_case_upside_pct, sB.bull_case_upside_pct, fPct(1), "high"),
    numRow("Base case upside", sA.base_case_upside_pct, sB.base_case_upside_pct, fPct(1), "high"),
    numRow("Bear case price", sA.bear_case_price, sB.bear_case_price, fInr(2)),
    numRow("Bear case upside", sA.bear_case_upside_pct, sB.bear_case_upside_pct, fPct(1), "high"),
    numRow("Bayesian median value", bA.bayesian_median_price, bB.bayesian_median_price, fInr(2)),
    numRow("Bayesian 10th percentile", bA.p10_conservative_price, bB.p10_conservative_price, fInr(2)),
    numRow("Bayesian 90th percentile", bA.p90_optimistic_price, bB.p90_optimistic_price, fInr(2)),
    numRow("Probability the price is below value", bA.prob_undervaluation_pct, bB.prob_undervaluation_pct, fPct(1), "high"),
    numRow("DuPont ROE", dpA.roe_pct, dpB.roe_pct, fPct(1), "high"),
    numRow("EBIT margin", dpA.ebit_margin_pct, dpB.ebit_margin_pct, fPct(1), "high"),
    numRow("Asset turnover", dpA.asset_turnover, dpB.asset_turnover, fNum(2), "high"),
    numRow("Financial leverage", dpA.financial_leverage, dpB.financial_leverage, fNum(2), "low"),
    txtRow("ROE quality", dpA.roe_quality_tier, dpB.roe_quality_tier),
    numRow("Composite solvency index", dsA.composite_solvency_index, dsB.composite_solvency_index, fNum(1), "high"),
    txtRow("Credit rating", dsA.credit_rating, dsB.credit_rating),
    txtRow("Distress tier", dsA.distress_risk_tier, dsB.distress_risk_tier),
  ];

  // ── return and volatility ──
  const qa: Any = da.quant ?? {};
  const qb: Any = db.quant ?? {};
  const volModel = (q: Any, k: string) => g(q, "volatility", k, "current_vol_annualized");
  const horizon = (s: ListedSummary, days: number, key: "p10" | "p50" | "p90") => s.forecast.horizons.find((h) => h.days === days)?.[key] ?? null;
  const varRow = (label: string, key: string, m: string): CmpRow => numRow(label, g(a, "risk", key, m), g(b, "risk", key, m), fFrac(2), "low");
  const volRows: CmpRow[] = [
    numRow("Annualised volatility", a.risk.annualisedVol, b.risk.annualisedVol, fFrac(1), "low"),
    numRow("Consensus volatility", a.risk.consensusVol, b.risk.consensusVol, fFrac(1), "low"),
    txtRow("Best-fitting model", a.risk.recommendedVolModel, b.risk.recommendedVolModel),
    numRow("GARCH current volatility", volModel(qa, "garch"), volModel(qb, "garch"), fFrac(1), "low"),
    numRow("EGARCH current volatility", volModel(qa, "egarch"), volModel(qb, "egarch"), fFrac(1), "low"),
    numRow("FIGARCH current volatility", volModel(qa, "figarch"), volModel(qb, "figarch"), fFrac(1), "low"),
    numRow("Volatility persistence (GARCH)", g(qa, "volatility", "garch", "persistence"), g(qb, "volatility", "garch", "persistence"), fNum(3)),
    numRow("Shock half-life, days (GARCH)", g(qa, "volatility", "garch", "half_life_days"), g(qb, "volatility", "garch", "half_life_days"), fNum(1)),
    numRow("Daily skewness", g(qa, "var", "skewness"), g(qb, "var", "skewness"), fNum(2)),
    numRow("Excess kurtosis", g(qa, "var", "excess_kurtosis"), g(qb, "var", "excess_kurtosis"), fNum(2), "low"),
    varRow("1-day VaR 95, historical", "var1d95", "historical"),
    varRow("1-day VaR 95, parametric", "var1d95", "parametric"),
    varRow("1-day VaR 95, Cornish-Fisher", "var1d95", "cornish_fisher"),
    varRow("1-day VaR 95, Monte Carlo", "var1d95", "monte_carlo"),
    varRow("1-day VaR 99, historical", "var1d99", "historical"),
    varRow("1-day VaR 99, Monte Carlo", "var1d99", "monte_carlo"),
    txtRow("Forecast bias", a.forecast.bias, b.forecast.bias),
    txtRow("Forecast confidence", a.forecast.confidence, b.forecast.confidence),
    ...[5, 21, 63].flatMap((d) => [
      numRow(`${d}-day weak case (10th percentile)`, horizon(a, d, "p10"), horizon(b, d, "p10"), fPct(1), "high"),
      numRow(`${d}-day median`, horizon(a, d, "p50"), horizon(b, d, "p50"), fPct(1), "high"),
      numRow(`${d}-day strong case (90th percentile)`, horizon(a, d, "p90"), horizon(b, d, "p90"), fPct(1), "high"),
    ]),
  ];

  // ── risk, microstructure, XAI ──
  const riskRows: CmpRow[] = [
    numRow("Distance to default", a.risk.distanceToDefault, b.risk.distanceToDefault, fNum(1), "high", "In standard deviations"),
    numRow("Default probability", a.risk.defaultProbabilityPct, b.risk.defaultProbabilityPct, fPct(2), "low"),
    txtRow("Market regime", a.risk.regime, b.risk.regime),
    numRow("Regime probability", a.risk.regimeProbability, b.risk.regimeProbability, fFrac(0)),
    numRow("Regime stability score", g(qa, "regime", "regime_stability_score"), g(qb, "regime", "regime_stability_score"), fNum(2), "high"),
    txtRow("Regime guidance", a.risk.regimeGuidance, b.risk.regimeGuidance),
    numRow("VPIN order-flow toxicity", g(qa, "microstructure", "vpin_score"), g(qb, "microstructure", "vpin_score"), fNum(2), "low"),
    txtRow("VPIN regime", g(qa, "microstructure", "vpin_regime"), g(qb, "microstructure", "vpin_regime")),
    numRow("Kyle's lambda (bps per ₹10M)", g(qa, "microstructure", "kyle_lambda_bps_per_10m"), g(qb, "microstructure", "kyle_lambda_bps_per_10m"), fNum(2), "low"),
    numRow("Amihud illiquidity", g(qa, "microstructure", "amihud_illiquidity_mean"), g(qb, "microstructure", "amihud_illiquidity_mean"), (v) => (v == null ? dash : v.toExponential(2)), "low"),
    numRow("Jump intensity", g(qa, "microstructure", "realized_jump_intensity_pct"), g(qb, "microstructure", "realized_jump_intensity_pct"), fPct(1), "low"),
    numRow("Order-flow imbalance", g(qa, "microstructure", "order_flow_imbalance_pct"), g(qb, "microstructure", "order_flow_imbalance_pct"), fPct(1)),
    txtRow("Liquidity grade", g(qa, "microstructure", "institutional_liquidity_grade"), g(qb, "microstructure", "institutional_liquidity_grade")),
    numRow("Model base expected return", g(qa, "xai", "base_expected_return"), g(qb, "xai", "base_expected_return"), fFrac(2)),
    numRow("Forecast return after drivers", g(qa, "xai", "final_forecasted_return"), g(qb, "xai", "final_forecasted_return"), fFrac(2), "high"),
    txtRow("Top positive driver", g(qa, "xai", "top_positive_driver"), g(qb, "xai", "top_positive_driver")),
    txtRow("Top negative driver", g(qa, "xai", "top_negative_driver"), g(qb, "xai", "top_negative_driver")),
  ];

  // ── macro: indices and global markets ──
  const mA: Any = g(da, "macro") ?? {};
  const mB: Any = g(db, "macro") ?? {};
  const idxNames: string[] = [];
  for (const m of [mA.nifty ?? {}, mB.nifty ?? {}]) for (const k of Object.keys(m)) if (!idxNames.includes(k)) idxNames.push(k);
  const gNames: string[] = [];
  for (const m of [mA.global ?? {}, mB.global ?? {}]) for (const k of Object.keys(m)) if (!gNames.includes(k)) gNames.push(k);
  const macroRows: CmpRow[] = [
    ...idxNames.flatMap((k) => [
      numRow(`${k}, window return`, g(mA, "nifty", k, "window_return") != null ? g(mA, "nifty", k, "window_return") * 100 : null, g(mB, "nifty", k, "window_return") != null ? g(mB, "nifty", k, "window_return") * 100 : null, fPct(1)),
    ]),
    ...gNames.map((k) =>
      numRow(`${k}, window return`, g(mA, "global", k, "window_return") != null ? g(mA, "global", k, "window_return") * 100 : null, g(mB, "global", k, "window_return") != null ? g(mB, "global", k, "window_return") * 100 : null, fPct(1)),
    ),
  ];

  // ── peers ──
  const pA: Any = da.peers ?? {};
  const pB: Any = db.peers ?? {};
  const mults: string[] = [];
  for (const t of [pA.table ?? [], pB.table ?? []]) for (const r of t) if (r.multiple && !mults.includes(r.multiple)) mults.push(r.multiple);
  const find = (p: Any, m: string) => (p.table ?? []).find((r: Any) => r.multiple === m);
  const peerRows: CmpRow[] = [
    txtRow("Sector", pA.sector, pB.sector),
    txtRow("Overall valuation rating", pA.rating, pB.rating),
    txtRow("Relative stance", pA.stance, pB.stance),
    numRow("Composite relative score", pA.composite_score, pB.composite_score, fNum(1), "high"),
    numRow("Peer-harmonised target price", pA.target_price, pB.target_price, fInr(2)),
    numRow("Implied upside against peers", pA.implied_upside_pct, pB.implied_upside_pct, fPct(1), "high"),
    ...mults.flatMap((m) => [
      numRow(`${m}`, find(pA, m)?.value, find(pB, m)?.value, fNum(2)),
      numRow(`${m}, versus sector median`, find(pA, m)?.variance_pct, find(pB, m)?.variance_pct, fPct(1), undefined, "Negative is a discount to the sector"),
    ]),
  ];

  // ── systemic and portfolio ──
  const sysA: Any = da.portfolio ?? {};
  const sysB: Any = db.portfolio ?? {};
  const sysRows: CmpRow[] = [
    numRow("HRP portfolio volatility", sysA.portfolio_volatility_annualized, sysB.portfolio_volatility_annualized, fFrac(1), "low"),
    numRow("HRP expected return", sysA.portfolio_expected_return_annualized, sysB.portfolio_expected_return_annualized, fFrac(1), "high"),
    numRow("Risk-parity weight in the basket", g(sysA, "hrp", "weights", a.ticker ?? ""), g(sysB, "hrp", "weights", b.ticker ?? ""), fFrac(1)),
    numRow("Total spillover connectedness", g(da, "spillover", "total_connectedness_index"), g(db, "spillover", "total_connectedness_index"), fNum(1), "low"),
  ];

  return (
    <div className="space-y-4">
      <CompareSection title="Investment call" subtitle="The verdict and its levels" icon={Target} rows={callRows} nameA={A} nameB={B} footnote="A model output that combines the event study, technicals, valuation, macro and solvency scores. It is not investment advice." />
      <CompareSection title="Why each call" subtitle="Score of each weighted pillar, from -100 (bearish) to +100 (bullish)" icon={Scale} rows={pillarRows} nameA={A} nameB={B} />
      <DataCard title="Price performance" subtitle="Both companies and the benchmark, each rebased to 100 on the first date they share" icon={LineChart}>
        <CompareChart series={series} />
      </DataCard>
      <CompareSection title="Window statistics" subtitle="From each run's own price path" icon={TrendingUp} rows={perfRows} nameA={A} nameB={B} />
      <CompareSection title="Position sizing" subtitle="Half-Kelly weight and whole-share quantities" icon={Gauge} rows={sizingRows} nameA={A} nameB={B} />
      <CompareSection title="Market model and event study" subtitle="How the market and the news explain each stock" icon={Newspaper} rows={marketRows} nameA={A} nameB={B} footnote="Windows can differ between the two runs, so counts and event statistics are only roughly comparable." />
      <CompareSection title="Technicals" subtitle="Trend, momentum and the indicator tables" icon={Activity} rows={techRows} nameA={A} nameB={B} />
      <CompareSection title="Indicator signals" subtitle="Every indicator either run produced, side by side" icon={BarChart3} rows={indicatorRows(ta.indicators_table, tb.indicators_table)} nameA={A} nameB={B} />
      <CompareSection title="Technical strategy backtest" subtitle="A rules-based strategy replayed over each window" icon={FlaskConical} rows={techBack} nameA={A} nameB={B} />
      <CompareSection title="Financials" subtitle="Reported figures, ratios and balance sheet" icon={Landmark} rows={fundRows} nameA={A} nameB={B} footnote="Figures are in each company's reported unit; compare growth and ratios rather than raw sizes." />
      <CompareSection title="Valuation" subtitle="DCF, scenarios, Bayesian range, DuPont and solvency" icon={Calculator} rows={valRows} nameA={A} nameB={B} />
      <CompareSection title="Return and volatility" subtitle="Volatility models, value at risk and forecast ranges" icon={Waves} rows={volRows} nameA={A} nameB={B} />
      <CompareSection title="Risk, microstructure and drivers" subtitle="Solvency, regime, order flow and what drives the forecast" icon={Droplets} rows={riskRows} nameA={A} nameB={B} />
      <CompareSection title="Peer valuation" subtitle="Multiples against each company's own sector median" icon={Users} rows={peerRows} nameA={A} nameB={B} />
      <CompareSection title="Benchmarks and global markets" subtitle="How each index moved over each run's window (identical when the windows match)" icon={Globe2} rows={macroRows} nameA={A} nameB={B} />
      <CompareSection title="Portfolio and systemic" subtitle="Hierarchical risk parity and volatility spillover" icon={Activity} rows={sysRows} nameA={A} nameB={B} />
      {[a, b].some((s) => s.caveats.length > 0) ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[a, b].map((s, i) => (
            <DataCard key={i} title={`Caveats: ${s.company}`} icon={AlertTriangle}>
              <ul className="space-y-1.5 p-3 text-[0.8125rem] text-muted-foreground">
                {s.caveats.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            </DataCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}
