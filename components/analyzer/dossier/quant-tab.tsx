import { Activity, Crosshair, LineChart, Waves } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { Tip } from "@/components/ui/tip";
import { cn, deltaColor } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Bullets, Empty, Pill, Stat, StatGrid, Table, Td, dash, frac, num, pct, stanceTone, str } from "./shared";


const f4 = (v: unknown) => (typeof v === "number" ? v.toFixed(4) : dash);
const f6 = (v: unknown) => (typeof v === "number" ? v.toFixed(6) : dash);
const pv = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : dash);
type Field = [string, string, (v: unknown) => string, string];
const MODEL_CARDS: {
  key: string;
  title: string;
  subtitle: string;
  fields: Field[];
  badge: (b: Blk) => React.ReactNode;
  note: (b: Blk) => string | null;
}[] = [
  {
    key: "garch",
    title: "GARCH(1,1)",
    subtitle: "Symmetric volatility clustering",
    fields: [
      ["Baseline variance (ω)", "omega", f6, "The long-run variance floor the process reverts to."],
      ["ARCH α", "alpha", f4, "How strongly yesterday's shock feeds today's variance."],
      ["GARCH β", "beta", f4, "How persistent past variance is."],
      ["Shock half-life", "half_life_days", (v) => (typeof v === "number" ? `${v.toFixed(1)} days` : dash), "Days for a volatility shock to decay by half."],
    ],
    badge: (b) => <Pill label={`Persistence ${typeof b.persistence === "number" ? b.persistence.toFixed(3) : dash}`} tone="flat" />,
    note: (b) => (typeof b.current_vol_annualized === "number" ? `Current volatility ${pv(b.current_vol_annualized)} annualised; long-run ${pv(b.long_run_vol_annualized)}.` : null),
  },
  {
    key: "egarch",
    title: "EGARCH(1,1)",
    subtitle: "Exponential leverage effect",
    fields: [
      ["Asymmetry γ", "gamma", f4, "Positive: rises hit volatility more than falls. Negative: the usual leverage effect."],
      ["Magnitude α", "alpha", f4, "Response to the size of a shock."],
      ["Log-GARCH β", "beta", f4, "Persistence of log-variance."],
      ["Leverage effect", "leverage_effect", (v) => (typeof v === "string" ? v : dash), "Direction of the asymmetry."],
    ],
    badge: (b) => <Pill label={`Persistence ${typeof b.persistence === "number" ? b.persistence.toFixed(3) : dash}`} tone="flat" />,
    note: (b) => (typeof b.current_vol_annualized === "number" ? `Current volatility ${pv(b.current_vol_annualized)} annualised.` : null),
  },
  {
    key: "har_rv",
    title: "HAR-RV realised volatility",
    subtitle: "Heterogeneous autoregression on intraday bars",
    fields: [
      ["Daily β", "beta_daily", f4, "Weight on yesterday's realised volatility."],
      ["Weekly β", "beta_weekly", f4, "Weight on the past week."],
      ["Monthly β", "beta_monthly", f4, "Weight on the past month."],
      ["5-day forecast", "forecast_vol_5d_annualized", pv, "Annualised volatility forecast."],
    ],
    badge: (b) => <Pill label={`R² ${typeof b.r_squared === "number" ? b.r_squared.toFixed(3) : dash}`} tone="flat" />,
    note: () => null,
  },
  {
    key: "figarch",
    title: "FIGARCH(1,d,1)",
    subtitle: "Long-memory volatility decay",
    fields: [
      ["Fractional d", "d_fractional", f4, "Between 0 and 1. Higher means volatility shocks fade more slowly."],
      ["φ", "phi", f4, "Short-memory autoregressive term."],
      ["β", "beta", f4, "Variance persistence term."],
      ["Decay rate", "hyperbolic_decay_rate", f4, "Speed of the hyperbolic (slow) decay."],
    ],
    badge: (b) => <Pill label={`d = ${typeof b.d_fractional === "number" ? b.d_fractional.toFixed(3) : dash}`} tone="flat" />,
    note: (b) => (typeof b.current_vol_annualized === "number" ? `Current volatility ${pv(b.current_vol_annualized)} annualised.` : null),
  },
];

export function ReturnVolTab({ s }: { s: ListedSummary }) {
  const conf = (s.detail.quant.conformal ?? {}) as Blk;
  const vol = (s.detail.quant.volatility ?? {}) as Blk;
  const rows = (vol.comparison_table as Blk[] | undefined) ?? [];
  const horizons = Object.entries(conf).sort((a, b) => Number(a[0]) - Number(b[0]));
  const horizonRows = Object.entries((s.detail.forecast.horizons ?? {}) as Record<string, Blk>).sort((a, b) => Number(a[0]) - Number(b[0]));
  const har = (s.detail.forecast.har ?? {}) as Blk;
  const sixSigma = (s.detail.forecast.sixSigma ?? {}) as Record<string, Blk>;
  const sigmaKey = sixSigma["21"] ? "21" : Object.keys(sixSigma)[0];
  const sigmaRows = (sixSigma[sigmaKey]?.bands as Blk[]) ?? [];
  const sigmaHorizon = sixSigma[sigmaKey]?.label as string | undefined;

  return (
    <div className="space-y-4">
      <DataCard
        title="Multi-horizon return forecast"
        subtitle="Median with 80 / 90 / 95% conformal intervals"
        icon={LineChart}
        badge={s.forecast.bias ? <Pill label={s.forecast.bias} tone={stanceTone(s.forecast.bias)} /> : undefined}
        footnote={s.forecast.confidence ?? undefined}
      >
        {horizons.length === 0 ? (
          <Empty>No forecast was produced.</Empty>
        ) : (
          <Table
            min={640}
            head={["Horizon", { label: "P10", right: true }, { label: "Median", right: true }, { label: "P90", right: true }, { label: "±80%", right: true }, { label: "±90%", right: true }, { label: "±95%", right: true }]}
          >
            {horizons.map(([d, h]) => (
              <tr key={d} className="border-b border-border last:border-0">
                <Td mono>{d} trading days</Td>
                <Td right className="text-down">{pct(h.p10_return_pct)}</Td>
                <Td right className={deltaColor(h.p50_return_pct ?? 0)}>{pct(h.p50_return_pct)}</Td>
                <Td right className="text-up">{pct(h.p90_return_pct)}</Td>
                <Td right>{num(h.margin_80_pct)}%</Td>
                <Td right>{num(h.margin_90_pct)}%</Td>
                <Td right>{num(h.margin_95_pct)}%</Td>
              </tr>
            ))}
          </Table>
        )}
        {s.forecast.inferences.length > 0 ? <Bullets items={s.forecast.inferences} /> : null}
      </DataCard>

      <DataCard
        title="Volatility ensemble"
        subtitle="GARCH, EGARCH, HAR-RV and FIGARCH, fitted on the same window"
        icon={Waves}
        footnote={vol.recommended_model ? `Recommended: ${String(vol.recommended_model)}` : undefined}
      >
        {rows.length === 0 ? (
          <Empty>Too little price history to fit the volatility models.</Empty>
        ) : (
          <Table min={720} head={["Model", "Specification", { label: "σ (ann.)", right: true }, "Key parameter", { label: "AIC", right: true }, "Rank"]}>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <Td>{str(r["Model Name"] ?? r.Model)}</Td>
                <Td className="text-muted-foreground">{str(r.Specification)}</Td>
                <Td right>{str(r["Annualized Volatility (%)"])}</Td>
                <Td className="text-muted-foreground">{str(r["Key Parameter / Metric"])}</Td>
                <Td right>{str(r.AIC)}</Td>
                <Td>{str(r.Ranking)}</Td>
              </tr>
            ))}
          </Table>
        )}
        <StatGrid>
          <Stat label="Consensus vol (ann.)" value={frac(vol.consensus_annualized_vol, 1)} />
          <Stat label="Realised vol (ann.)" value={frac(s.risk.annualisedVol, 1)} />
          <Stat label="Intraday RV (ann.)" value={vol.intraday_realized_vol_annualized != null ? frac(vol.intraday_realized_vol_annualized, 1) : dash} />
        </StatGrid>
      </DataCard>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {MODEL_CARDS.map((m) => {
          const b: Blk = (vol[m.key] as Blk) ?? {};
          if (Object.keys(b).length === 0) return null;
          return (
            <DataCard key={m.key} title={m.title} subtitle={m.subtitle} icon={Activity} badge={m.badge(b)}>
              <StatGrid cols={2}>
                {m.fields.map(([label, field, fmt, tip]) => (
                  <Tip key={label} title={tip}>
                    <div className="cursor-help">
                      <Stat label={label} value={fmt(b[field])} />
                    </div>
                  </Tip>
                ))}
              </StatGrid>
              {m.note(b) ? <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">{m.note(b)}</p> : null}
            </DataCard>
          );
        })}
      </div>

      <DataCard
        title="Forecast trajectory schedule"
        subtitle="Expected path and probability bands at each horizon"
        icon={Crosshair}
        footnote="Bear, base and bull are the 10th, 50th and 90th percentiles; conformal bands are distribution-free and widen with the horizon."
      >
        {horizonRows.length === 0 ? (
          <Empty>No horizon table was produced.</Empty>
        ) : (
          <Table
            min={960}
            head={["Horizon", { label: "Expected ₹", right: true }, { label: "Bear (P10)", right: true }, { label: "Base (P50)", right: true }, { label: "Bull (P90)", right: true }, { label: "Vol (ann.)", right: true }, { label: "P(up)", right: true }, { label: "±90% band", right: true }, { label: "CVaR 95", right: true }]}
          >
            {horizonRows.map(([d, h]) => (
              <tr key={d} className="border-b border-border last:border-0">
                <Td>{str(h.label)}</Td>
                <Td right>{num(h.expected_price)} <span className={deltaColor(h.expected_return_pct ?? 0)}>({pct(h.expected_return_pct, 1)})</span></Td>
                <Td right className="text-down">{num(h.p10_bear_price)}</Td>
                <Td right>{num(h.p50_base_price)}</Td>
                <Td right className="text-up">{num(h.p90_bull_price)}</Td>
                <Td right>{num(h.forecast_volatility_annualized, 1)}%</Td>
                <Td right>{h.direction_probability_up != null ? `${(h.direction_probability_up * 100).toFixed(0)}%` : dash}</Td>
                <Td right>{num(h.conformal_lower_90_price, 0)} – {num(h.conformal_upper_90_price, 0)}</Td>
                <Td right>{num(h.cvar_95_pct, 1)}%</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>

      {sigmaRows.length > 0 ? (
        <DataCard
          title="Drawdown floor and upside target, ±1σ to ±6σ"
          subtitle={`Price bands by standard-deviation move over the ${sigmaHorizon ?? "selected"} horizon`}
          icon={Crosshair}
          footnote="A 6σ move should be vanishingly rare if returns were normal; real returns have fat tails, so the outer bands are a stress guide, not a probability."
        >
          <Table min={720} head={["Band", { label: "Coverage", right: true }, { label: "Floor ₹", right: true }, { label: "Floor %", right: true }, { label: "Ceiling ₹", right: true }, { label: "Ceiling %", right: true }, "Regime"]}>
            {sigmaRows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <Td>{str(r.sigma)}</Td>
                <Td right>{str(r.confidence_pct)}</Td>
                <Td right className="text-down">{num(r.drawdown_floor_price)}</Td>
                <Td right className="text-down">{pct(r.drawdown_return_pct, 1)}</Td>
                <Td right className="text-up">{num(r.upside_target_price)}</Td>
                <Td right className="text-up">{pct(r.upside_return_pct, 1)}</Td>
                <Td className="text-muted-foreground">{str(r.risk_tier)}</Td>
              </tr>
            ))}
          </Table>
        </DataCard>
      ) : null}

      {Object.keys(har).length > 0 ? (
        <DataCard title="HAR-RV volatility decomposition" subtitle="Daily, weekly and monthly realised-volatility components (Corsi 2009)" icon={Waves}>
          <StatGrid cols={4}>
            <Stat label="Daily coefficient" value={num(har.beta_daily, 3)} />
            <Stat label="Weekly coefficient" value={num(har.beta_weekly, 3)} />
            <Stat label="Monthly coefficient" value={num(har.beta_monthly, 3)} />
            <Stat label="R²" value={num(har.r_squared, 3)} />
            <Stat label="5-day forecast vol" value={frac(har.forecast_volatility_5d, 1)} />
            <Stat label="21-day forecast vol" value={frac(har.forecast_volatility_21d, 1)} />
            <Stat label="63-day forecast vol" value={frac(har.forecast_volatility_63d, 1)} />
            <Stat label="Regime" value={str(har.volatility_regime)} />
            <Stat label="Jump intensity" value={har.jump_intensity != null ? `${(har.jump_intensity * 100).toFixed(1)}%` : dash} />
            <Stat label="Leverage asymmetry" value={num(har.leverage_asymmetry_ratio, 2)} />
          </StatGrid>
        </DataCard>
      ) : null}
    </div>
  );
}
