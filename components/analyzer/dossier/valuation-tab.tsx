import { AlertTriangle, Calculator, Dices, Percent, Scale, ShieldCheck, TrendingUp } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, inr, num, pct, stanceTone } from "./shared";

const cr = (v: unknown) => (typeof v === "number" ? `₹${formatINR(v, 0)} Cr` : dash);
const ratioPct = (v: unknown, d = 2) => (typeof v === "number" ? `${(v * 100).toFixed(d)}%` : dash);

function Sensitivity({ rows, price }: { rows: Blk[]; price: number | null }) {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]);
  const vals = rows.flatMap((r) => keys.slice(1).map((k) => Number(r[k]))).filter((n) => Number.isFinite(n));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return (
    <Table min={520} head={keys.map((k, i) => ({ label: k.replace("g=", "g = "), right: i > 0 }))}>
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-border last:border-0">
          {keys.map((k, j) => {
            if (j === 0) return <Td key={k} mono>{String(r[k])}</Td>;
            const v = Number(r[k]);
            const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
            return (
              <Td key={k} right className={cn(price != null && v >= price ? "text-up" : "text-foreground")}>
                <span className="rounded px-1.5 py-0.5" style={{ background: `hsl(var(--accent) / ${(0.05 + t * 0.22).toFixed(2)})` }}>
                  {formatINR(v, 0)}
                </span>
              </Td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}

export function ValuationTab({ s }: { s: ListedSummary }) {
  const v = s.detail.valuation as Blk | null;
  const price = s.verdict?.price ?? null;

  if (!v) {
    return (
      <DataCard title="Corporate valuation" icon={Calculator}>
        <Empty>
          The valuation models need reported financials (operating profit, balance sheet, share count), and none were
          available for this company, so DCF, scenarios and the solvency ensemble cannot be built.
        </Empty>
      </DataCard>
    );
  }

  const core: Blk = v.core ?? {};
  const w: Blk = v.wacc ?? {};
  const sc: Blk = v.scenario ?? {};
  const bay: Blk = v.bayesian ?? {};
  const dup: Blk = v.dupont ?? {};
  const ds: Blk | undefined = v.distress;
  const up = core.upside_downside_pct as number | undefined;
  const fcff = (core.projected_fcff as number[] | undefined) ?? [];
  const pvf = (core.pv_projected_fcff as number[] | undefined) ?? [];
  const revenue = (bay.bayesian_revenue_forecast as Blk[] | undefined) ?? [];
  const pctl = (bay.percentiles_table as Blk[] | undefined) ?? [];

  return (
    <div className="space-y-4">
      {v.warning ? (
        <p role="note" className="flex gap-2 rounded-xl border border-flat/30 bg-flat/5 px-3 py-2 text-[0.8125rem] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flat" />
          {String(v.warning)}
        </p>
      ) : null}
      <DataCard
        title={v.isBank ? "Residual-income valuation" : "2-stage DCF intrinsic valuation"}
        subtitle={v.methodology ?? undefined}
        icon={Calculator}
        badge={core.valuation_tier ? <Pill label={String(core.valuation_tier).split("(")[0].trim()} tone={stanceTone(String(core.valuation_tier))} hint={String(core.valuation_tier)} /> : undefined}
        footnote={`Cash flows are built from the latest reported quarter's operating profit, taxed at 25% and annualised (${cr(v.baseNopat)}). Quarterly figures are lumpy, so treat the level as indicative; the sensitivity grid shows how much it depends on the discount rate and terminal growth.`}
      >
        <StatGrid cols={4}>
          <Stat label="Intrinsic value / share" value={inr(core.intrinsic_value_per_share)} tone="text-foreground" />
          <Stat label="Current price" value={inr(price)} />
          <Stat label="Upside / downside" value={pct(up, 1)} tone={up != null ? deltaColor(up) : undefined} />
          <Stat label="Discount rate" value={ratioPct(core.wacc ?? core.cost_of_equity_ke)} hint={v.isBank ? "Cost of equity" : "WACC"} />
          {!v.isBank ? (
            <>
              <Stat label="Enterprise value" value={cr(core.enterprise_value)} />
              <Stat label="Equity value" value={cr(core.equity_value)} />
              <Stat label="Stage-1 growth" value={ratioPct(core.projected_growth_rate, 1)} />
              <Stat label="Terminal growth" value={ratioPct(core.terminal_growth_rate, 1)} />
            </>
          ) : (
            <>
              <Stat label="Book value / share" value={inr(core.book_value_per_share)} />
              <Stat label="Sustainable ROE" value={core.baseline_roe_pct != null ? `${num(core.baseline_roe_pct, 1)}%` : dash} />
              <Stat label="Current P/B" value={core.current_pb_ratio != null ? `${num(core.current_pb_ratio)}x` : dash} />
            </>
          )}
        </StatGrid>
        {fcff.length > 0 ? (
          <Table min={560} head={["Year", ...fcff.map((_, i) => ({ label: `Y${i + 1}`, right: true }))]}>
            <tr className="border-t border-border">
              <Td>Projected FCFF</Td>
              {fcff.map((f, i) => <Td key={i} right>{formatINR(f, 0)}</Td>)}
            </tr>
            <tr className="border-t border-border">
              <Td>Present value</Td>
              {pvf.map((f, i) => <Td key={i} right>{formatINR(f, 0)}</Td>)}
            </tr>
          </Table>
        ) : null}
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Sensitivity" subtitle={`Value per share (₹) by ${v.isBank ? "cost of equity and ROE" : "WACC and terminal growth"}`} icon={TrendingUp} footnote="Green cells are at or above the current price.">
          <Sensitivity rows={(core.sensitivity_grid as Blk[]) ?? []} price={price} />
        </DataCard>

        <DataCard title="Three-case scenarios" subtitle="Bull, base and bear growth and discount-rate assumptions" icon={Scale}>
          <Table min={560} head={["Case", { label: "Growth", right: true }, { label: "WACC", right: true }, { label: "Price ₹", right: true }, { label: "vs now", right: true }]}>
            {((sc.scenario_table as Blk[]) ?? []).map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <Td>{String(r.Scenario ?? "")}</Td>
                <Td right>{num(r["Growth Rate (%)"], 1)}%</Td>
                <Td right>{num(r["WACC (%)"], 2)}%</Td>
                <Td right>{formatINR(Number(r["Intrinsic Price (₹)"]), 0)}</Td>
                <Td right className={deltaColor(Number(r["Upside / Downside (%)"]))}>{pct(Number(r["Upside / Downside (%)"]), 1)}</Td>
              </tr>
            ))}
          </Table>
        </DataCard>
      </div>

      <DataCard
        title="Monte Carlo (Bayesian) valuation"
        subtitle={`${bay.monte_carlo_runs ?? 1000} simulated paths with uncertain growth and discount rate`}
        icon={Dices}
        badge={bay.prob_undervaluation_pct != null ? <Pill label={`${num(bay.prob_undervaluation_pct, 1)}% chance undervalued`} tone={Number(bay.prob_undervaluation_pct) >= 50 ? "up" : "down"} /> : undefined}
        footnote="A fixed random seed is used, so the same inputs give the same distribution every time."
      >
        <div className="grid gap-6 p-4 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-2xs uppercase tracking-wider text-muted-foreground">Value per share, percentiles</p>
            <div className="space-y-3">
              {pctl.map((r, i) => {
                const val = Number(r["Intrinsic Value (₹)"]);
                const all = pctl.map((x) => Number(x["Intrinsic Value (₹)"]));
                const mx = Math.max(...all, price ?? 0);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{String(r.Percentile).split("(")[0]}</span>
                      <span className="font-mono">{formatINR(val, 0)} <span className={deltaColor(Number(r["Margin of Safety (%)"]))}>({pct(Number(r["Margin of Safety (%)"]), 0)})</span></span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent/70" style={{ width: `${(val / mx) * 100}%` }} />
                      {price != null ? <span className="absolute top-[-3px] h-3.5 w-0.5 bg-flat" style={{ left: `${(price / mx) * 100}%` }} title={`Current price ${formatINR(price)}`} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-2xs text-muted-foreground"><span className="mr-1 inline-block h-2.5 w-0.5 bg-flat align-middle" /> current price</p>
          </div>
          <div>
            <p className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">Five-year revenue forecast (₹ Cr)</p>
            <Table min={360} head={["Year", { label: "P10", right: true }, { label: "Median", right: true }, { label: "P90", right: true }]} className="-mx-4">
              {revenue.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <Td>{String(r.Horizon)}</Td>
                  <Td right>{formatINR(Number(r["P10 (Floor ₹ Cr)"]), 0)}</Td>
                  <Td right>{formatINR(Number(r["P50 (Median ₹ Cr)"]), 0)}</Td>
                  <Td right>{formatINR(Number(r["P90 (Ceiling ₹ Cr)"]), 0)}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <DataCard title="Cost of capital" icon={Percent} footnote="CAPM with a 5.5% equity risk premium and a 6.8% risk-free rate.">
          <StatGrid cols={2}>
            <Stat label="Beta" value={num(w.beta)} />
            <Stat label="Cost of equity" value={ratioPct(w.cost_of_equity)} />
            <Stat label="After-tax cost of debt" value={ratioPct(w.after_tax_cost_of_debt)} />
            <Stat label="Equity weight" value={ratioPct(w.weight_equity, 1)} />
            <Stat label="Debt weight" value={ratioPct(w.weight_debt, 1)} />
            <Stat label="WACC" value={ratioPct(w.wacc)} tone="text-foreground" />
          </StatGrid>
        </DataCard>

        <DataCard title="DuPont five-factor ROE" subtitle="What drives return on equity" icon={Percent} badge={dup.roe_quality_tier ? <Pill label={String(dup.roe_quality_tier).split("(")[0].trim()} tone="flat" hint={String(dup.roe_quality_tier)} /> : undefined}>
          <StatGrid cols={3}>
            <Stat label="Tax burden" value={num(dup.tax_burden)} />
            <Stat label="Interest burden" value={num(dup.interest_burden, 3)} />
            <Stat label="EBIT margin" value={dup.ebit_margin_pct != null ? `${num(dup.ebit_margin_pct, 1)}%` : dash} />
            <Stat label="Asset turnover" value={num(dup.asset_turnover)} />
            <Stat label="Leverage" value={num(dup.financial_leverage)} />
            <Stat label="ROE" value={dup.roe_pct != null ? `${num(dup.roe_pct, 1)}%` : dash} tone="text-foreground" />
          </StatGrid>
        </DataCard>
      </div>

      {ds ? (
        <DataCard
          title="Solvency & credit-distress ensemble"
          subtitle="Altman, Ohlson, Merton, Beneish, Piotroski and Cox models combined"
          icon={ShieldCheck}
          badge={<Pill label={`${ds.credit_rating} · ${num(ds.composite_solvency_index, 0)}/100`} tone={Number(ds.composite_solvency_index) >= 65 ? "up" : Number(ds.composite_solvency_index) >= 40 ? "flat" : "down"} hint={String(ds.distress_risk_tier ?? "")} />}
          footnote={ds.credit_opinion ?? undefined}
        >
          <StatGrid cols={4}>
            <Stat label="Altman Z" value={num(ds.altman_component?.altman_z_score)} hint={String(ds.altman_component?.solvency_zone ?? "")} />
            <Stat label="Ohlson default prob." value={ds.ohlson_component?.default_probability_pct != null ? `${num(ds.ohlson_component.default_probability_pct, 2)}%` : dash} hint={`O-score ${num(ds.ohlson_component?.ohlson_o_score, 2)}`} />
            <Stat label="Merton distance to default" value={ds.merton_component?.distance_to_default != null ? `${num(ds.merton_component.distance_to_default, 1)}σ` : dash} hint={String(ds.merton_component?.kmv_rating_tier ?? "")} />
            <Stat label="Piotroski F-score" value={ds.piotroski_component ? `${ds.piotroski_component.piotroski_f_score} / ${ds.piotroski_component.total_criteria}` : dash} hint={String(ds.piotroski_component?.fundamental_tier ?? "")} />
            <Stat label="Beneish M-score" value={num(ds.beneish_component?.beneish_m_score)} hint={ds.beneish_component?.is_manipulation_risk ? "Manipulation risk flagged" : "Not flagged"} />
            <Stat label="1-yr survival (Cox)" value={ds.cox_component?.survival_1yr_pct != null ? `${num(ds.cox_component.survival_1yr_pct, 1)}%` : dash} hint={`Hazard x${num(ds.cox_component?.hazard_ratio_multiplier)}`} />
          </StatGrid>
        </DataCard>
      ) : null}
    </div>
  );
}
