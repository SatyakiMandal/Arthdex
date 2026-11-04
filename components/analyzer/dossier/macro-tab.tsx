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
              value={fed.us_india_rate_differential_bps != null ? `${Number(fed.us_india_rate_differential_bps)} bps` : dash}
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
        <DataCard title="Nifty 50 vs broad and sector indices" subtitle="Beta, correlation and return relative to benchmark" icon={Globe2}>
          {nifty.length === 0 ? (
            <Empty>No Nifty benchmark moves were logged.</Empty>
          ) : (
            <Table min={440} head={["Index", { label: "Change", right: true }, { label: "Beta", right: true }, { label: "Corr", right: true }]}>
              {nifty.map(([k, v]) => {
                const row = v as Blk;
                return (
                  <tr key={k} className="border-t border-border">
                    <Td>{str(row.label ?? k)}</Td>
                    <Td right className={row.return_pct != null ? deltaColor(Number(row.return_pct)) : undefined}>{pct(row.return_pct, 1)}</Td>
                    <Td right>{num(row.beta, 2)}</Td>
                    <Td right>{num(row.correlation, 2)}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </DataCard>

        <DataCard title="Global markets" subtitle="S&P 500, Nasdaq, crude, gold and the dollar index" icon={Factory}>
          {glob.length === 0 ? (
            <Empty>No global indices were logged.</Empty>
          ) : (
            <Table min={440} head={["Market", { label: "Change", right: true }, { label: "Beta", right: true }, { label: "Corr", right: true }]}>
              {glob.map(([k, v]) => {
                const row = v as Blk;
                return (
                  <tr key={k} className="border-t border-border">
                    <Td>{str(row.label ?? k)}</Td>
                    <Td right className={row.return_pct != null ? deltaColor(Number(row.return_pct)) : undefined}>{pct(row.return_pct, 1)}</Td>
                    <Td right>{num(row.beta, 2)}</Td>
                    <Td right>{num(row.correlation, 2)}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </DataCard>
      </div>

      {Array.isArray(m.notable_moves) && m.notable_moves.length > 0 ? (
        <DataCard title="Notable macro days" subtitle="Outsized sessions for oil, the rupee or global markets during the window" icon={Pickaxe}>
          <ul className="space-y-2 p-4 text-sm">
            {(m.notable_moves as Blk[]).map((d, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="font-mono text-xs text-muted-foreground">{str(d.date)}</span>
                <span>{str(d.note ?? d.headline)}</span>
              </li>
            ))}
          </ul>
        </DataCard>
      ) : null}
    </div>
  );
}
