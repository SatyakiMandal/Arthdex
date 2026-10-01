import { Factory, Globe2, Landmark, Pickaxe } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Stat, StatGrid, Table, Td, dash, fracSigned, num, pct, str } from "./shared";

export function MacroTab({ s }: { s: ListedSummary }) {
  const m = s.detail.macro;
  const b = (m.backdrop ?? {}) as Blk;
  const repo: Blk = b.repo_rate ?? {};
  const fed: Blk = b.fed_funds_rate ?? {};
  const cpi: Blk = b.cpi_inflation ?? {};
  const iip: Blk = b.iip_growth ?? {};
  const pmi: Blk = b.pmi ?? {};
  const crude: Blk = b.crude_oil ?? {};
  const core: Blk = b.eight_core_industries ?? {};
  const yields: Blk = b.sovereign_yields ?? {};
  const fx: Blk = b.usdinr ?? {};
  const sectors = (core.sectors as Blk[] | undefined) ?? [];
  const nifty = Object.entries(m.nifty);
  const glob = Object.entries(m.global);

  return (
    <div className="space-y-4">
      <DataCard title="Macroeconomic backdrop" subtitle="Policy rates, inflation, activity and the oil price over the window" icon={Landmark}>
        {Object.keys(b).length === 0 ? (
          <Empty>No macro backdrop was collected for this run.</Empty>
        ) : (
          <StatGrid cols={4}>
            <Stat label="RBI repo rate" value={repo.current_rate_pct != null ? `${num(repo.current_rate_pct)}%` : dash} hint={str(repo.mpc_stance)} />
            <Stat label="US Fed funds" value={fed.effective_rate_pct != null ? `${num(fed.effective_rate_pct)}%` : dash} hint={str(fed.fomc_stance)} />
            <Stat
              label="Repo − Fed differential"
              value={fed.us_india_rate_differential_bps != null ? `${-Number(fed.us_india_rate_differential_bps)} bps` : dash}
              hint="India minus US"
            />
            <Stat label="Brent crude" value={crude.end_price != null ? `$${num(crude.end_price)}` : dash} tone={crude.change != null ? deltaColor(crude.change) : undefined} hint={crude.change != null ? `${fracSigned(crude.change, 1)} over window` : undefined} />
            <Stat label="CPI inflation" value={cpi.value != null ? `${num(cpi.value)}%` : dash} hint={`${str(cpi.status)}${cpi.target_band ? ` · target ${cpi.target_band}` : ""}`} />
            <Stat label="IIP growth" value={iip.value != null ? `${num(iip.value, 1)}%` : dash} hint={str(iip.month)} />
            <Stat label="Manufacturing PMI" value={num(pmi.manufacturing, 1)} hint={str(pmi.regime)} />
            <Stat label="USD / INR" value={fx.end_rate != null ? num(fx.end_rate) : dash} hint={fx.change != null ? `${fracSigned(fx.change, 1)} over window` : undefined} />
            <Stat label="India 10Y" value={yields.india_10y_pct != null ? `${num(yields.india_10y_pct)}%` : dash} />
            <Stat label="US 10Y" value={yields.us_10y_pct != null ? `${num(yields.us_10y_pct)}%` : dash} />
            <Stat label="10Y spread" value={yields.spread_bps != null ? `${yields.spread_bps} bps` : dash} />
            <Stat label="8 core industries YoY" value={core.combined_growth_yoy_pct != null ? pct(core.combined_growth_yoy_pct, 1) : dash} tone={core.combined_growth_yoy_pct != null ? deltaColor(core.combined_growth_yoy_pct) : undefined} />
          </StatGrid>
        )}
        {sectors.length > 0 ? (
          <Table min={520} head={["Core industry", { label: "Weight", right: true }, { label: "YoY", right: true }, "Status"]}>
            {sectors.map((c, i) => (
              <tr key={i} className="border-t border-border">
                <Td>{str(c.sector)}</Td>
                <Td right>{num(c.weight_pct, 1)}%</Td>
                <Td right className={deltaColor(Number(c.yoy_growth_pct) || 0)}>{pct(c.yoy_growth_pct, 1)}</Td>
                <Td className="text-muted-foreground">{str(c.status)}</Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </DataCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Nifty 50 & sectoral benchmarks" subtitle="Sensitivity of the stock to each index over the window" icon={Factory}>
          {nifty.length === 0 ? (
            <Empty>No benchmark regressions were run.</Empty>
          ) : (
            <Table min={420} head={["Index", { label: "β", right: true }, { label: "R²", right: true }, { label: "Window return", right: true }]}>
              {nifty.map(([name, n]) => (
                <tr key={name} className="border-b border-border last:border-0">
                  <Td>{name}</Td>
                  <Td right>{num(n.beta)}</Td>
                  <Td right>{num(n.r_squared)}</Td>
                  <Td right className={n.window_return != null ? deltaColor(n.window_return) : ""}>{fracSigned(n.window_return, 1)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </DataCard>

        <DataCard
          title="Global markets"
          subtitle="Cross-border sentiment over the window"
          icon={Globe2}
          footnote="US and European closes arrive after Indian hours, so they are aligned to the next Indian session."
        >
          {glob.length === 0 ? (
            <Empty>No global index data was collected.</Empty>
          ) : (
            <Table min={320} head={["Index", "Ticker", { label: "Window return", right: true }]}>
              {glob.map(([name, g]) => (
                <tr key={name} className="border-b border-border last:border-0">
                  <Td>{name}</Td>
                  <Td mono className="text-muted-foreground">{g.ticker}</Td>
                  <Td right className={cn(g.window_return != null && deltaColor(g.window_return))}>{fracSigned(g.window_return, 1)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </DataCard>
      </div>

      <DataCard title="Industrial & precious metals" subtitle="Zinc, copper, gold, silver and aluminium" icon={Pickaxe} footnote={m.metals_summary ?? undefined}>
        {m.metals.length === 0 ? (
          <Empty>No metals data was collected.</Empty>
        ) : (
          <Table min={640} head={["Metal", { label: "Price", right: true }, { label: "Window", right: true }, { label: "1-week", right: true }, { label: "Vol (ann.)", right: true }, "Transmission"]}>
            {m.metals.map((x) => (
              <tr key={x.symbol} className="border-b border-border last:border-0">
                <Td>{x.name}</Td>
                <Td right>{num(x.current_price)} <span className="text-2xs text-muted-foreground">{x.unit}</span></Td>
                <Td right className={deltaColor(x.change_pct ?? 0)}>{pct(x.change_pct, 1)}</Td>
                <Td right className={deltaColor(x.momentum_1w_pct ?? 0)}>{pct(x.momentum_1w_pct, 1)}</Td>
                <Td right>{x.annualized_volatility_pct != null ? `${x.annualized_volatility_pct}%` : dash}</Td>
                <Td className="text-2xs text-muted-foreground">{x.transmission_channel ?? dash}</Td>
              </tr>
            ))}
          </Table>
        )}
      </DataCard>
    </div>
  );
}
