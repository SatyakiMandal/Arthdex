import { Brain, Gauge, ShieldAlert, Shuffle, Skull, TrendingDown } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, frac, num } from "./shared";

export function RiskTab({ s }: { s: ListedSummary }) {
  const q = s.detail.quant;
  const dd = (q.distance_to_default ?? {}) as Blk;
  const v = (q.var ?? {}) as Blk;
  const ms = (q.microstructure ?? {}) as Blk;
  const rg = (q.regime ?? {}) as Blk;
  const xai = (q.xai ?? {}) as Blk;
  const table = ((v.table as Blk[] | undefined) ?? []).filter((r) => r.horizon_days === 1);
  const contributions = (xai.contributions as Blk[] | undefined) ?? [];
  const maxAbs = Math.max(0.0001, ...contributions.map((c) => Math.abs(Number(c.shapley_value) || 0)));
  const six = ((s.detail.var_six_sigma ?? null) as Blk | null);
  const sigmaGrid = ((six?.sigma_grid as Blk[]) ?? []);
  const durations = (rg.expected_durations_days ?? {}) as Record<string, number>;
  const tm = (rg.transition_matrix as number[][] | undefined) ?? [];
  const names = Object.keys(durations);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="contents">
        <DataCard
          title="Merton distance to default"
          subtitle="How many standard deviations of asset value sit between the firm and its debt"
          icon={ShieldAlert}
        >
          {dd.available ? (
            <StatGrid cols={2}>
              <Stat label="Distance to default" value={`${num(dd.distance_to_default, 2)}σ`} />
              <Stat label="Default probability" value={dd.default_probability_pct != null ? `${num(dd.default_probability_pct, 2)}%` : dash} />
              <Stat label="Asset volatility" value={frac(dd.asset_volatility, 1)} />
              <Stat label="Equity volatility" value={frac(dd.equity_volatility, 1)} />
            </StatGrid>
          ) : (
            <Empty>{str2(dd.note) ?? "Not available: debt or market capitalisation could not be sourced for this run."}</Empty>
          )}
        </DataCard>

        <DataCard title="Value at risk" subtitle="One-day loss not expected to be exceeded" icon={TrendingDown}>
          {table.length === 0 ? (
            <Empty>No VaR table was produced.</Empty>
          ) : (
            <Table min={360} head={["Method", { label: "Conf.", right: true }, { label: "VaR", right: true }, { label: "CVaR", right: true }]}>
              {table.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <Td>{str2(r.method)}</Td>
                  <Td right>{r.confidence_pct}%</Td>
                  <Td right>{frac(r.var_pct)}</Td>
                  <Td right>{frac(r.cvar_pct)}</Td>
                </tr>
              ))}
            </Table>
          )}
          <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">
            CVaR (expected shortfall) is the average loss on the days VaR is breached, so it is always at or above VaR.
          </p>
        </DataCard>
      </div>


      {six ? (
        <DataCard
          className="xl:col-span-2"
          title="Extreme tail risk (6σ) and capital buffer"
          subtitle="One-day and ten-day losses at six standard deviations, and the capital to hold against them"
          icon={Skull}
          footnote="Six-sigma is a stress scenario far beyond normal trading; fat-tailed returns make such days less rare than a normal curve implies."
        >
          <StatGrid cols={4}>
            <Stat label="1-day VaR (6σ)" value={frac(six.var_1d_6sigma_pct)} tone="text-down" />
            <Stat label="1-day CVaR (6σ)" value={frac(six.cvar_1d_6sigma_pct)} tone="text-down" />
            <Stat label="10-day VaR (6σ)" value={frac(six.var_10d_6sigma_pct)} tone="text-down" />
            <Stat label="10-day CVaR (6σ)" value={frac(six.cvar_10d_6sigma_pct)} tone="text-down" />
            <Stat label="Required buffer" value={six.required_capital_buffer_cr != null ? `₹${num(six.required_capital_buffer_cr, 1)} Cr` : dash} />
          </StatGrid>
          {sigmaGrid.length > 0 ? (
            <Table min={760} head={Object.keys(sigmaGrid[0]).map((k, i) => ({ label: k, right: i > 0 && i < 6 }))}>
              {sigmaGrid.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {Object.keys(sigmaGrid[0]).map((k, j) => (
                    <Td key={k} right={j > 0 && j < 6} mono={j > 0 && j < 6}>{String(r[k] ?? "")}</Td>
                  ))}
                </tr>
              ))}
            </Table>
          ) : null}
        </DataCard>
      ) : null}

      <DataCard
        title="Market microstructure"
        subtitle="Price impact and order-flow toxicity"
        icon={Gauge}
        badge={ms.vpin_regime ? <Pill label={String(ms.vpin_regime)} tone={Number(ms.vpin_score) >= 0.5 ? "down" : Number(ms.vpin_score) >= 0.3 ? "flat" : "up"} /> : undefined}
        footnote="VPIN estimates the probability that resting liquidity is being picked off by better-informed traders. Kyle's lambda is price impact per ₹10M of market order."
      >
        {Object.keys(ms).length === 0 ? (
          <Empty>No microstructure estimates were produced.</Empty>
        ) : (
          <StatGrid cols={4}>
            <Stat label="Kyle's λ (bps / ₹10M)" value={num(ms.kyle_lambda_bps_per_10m)} />
            <Stat label="VPIN" value={num(ms.vpin_score, 3)} />
            <Stat label="Order-flow imbalance" value={ms.order_flow_imbalance_pct != null ? `${num(ms.order_flow_imbalance_pct, 1)}%` : dash} />
            <Stat label="Jump intensity" value={ms.realized_jump_intensity_pct != null ? `${num(ms.realized_jump_intensity_pct, 1)}%` : dash} />
            <div className="col-span-2 sm:col-span-4">
              <Stat label="Liquidity grade" value={<span className="font-sans">{str2(ms.institutional_liquidity_grade) ?? dash}</span>} />
            </div>
          </StatGrid>
        )}
      </DataCard>

      <DataCard
        title="Volatility regime"
        subtitle="Hidden-Markov regimes from the return series"
        icon={Shuffle}
        badge={rg.current_regime ? <Pill label={String(rg.current_regime)} tone="flat" /> : undefined}
        footnote={str2(rg.risk_regime_guidance) ?? undefined}
      >
        {names.length === 0 ? (
          <Empty>No regime model was fitted.</Empty>
        ) : (
          <>
            <StatGrid cols={4}>
              <Stat label="Current regime probability" value={rg.current_regime_probability != null ? `${(Number(rg.current_regime_probability) * 100).toFixed(1)}%` : dash} />
              <Stat label="Stability score" value={num(rg.regime_stability_score, 1)} />
              {names.map((n) => (
                <Stat key={n} label={`${n} · expected duration`} value={`${num(durations[n], 1)} days`} />
              ))}
            </StatGrid>
            {tm.length > 0 ? (
              <Table min={360} head={["From \\ to", ...names.map((n) => ({ label: n, right: true }))]}>
                {tm.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <Td>{names[i] ?? i}</Td>
                    {row.map((p, j) => (
                      <Td key={j} right className={cn(i === j && "text-accent")}>{(p * 100).toFixed(0)}%</Td>
                    ))}
                  </tr>
                ))}
              </Table>
            ) : null}
          </>
        )}
      </DataCard>

      <DataCard
        className="xl:col-span-2"
        title="Explainable AI · Shapley attribution"
        subtitle="Each factor's contribution to the forecast return"
        icon={Brain}
        footnote={xai.fidelity_check_passed === false ? "Attribution failed its additivity check; treat these as indicative only." : "Contributions sum to the gap between the base and forecast return."}
      >
        {contributions.length === 0 ? (
          <Empty>No attribution was produced.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {contributions.map((c, i) => {
              const sv = Number(c.shapley_value) || 0;
              return (
                <li key={i} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>{str2(c.feature_name)}</span>
                    <span className={cn("font-mono", deltaColor(sv))}>
                      {sv > 0 ? "+" : ""}
                      {(sv * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className={cn("h-full", sv >= 0 ? "bg-up" : "bg-down")} style={{ width: `${(Math.abs(sv) / maxAbs) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-2xs text-muted-foreground">{str2(c.rationale)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>
    </div>
  );
}

const str2 = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
