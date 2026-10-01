"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Calculator, Droplets, LineChart, Newspaper, Percent, Scale, TrendingUp, Waves } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import type { Blk, UnlistedResearch, UnlistedSummary } from "@/types/analyzer";
import { CallTab } from "@/components/analyzer/dossier/call-tab";
import { Bullets, Empty, Pill, Stat, StatGrid, Table, Td, dash, inr, num, pct, stanceTone } from "@/components/analyzer/dossier/shared";

const p1 = (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : dash);
const money = (v: unknown, d = 2) => (typeof v === "number" ? `₹${formatINR(v, d)}` : dash);

function StatCell({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: string; hint?: string }) {
  return <Stat label={label} value={value} tone={tone} hint={hint} />;
}

// ── valuation ───────────────────────────────────────────────────────────────

function Sensitivity({ v }: { v: Blk }) {
  const cols: string[] = v.sensitivity.scale_columns;
  const rows: Blk[] = v.sensitivity.rows;
  const all = rows.flatMap((r) => cols.map((c) => Number(r[c]))).filter(Number.isFinite);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const price: number = v.price;
  return (
    <Table min={520} head={[{ label: "Illiquidity discount" }, ...cols.map((c) => ({ label: `Benchmark ${c.slice(1)}x`, right: true }))]}>
      {rows.map((r) => (
        <tr key={r.DLOM} className="border-b border-border last:border-0">
          <Td mono>{r.DLOM}</Td>
          {cols.map((c) => {
            const val = Number(r[c]);
            const t = hi > lo ? (val - lo) / (hi - lo) : 0.5;
            return (
              <Td key={c} right className={val >= price ? "text-up" : "text-foreground"}>
                <span className="rounded px-1.5 py-0.5" style={{ background: `hsl(var(--accent) / ${(0.05 + t * 0.22).toFixed(2)})` }}>
                  {formatINR(val, 2)}
                </span>
              </Td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}

function ValuationTab({ r }: { r: UnlistedResearch }) {
  const v = r.valuation;
  if (!v || !v.available) {
    return (
      <DataCard title="Valuation models" icon={Calculator}>
        <Empty>{v?.note ?? "No valuation model could be built for this company."}</Empty>
      </DataCard>
    );
  }
  const tone = v.upside_pct >= 15 ? "text-up" : v.upside_pct <= -15 ? "text-down" : undefined;
  const a: Blk = v.assumptions;
  const co: Blk = v.company_multiples;
  const bm: Blk = v.benchmark;
  return (
    <div className="space-y-4">
      <DataCard
        title="Fair value after an illiquidity discount"
        subtitle={`${v.models.length} model${v.models.length === 1 ? "" : "s"}, blended by weight`}
        icon={Calculator}
        badge={<Pill label={v.valuation_tier} tone={v.upside_pct >= 15 ? "up" : v.upside_pct <= -15 ? "down" : "flat"} />}
        footnote="An unlisted share cannot be sold freely, so every relative model is cut by a discount for lack of marketability. That discount, the equity risk premium and the growth rate are assumptions, not measurements."
      >
        <StatGrid cols={3}>
          <StatCell label="Quote" value={money(v.price)} />
          <StatCell label="Blended fair value" value={money(v.blended_fair_value)} />
          <StatCell label="Range across models" value={`${money(v.fair_value_low)} to ${money(v.fair_value_high)}`} />
          <StatCell label="Upside to fair value" value={pct(v.upside_pct, 1)} tone={tone} />
          <StatCell label="Illiquidity discount" value={`${a.dlom_pct}%`} />
          <StatCell label="Cost of equity" value={`${a.cost_of_equity_pct}%`} hint={a.risk_free_assumed ? "risk-free rate assumed" : "built on the 10-year G-Sec"} />
        </StatGrid>
      </DataCard>

      <DataCard title="Models" subtitle="How each fair value is built" icon={Scale}>
        <Table min={760} head={["Model", { label: "Fair value", right: true }, { label: "vs quote", right: true }, { label: "Weight", right: true }, "Inputs and caveat"]}>
          {v.models.map((m: Blk) => (
            <tr key={m.key} className="border-b border-border align-top last:border-0">
              <Td>
                <p className="font-medium">{m.name}</p>
                <p className="mt-0.5 text-2xs text-muted-foreground">{m.basis}</p>
              </Td>
              <Td right>{money(m.fair_value)}</Td>
              <Td right className={deltaColor(m.upside_pct)}>
                {pct(m.upside_pct, 1)}
              </Td>
              <Td right>{(m.weight_used * 100).toFixed(0)}%</Td>
              <Td>
                <p className="text-2xs text-muted-foreground">{Object.entries(m.inputs as Blk).map(([k, val]) => `${k.replace(/_/g, " ")}: ${String(val)}`).join(" · ")}</p>
                {m.caveat ? <p className="mt-0.5 text-2xs text-muted-foreground/80">{m.caveat}</p> : null}
              </Td>
            </tr>
          ))}
        </Table>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Multiples against the benchmark" subtitle={bm.name ? `Benchmark: ${bm.name}` : undefined} icon={Percent}>
          <Table min={360} head={["Multiple", { label: "Company", right: true }, { label: "Benchmark", right: true }]}>
            <tr className="border-b border-border"><Td>Price / Book</Td><Td right>{num(co.pb)}</Td><Td right>{num(bm.pb)}</Td></tr>
            <tr className="border-b border-border"><Td>Price / Earnings</Td><Td right>{num(co.pe)}</Td><Td right>{num(bm.pe)}</Td></tr>
            <tr className="border-b border-border"><Td>Book value per share</Td><Td right>{money(co.book_value)}</Td><Td right>{dash}</Td></tr>
            <tr className="border-b border-border"><Td>Return on equity (P/B ÷ P/E)</Td><Td right>{p1(co.roe_pct)}</Td><Td right>{dash}</Td></tr>
            <tr><Td>Debt / Equity</Td><Td right>{num(co.debt_equity)}</Td><Td right>{dash}</Td></tr>
          </Table>
        </DataCard>

        <DataCard title="Assumptions" subtitle="What is assumed rather than measured" icon={AlertTriangle}>
          <Bullets
            items={[
              `Illiquidity discount ${a.dlom_pct}% (20 to 30% is the usual range for minority unlisted stakes).`,
              `Cost of equity ${a.cost_of_equity_pct}% = risk-free ${a.risk_free_pct}%${a.risk_free_assumed ? " (assumed: the live yield could not be retrieved)" : " (10-year G-Sec)"} plus beta times a ${a.equity_risk_premium_pct}% equity risk premium.`,
              `Terminal growth ${a.terminal_growth_pct}% in the justified P/B model.`,
              "Benchmark multiples are NSE index averages for large listed companies, so a small private company can deserve less.",
            ]}
          />
        </DataCard>
      </div>

      <DataCard title="Sensitivity" subtitle="Blended fair value if the discount or the benchmark multiple moves" icon={Activity}>
        <Sensitivity v={v} />
      </DataCard>
    </div>
  );
}

// ── trend ───────────────────────────────────────────────────────────────────

function TrendTab({ r }: { r: UnlistedResearch }) {
  const t = r.technical;
  const prof = r.price_profile;
  const rev: Blk = prof.revisions ?? {};
  return (
    <div className="space-y-4">
      <DataCard title="Price profile" subtitle="Where the dealer price has been and how it is revised" icon={LineChart}>
        <StatGrid cols={4}>
          <StatCell label="Window return" value={pct(prof.window_return_pct, 1)} tone={deltaColor(prof.window_return_pct ?? 0)} />
          <StatCell label="CAGR" value={p1(prof.cagr_pct)} />
          <StatCell label="1M · 3M" value={`${p1(prof.change_1m_pct)} · ${p1(prof.change_3m_pct)}`} />
          <StatCell label="6M · 12M" value={`${p1(prof.change_6m_pct)} · ${p1(prof.change_12m_pct)}`} />
          <StatCell label="52-week position" value={prof.range_52w?.position_pct != null ? `${prof.range_52w.position_pct.toFixed(0)}% of range` : dash} />
          <StatCell label="Max drawdown" value={p1(prof.drawdown?.max_drawdown_pct)} tone="text-down" />
          <StatCell label="Price revisions" value={rev.count} />
          <StatCell label="Median gap" value={rev.median_gap_days != null ? `${rev.median_gap_days.toFixed(0)} days` : dash} hint={`${rev.days_since_last} days since the last one`} />
          <StatCell label="Average revision" value={p1(rev.mean_abs_move_pct)} />
          <StatCell label="Revisions upward" value={p1(rev.up_share_pct)} />
        </StatGrid>
      </DataCard>

      <DataCard
        title="Trend and momentum"
        subtitle={t?.basis ?? "Weekly bars"}
        icon={TrendingUp}
        badge={t?.composite_rating ? <Pill label={`${t.composite_rating} (${num(t.composite_score, 0)})`} tone={stanceTone(t.composite_rating)} /> : undefined}
      >
        {!t || !t.indicators_table ? (
          <Empty>{t?.note ?? "Too little weekly history for trend indicators."}</Empty>
        ) : (
          <Table min={560} head={["Indicator", { label: "Value", right: true }, "Signal", "Reading"]}>
            {(t.indicators_table as Blk[]).map((row) => (
              <tr key={row.indicator} className="border-b border-border last:border-0">
                <Td>{row.indicator}</Td>
                <Td right>{row.value}</Td>
                <Td>
                  <Pill label={row.signal} tone={row.signal === "Oversold" ? "up" : row.signal === "Overbought" ? "down" : stanceTone(row.signal)} />
                </Td>
                <Td className="text-2xs text-muted-foreground">{row.note}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>
    </div>
  );
}

// ── risk and outlook ────────────────────────────────────────────────────────

function RiskTab({ r }: { r: UnlistedResearch }) {
  const k = r.risk;
  const liq: Blk = k.liquidity ?? {};
  const var1: Blk | undefined = k.var_1m;
  const mm = r.market_model;
  const fc = r.forecast;
  const mmRows = Object.entries(mm).filter(([, b]) => b && typeof b === "object" && "beta" in (b as Blk)) as [string, Blk][];

  return (
    <div className="space-y-4">
      <DataCard title="Risk, leverage and liquidity" subtitle={`Measured on ${k.months} monthly return${k.months === 1 ? "" : "s"}`} icon={Droplets} footnote={k.frequency}>
        <StatGrid cols={4}>
          <StatCell label="Annualised volatility" value={p1(k.annualised_vol_pct)} />
          <StatCell label="Worst · best month" value={`${p1(k.worst_month_pct)} · ${p1(k.best_month_pct)}`} />
          <StatCell label="Positive months" value={p1(k.positive_months_pct)} />
          <StatCell label="Skew · kurtosis" value={`${num(k.skew)} · ${num(k.excess_kurtosis)}`} />
          <StatCell label="Price unchanged on" value={liq.stale_day_share_pct != null ? `${liq.stale_day_share_pct.toFixed(0)}% of days` : dash} hint="High means a quote, not a market" />
          <StatCell label="Lot size" value={liq.lot_size != null ? `${formatINR(liq.lot_size, 0)} shares` : dash} />
          <StatCell label="Minimum ticket" value={liq.min_ticket_inr != null ? money(liq.min_ticket_inr, 0) : dash} />
          <StatCell label="Debt / Equity" value={num(k.leverage?.debt_to_equity)} />
          {k.regime ? <StatCell label="Volatility regime" value={k.regime.state} hint={`${k.regime.recent_6m_vol_vs_full}x full-sample`} /> : null}
        </StatGrid>
        {k.note ? <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">{k.note}</p> : null}
      </DataCard>

      {var1 ? (
        <DataCard title="One-month value at risk" subtitle="A loss that was not exceeded in 95 or 99 of 100 months" icon={Waves} footnote={var1.note}>
          <Table min={420} head={["Method", { label: "95%", right: true }, { label: "99%", right: true }]}>
            <tr className="border-b border-border"><Td>Historical</Td><Td right>{p1(var1.historical_95_pct)}</Td><Td right>{p1(var1.historical_99_pct)}</Td></tr>
            <tr className="border-b border-border"><Td>Parametric (normal)</Td><Td right>{p1(var1.parametric_95_pct)}</Td><Td right>{p1(var1.parametric_99_pct)}</Td></tr>
            <tr className="border-b border-border"><Td>Cornish-Fisher</Td><Td right>{p1(var1.cornish_fisher_95_pct)}</Td><Td right>{dash}</Td></tr>
            <tr><Td>Expected shortfall</Td><Td right>{p1(var1.expected_shortfall_95_pct)}</Td><Td right>{dash}</Td></tr>
          </Table>
        </DataCard>
      ) : null}

      <DataCard title="Market sensitivity" subtitle="Monthly returns against Nifty 50 and the sector index" icon={Activity} footnote={mm.interpretation}>
        {mmRows.length === 0 ? (
          <Empty>{mm.note ?? "Not enough overlapping months to estimate a beta."}</Empty>
        ) : (
          <Table min={620} head={["Benchmark", { label: "Beta", right: true }, { label: "t-stat", right: true }, { label: "R²", right: true }, { label: "Correlation", right: true }, { label: "Months", right: true }]}>
            {mmRows.map(([name, b]) => (
              <tr key={name} className="border-b border-border last:border-0">
                <Td>{name}</Td>
                <Td right>{num(b.beta)}</Td>
                <Td right>{num(b.beta_t, 1)}</Td>
                <Td right>{num(b.r_squared)}</Td>
                <Td right>{num(b.correlation)}</Td>
                <Td right>{b.months}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>

      <DataCard
        title="Outcome ranges"
        subtitle={fc?.horizons ? `${fc.confidence} confidence · bias ${String(fc.bias).toLowerCase()}` : undefined}
        icon={TrendingUp}
        footnote={fc?.note}
      >
        {!fc?.horizons ? (
          <Empty>{fc?.note ?? "Too little history for a forecast."}</Empty>
        ) : (
          <Table min={640} head={["Horizon", { label: "Weak case (10th)", right: true }, { label: "Median", right: true }, { label: "Strong case (90th)", right: true }, { label: "Chance of loss", right: true }]}>
            {(fc.horizons as Blk[]).map((h) => (
              <tr key={h.months} className="border-b border-border last:border-0">
                <Td>{h.months} month{h.months > 1 ? "s" : ""}</Td>
                <Td right className="text-down">{money(h.p10_price)} ({p1(h.p10_return_pct)})</Td>
                <Td right>{money(h.p50_price)} ({p1(h.p50_return_pct)})</Td>
                <Td right className="text-up">{money(h.p90_price)} ({p1(h.p90_return_pct)})</Td>
                <Td right>{p1(h.prob_loss_pct)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>
    </div>
  );
}

// ── timeline and news (the pre-existing view) ──────────────────────────────

function TimelineTab({ s }: { s: UnlistedSummary }) {
  const p = s.price;
  return (
    <div className="space-y-4">
      <DataCard
        title="Dealer-price trajectory"
        subtitle={p.firstDate && p.lastDate ? `${p.firstDate} → ${p.lastDate} · ${p.observations} quotes` : undefined}
        icon={LineChart}
        footnote="Unlisted prices are private dealer quotes, not exchange prints. Price gaps are attributed to headlines by timing only."
      >
        <StatGrid>
          <Stat label="First quote" value={inr(p.first)} />
          <Stat label="Latest quote" value={inr(p.last)} />
          <Stat label="Change" value={pct(p.changePct)} tone={p.changePct != null ? deltaColor(p.changePct) : undefined} />
          <Stat label="High" value={inr(p.high)} />
          <Stat label="Low" value={inr(p.low)} />
          <Stat label="Price revisions" value={s.moveCount} />
        </StatGrid>
      </DataCard>

      <DataCard title="Largest price moves" subtitle="With the headlines published between the two quotes" icon={Newspaper}>
        {s.moves.length === 0 ? (
          <Empty>No price revisions in this window.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {s.moves.map((m, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-sm">{m.from} → {m.to}</p>
                  <p className={cn("font-mono text-sm", deltaColor(m.changePct))}>
                    {inr(m.startPrice)} → {inr(m.endPrice)} ({pct(m.changePct)})
                  </p>
                </div>
                {m.headlines.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {m.headlines.map((h, j) => (
                      <li key={j} className="text-[0.8125rem] text-muted-foreground">
                        {h.url ? (
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">
                            {h.headline}
                          </a>
                        ) : (
                          h.headline
                        )}
                        {h.source ? <span className="ml-1.5 text-2xs">· {h.source}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-2xs text-muted-foreground">No headline found in this window.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}

function MacroTab({ s }: { s: UnlistedSummary }) {
  const m = s.macro as Blk | null;
  if (!m) return <DataCard title="Macro backdrop" icon={Activity}><Empty>No macro indicators were retrieved for this run.</Empty></DataCard>;
  const rows: [string, string][] = [
    ["Repo rate", m.repo_rate?.current_rate_pct != null ? `${m.repo_rate.current_rate_pct}%` : dash],
    ["CPI inflation", m.cpi_inflation?.value != null ? `${m.cpi_inflation.value}%` : dash],
    ["IIP growth", m.iip_growth?.value != null ? `${m.iip_growth.value}%` : dash],
    ["Manufacturing PMI", m.pmi?.composite != null ? String(m.pmi.composite) : dash],
    ["8 core industries (YoY)", m.eight_core_industries?.combined_growth_yoy_pct != null ? `${m.eight_core_industries.combined_growth_yoy_pct}%` : dash],
    ["India 10-year G-Sec", m.sovereign_yields?.india_10y_pct != null ? `${m.sovereign_yields.india_10y_pct}%` : dash],
    ["US 10-year yield", m.sovereign_yields?.us_10y_pct != null ? `${m.sovereign_yields.us_10y_pct}%` : dash],
    ["Fed funds effective", m.fed_funds_rate?.effective_rate_pct != null ? `${m.fed_funds_rate.effective_rate_pct}%` : dash],
    ["Brent crude (window)", m.crude_oil?.change != null ? `${(m.crude_oil.change * 100).toFixed(1)}%` : dash],
  ];
  return (
    <DataCard title="Macro backdrop" subtitle="Live releases, nothing assumed for indicators that could not be retrieved" icon={Activity}>
      <Table min={420} head={["Indicator", { label: "Latest", right: true }]}>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-border last:border-0">
            <Td>{k}</Td>
            <Td right>{v}</Td>
          </tr>
        ))}
      </Table>
    </DataCard>
  );
}

// ── shell ───────────────────────────────────────────────────────────────────

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 border-l border-border/70 px-3 py-1.5 first:border-l-0">
      <p className="truncate text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("truncate font-mono text-sm font-semibold leading-tight tabular-nums", tone)}>{value}</p>
      {sub ? <p className="truncate font-mono text-[0.625rem] leading-tight text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function KeyStrip({ s, r }: { s: UnlistedSummary; r: UnlistedResearch }) {
  const v = s.verdict;
  const val = r.valuation;
  const tiles: React.ReactNode[] = [];
  if (v) {
    tiles.push(
      <div key="call" className="col-span-2 flex min-w-0 flex-col justify-center gap-1 px-3 py-1.5">
        <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Call</p>
        {v.call ? <Pill label={v.call} tone={stanceTone(v.call)} /> : dash}
      </div>,
      <Tile key="conv" label="Conviction" value={num(v.conviction, 1)} sub="of 100" />,
      <Tile key="px" label="Quote" value={inr(v.price)} />,
      <Tile key="t1" label="Target 1" value={inr(v.target1, 2)} sub={pct(v.target1Pct, 1)} tone="text-up" />,
      <Tile key="stop" label="Stop" value={inr(v.stop, 2)} sub={v.stopPct != null ? `−${v.stopPct.toFixed(1)}%` : undefined} tone="text-down" />,
    );
  }
  if (val?.available) {
    tiles.push(
      <Tile key="fv" label="Fair value" value={inr(val.blended_fair_value, 2)} sub={`${pct(val.upside_pct, 1)} · ${val.valuation_tier}`} tone={deltaColor(val.upside_pct)} />,
    );
  }
  tiles.push(
    <Tile key="tech" label="Trend" value={r.technical?.composite_rating ?? dash} sub={r.technical?.composite_score != null ? `score ${num(r.technical.composite_score, 0)}` : undefined} />,
    <Tile key="vol" label="Volatility" value={p1(r.risk.annualised_vol_pct)} sub="annualised, monthly" />,
    <Tile key="lot" label="Min ticket" value={r.risk.liquidity?.min_ticket_inr != null ? money(r.risk.liquidity.min_ticket_inr, 0) : dash} sub={r.risk.liquidity?.lot_size != null ? `${formatINR(r.risk.liquidity.lot_size, 0)} shares` : undefined} />,
  );
  return (
    <div className="mb-3 grid grid-cols-2 gap-y-1 rounded-xl border border-border bg-surface sm:grid-cols-4 lg:grid-cols-8">{tiles}</div>
  );
}

const TABS = ["call", "valuation", "trend", "risk", "timeline", "macro"] as const;
const LABELS: Record<(typeof TABS)[number], string> = {
  call: "Call & Sizing",
  valuation: "Valuation",
  trend: "Price & Trend",
  risk: "Risk & Outlook",
  timeline: "Timeline & Moves",
  macro: "Macro",
};

/** The research dossier for a finished unlisted-company analysis. */
export function UnlistedDossier({ s }: { s: UnlistedSummary }) {
  const r = s.research!;
  const [tab, setTab] = useState<(typeof TABS)[number]>("call");

  return (
    <div className="dossier">
      <KeyStrip s={s} r={r} />
      {r.data_quality.thin ? (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-flat/40 bg-flat/[0.07] px-4 py-2.5 text-2xs text-flat">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Short record: {r.data_quality.revisions} price revisions over {r.data_quality.months ?? 0} months of monthly returns. Statistics and the confidence of the call are
          limited accordingly.
        </p>
      ) : null}
      <div role="tablist" aria-label="Research dossier sections" className="sticky top-[84px] z-30 -mx-1 mb-3 flex gap-0.5 overflow-x-auto border-b border-border bg-background/90 px-1 backdrop-blur-md">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={cn("relative shrink-0 px-2.5 py-2 text-[0.8125rem] transition-colors", t === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {LABELS[t]}
            {t === tab ? (
              <motion.span layoutId="unlisted-dossier-underline" className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_10px_hsl(var(--accent)/0.7)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
            ) : null}
          </button>
        ))}
      </div>
      <div key={tab} role="tabpanel" className="animate-fade-up">
        {tab === "call" ? <CallTab s={{ verdict: s.verdict, detail: { sizing: r.sizing, holding: r.holding, pillar_rationales: r.pillar_rationales } }} /> : null}
        {tab === "valuation" ? <ValuationTab r={r} /> : null}
        {tab === "trend" ? <TrendTab r={r} /> : null}
        {tab === "risk" ? <RiskTab r={r} /> : null}
        {tab === "timeline" ? <TimelineTab s={s} /> : null}
        {tab === "macro" ? <MacroTab s={s} /> : null}
      </div>
      <p className="mt-4 text-2xs text-muted-foreground">{r.data_quality.notes.join(" ")}</p>
    </div>
  );
}

export { TimelineTab as UnlistedTimeline };
