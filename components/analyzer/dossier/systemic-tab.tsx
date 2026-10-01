import { Network, PieChart, Shuffle, Truck } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, num } from "./shared";

function Bars({ rows, fmt, signed = false }: { rows: [string, number][]; fmt: (n: number) => string; signed?: boolean }) {
  const max = Math.max(...rows.map(([, v]) => Math.abs(v)), 1e-9);
  return (
    <ul className="space-y-2 p-4">
      {rows.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground">{k}</span>
          <div className="relative h-2 rounded-full bg-muted">
            {signed ? <span className="absolute inset-y-0 left-1/2 w-px bg-border" /> : null}
            <div
              className={cn("absolute inset-y-0 rounded-full", signed ? (v >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down") : "left-0 bg-accent/80")}
              style={{ width: `${(Math.abs(v) / max) * (signed ? 50 : 100)}%` }}
            />
          </div>
          <span className={cn("text-right font-mono text-xs", signed && deltaColor(v))}>{fmt(v)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SystemicTab({ s }: { s: ListedSummary }) {
  const d = s.detail;
  const pf = d.portfolio as Blk | null;
  const sp = d.spillover as Blk | null;
  const factor = d.factor as Blk | undefined;
  const ex = d.execution as Blk | undefined;
  const hrp: Blk = pf?.hrp ?? {};
  const bl: Blk = pf?.black_litterman ?? {};
  const kelly: Blk = pf?.fractional_kelly ?? {};
  const target = s.ticker;

  const hrpRows = Object.entries((hrp.weights as Record<string, number>) ?? {}).sort((a, b) => b[1] - a[1]) as [string, number][];
  const blNames = Object.keys((bl.posterior_returns as Record<string, number>) ?? {});
  const net = Object.entries((sp?.net_spillover as Record<string, number>) ?? {}).sort((a, b) => b[1] - a[1]) as [string, number][];
  const attribution = Object.entries((factor?.variance_attribution_pct as Record<string, number>) ?? {}) as [string, number][];
  const schedule = (ex?.schedule as Blk[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          title="Hierarchical risk parity"
          subtitle="Risk-balanced weights across the stock, Indian sector indices and world indices"
          icon={PieChart}
          footnote="HRP clusters assets by correlation and splits risk evenly between clusters, so it needs no return forecast."
        >
          {hrpRows.length === 0 ? (
            <Empty>Too little overlapping history to build the allocation.</Empty>
          ) : (
            <>
              <Bars rows={hrpRows} fmt={(n) => `${(n * 100).toFixed(1)}%`} />
              <StatGrid cols={2}>
                <Stat label="Portfolio volatility (ann.)" value={hrp.portfolio_volatility_annualized != null ? `${(hrp.portfolio_volatility_annualized * 100).toFixed(1)}%` : dash} />
                <Stat label="Diversification ratio" value={num(hrp.diversification_ratio)} />
              </StatGrid>
            </>
          )}
        </DataCard>

        <DataCard
          title="Black-Litterman views"
          subtitle="Market-implied returns, tilted toward this model's forecast for the stock"
          icon={Shuffle}
          footnote={`Confidence in the view: ${bl.confidence_lambda != null ? num(bl.confidence_lambda, 2) : "—"}. The active tilt is how far the posterior moved from the prior.`}
        >
          {blNames.length === 0 ? (
            <Empty>No posterior was produced.</Empty>
          ) : (
            <Table min={460} head={["Asset", { label: "Prior", right: true }, { label: "Posterior", right: true }, { label: "Tilt", right: true }, { label: "Weight", right: true }]}>
              {blNames.map((k) => {
                const tilt = bl.active_tilts?.[k];
                return (
                  <tr key={k} className={cn("border-b border-border last:border-0", k === target && "bg-accent/5")}>
                    <Td>{k}</Td>
                    <Td right>{num((bl.prior_returns?.[k] ?? 0) * 100, 1)}%</Td>
                    <Td right>{num((bl.posterior_returns?.[k] ?? 0) * 100, 1)}%</Td>
                    <Td right className={typeof tilt === "number" ? deltaColor(tilt) : ""}>{typeof tilt === "number" ? `${(tilt * 100).toFixed(1)}%` : dash}</Td>
                    <Td right>{typeof bl.optimal_weights?.[k] === "number" ? `${(bl.optimal_weights[k] * 100).toFixed(1)}%` : dash}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
          {kelly.raw_full_kelly != null ? (
            <StatGrid cols={3}>
              <Stat label="Full Kelly" value={num(kelly.raw_full_kelly, 2)} hint="Fraction of capital" />
              <Stat label="Fractional Kelly" value={num(kelly.fractional_kelly_recommended, 2)} />
              <Stat label="Leverage cap" value={num(kelly.recommended_leverage_cap, 2)} />
            </StatGrid>
          ) : null}
        </DataCard>
      </div>

      <DataCard
        title="Volatility spillover (Diebold–Yilmaz)"
        subtitle="How much of each market's volatility comes from, and goes to, the others"
        icon={Network}
        badge={sp?.target_company_role ? <Pill label={String(sp.target_company_role)} tone="flat" /> : undefined}
        footnote="Net spillover above zero means the market transmits shocks to the others; below zero means it mostly receives them."
      >
        {!sp ? (
          <Empty>Spillover needs at least two return series with overlapping history.</Empty>
        ) : (
          <>
            <StatGrid cols={3}>
              <Stat label="Total connectedness" value={sp.total_connectedness_index != null ? `${num(sp.total_connectedness_index, 1)}%` : dash} hint="Share of forecast variance explained by other markets" />
              <Stat label="This stock: to others" value={sp.directional_to?.[target ?? ""] != null ? `${num(sp.directional_to[target ?? ""], 1)}%` : dash} />
              <Stat label="This stock: from others" value={sp.directional_from?.[target ?? ""] != null ? `${num(sp.directional_from[target ?? ""], 1)}%` : dash} />
            </StatGrid>
            <Bars rows={net} fmt={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`} signed />
          </>
        )}
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          title="Multi-factor risk attribution"
          subtitle="Fama-French and Carhart: market, size, value and momentum"
          icon={PieChart}
          badge={factor?.factor_profile_tier ? <Pill label={String(factor.factor_profile_tier)} tone="flat" /> : undefined}
          footnote="Factor proxies are built from Indian index returns, so the betas are a rough style read, not a formal factor model."
        >
          {!factor ? (
            <Empty>Not enough history to fit the factor model.</Empty>
          ) : (
            <>
              <div className="p-4">
                <p className="mb-2 text-2xs uppercase tracking-wider text-muted-foreground">Where the variance comes from</p>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {attribution.map(([k, v], i) => (
                    <div key={k} title={`${k}: ${v.toFixed(1)}%`} style={{ width: `${Math.max(v, 0)}%`, background: `hsl(var(--accent) / ${(1 - i * 0.17).toFixed(2)})` }} />
                  ))}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
                  {attribution.map(([k, v], i) => (
                    <li key={k}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: `hsl(var(--accent) / ${(1 - i * 0.17).toFixed(2)})` }} />
                      {k} {v.toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </div>
              <StatGrid cols={3}>
                <Stat label="Market β" value={num(factor.market_beta)} />
                <Stat label="Size β" value={num(factor.size_smb_beta)} />
                <Stat label="Value β" value={num(factor.value_hml_beta)} />
                <Stat label="Momentum β" value={num(factor.momentum_wml_beta)} />
                <Stat label="Alpha (ann.)" value={factor.alpha_annualized_pct != null ? `${num(factor.alpha_annualized_pct, 1)}%` : dash} hint={`p = ${num(factor.alpha_p_value, 2)}`} />
                <Stat label="R²" value={num(factor.r_squared)} />
              </StatGrid>
            </>
          )}
        </DataCard>

        <DataCard
          title="Execution impact (Almgren–Chriss)"
          subtitle="Cost of working a ₹1 Cr order through the market"
          icon={Truck}
          badge={ex?.execution_urgency_tier ? <Pill label={String(ex.execution_urgency_tier).split("(")[0].trim()} tone="up" hint={String(ex.execution_urgency_tier)} /> : undefined}
          footnote="Uses the stock's median daily volume and an assumed 2% daily volatility."
        >
          {!ex ? (
            <Empty>No execution estimate was produced.</Empty>
          ) : (
            <>
              <StatGrid cols={3}>
                <Stat label="Expected impact" value={ex.total_expected_impact_bps != null ? `${num(ex.total_expected_impact_bps, 2)} bps` : dash} />
                <Stat label="Cost" value={ex.total_expected_impact_cost_inr != null ? `₹${formatINR(ex.total_expected_impact_cost_inr, 0)}` : dash} />
                <Stat label="Horizon" value={ex.liquidation_horizon_days != null ? `${ex.liquidation_horizon_days} days` : dash} />
                <Stat label="Order size" value={ex.shares_total != null ? `${formatINR(ex.shares_total, 0)} sh` : dash} />
                <Stat label="Max size at 25 bps" value={ex.max_position_size_for_25bps_inr != null ? `₹${formatINR(ex.max_position_size_for_25bps_inr / 1e7, 1)} Cr` : dash} />
              </StatGrid>
              {schedule.length > 0 ? (
                <Table min={420} head={["Day", { label: "Shares", right: true }, { label: "% of ADV", right: true }, { label: "Slippage bps", right: true }]}>
                  {schedule.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <Td>{String(r.Day)}</Td>
                      <Td right>{formatINR(Number(r["Shares to Trade"]), 0)}</Td>
                      <Td right>{num(r["Trade % of ADV"])}%</Td>
                      <Td right>{num(r["Expected Slippage (bps)"])}</Td>
                    </tr>
                  ))}
                </Table>
              ) : null}
            </>
          )}
        </DataCard>
      </div>
    </div>
  );
}
