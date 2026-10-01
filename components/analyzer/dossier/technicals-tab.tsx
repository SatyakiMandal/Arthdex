import { Activity, FlaskConical, Layers, Map } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor } from "@/lib/utils";
import type { Blk, ListedSummary } from "@/types/analyzer";
import { Empty, Pill, Stat, StatGrid, Table, Td, dash, inr, num, stanceTone, str } from "./shared";

const signalTone = (t: unknown) => stanceTone(typeof t === "string" ? t : "");

export function TechnicalsTab({ s }: { s: ListedSummary }) {
  const t = s.detail.technical;
  const ma: Blk = t.moving_averages ?? {};
  const adx: Blk = t.adx ?? {};
  const macd: Blk = t.macd ?? {};
  const rsi: Blk = t.rsi ?? {};
  const bb: Blk = t.bollinger ?? {};
  const st: Blk = t.stochastic ?? {};
  const pv: Blk = t.pivots ?? {};
  const bt: Blk = t.backtest ?? {};
  const rsiV = rsi.rsi_14 as number | undefined;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <DataCard
        title="Summary rating"
        subtitle="Composite of trend, momentum and volatility indicators (−100 to +100)"
        icon={Activity}
        badge={s.technical.rating ? <Pill label={s.technical.rating} tone={stanceTone(s.technical.rating)} /> : undefined}
        footnote={s.technical.verdict ?? undefined}
      >
        <StatGrid>
          <Stat label="Composite score" value={num(s.technical.score, 0)} tone={s.technical.score != null ? deltaColor(s.technical.score) : undefined} />
          <Stat label="Trend" value={str(ma.ma_trend_bias)} />
          <Stat label="MA cross" value={str(ma.golden_cross_status)} />
        </StatGrid>
      </DataCard>

      <div className="contents">
        <DataCard title="Moving averages" subtitle="Price position against each average" icon={Layers} className="xl:col-span-2">
          {t.indicators_table && t.indicators_table.length > 0 ? (
            <Table min={360} head={["Indicator", { label: "Value", right: true }, { label: "Distance", right: true }, "Signal"]}>
              {t.indicators_table.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <Td>{str(r.Indicator)}</Td>
                  <Td right>{str(r.Value)}</Td>
                  <Td right>{str(r["Distance (%)"])}</Td>
                  <Td>{r.Signal ? <Pill label={String(r.Signal)} tone={signalTone(r.Signal)} /> : dash}</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <StatGrid>
              <Stat label="SMA 20" value={num(ma.sma_20)} />
              <Stat label="SMA 50" value={num(ma.sma_50)} />
              <Stat label="SMA 200" value={num(ma.sma_200)} />
              <Stat label="EMA 12" value={num(ma.ema_12)} />
              <Stat label="EMA 26" value={num(ma.ema_26)} />
            </StatGrid>
          )}
        </DataCard>

        <DataCard title="Oscillators & momentum" icon={Activity}>
          <StatGrid cols={2}>
            <Stat label="ADX (14)" value={num(adx.adx_14, 1)} hint={str(adx.trend_strength)} />
            <Stat label="+DI / −DI" value={`${num(adx.plus_di_14, 1)} / ${num(adx.minus_di_14, 1)}`} hint={str(adx.directional_bias)} />
            <Stat
              label="MACD (12,26,9)"
              value={`${num(macd.macd_line)} / ${num(macd.signal_line)}`}
              hint={`Histogram ${num(macd.histogram)} · ${str(macd.crossover_signal)}`}
            />
            <Stat
              label="RSI (14)"
              value={num(rsiV, 1)}
              tone={rsiV != null ? (rsiV > 70 ? "text-down" : rsiV < 30 ? "text-up" : undefined) : undefined}
              hint={rsiV != null ? (rsiV > 70 ? "Overbought" : rsiV < 30 ? "Oversold" : "Neutral") + ` · ${str(rsi.condition)}` : undefined}
            />
            <Stat
              label="Bollinger (20, 2σ)"
              value={`${num(bb.lower_band)} – ${num(bb.upper_band)}`}
              hint={`Bandwidth ${num(bb.bandwidth_pct, 2)}% · %B ${num(bb.percent_b, 2)}`}
            />
            <Stat label="Stochastic %K / %D" value={`${num(st.slow_k, 1)} / ${num(st.slow_d, 1)}`} hint={`${str(st.condition)} · ${str(st.crossover)}`} />
          </StatGrid>
          {bb.squeeze_status ? <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">{String(bb.squeeze_status)}</p> : null}
        </DataCard>
      </div>

      <DataCard title="Pivot levels" subtitle="Classic and Fibonacci, from the last five sessions" icon={Map}>
        {Object.keys(pv).length === 0 ? (
          <Empty>No pivot levels were produced.</Empty>
        ) : (
          <Table min={560} head={["Method", { label: "S3", right: true }, { label: "S2", right: true }, { label: "S1", right: true }, { label: "Pivot", right: true }, { label: "R1", right: true }, { label: "R2", right: true }, { label: "R3", right: true }]}>
            <tr className="border-b border-border">
              <Td>Classic</Td>
              {["s3", "s2", "s1", "pivot", "r1", "r2", "r3"].map((k) => (
                <Td key={k} right className={cn(k.startsWith("s") && "text-down", k.startsWith("r") && "text-up")}>{num(pv[k])}</Td>
              ))}
            </tr>
            <tr>
              <Td>Fibonacci</Td>
              <Td right>{dash}</Td>
              <Td right className="text-down">{num(pv.fib_s2)}</Td>
              <Td right className="text-down">{num(pv.fib_s1)}</Td>
              <Td right>{num(pv.pivot)}</Td>
              <Td right className="text-up">{num(pv.fib_r1)}</Td>
              <Td right className="text-up">{num(pv.fib_r2)}</Td>
              <Td right>{dash}</Td>
            </tr>
          </Table>
        )}
      </DataCard>

      {t.weekly_playbook && t.weekly_playbook.length > 0 ? (
        <DataCard title="Weekly playbook" subtitle="What each signal implies for the coming week" icon={Map} className="xl:col-span-3">
          <Table min={560} head={["Pillar", "Condition", "Action"]}>
            {t.weekly_playbook.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <Td>{str(r.Pillar)}</Td>
                <Td className="text-muted-foreground">{str(r.Condition)}</Td>
                <Td className="text-muted-foreground">{str(r.Action)}</Td>
              </tr>
            ))}
          </Table>
        </DataCard>
      ) : null}

      <DataCard
        className="xl:col-start-3 xl:row-start-2"
        title="Walk-forward backtest"
        subtitle="The technical rules replayed over this window"
        icon={FlaskConical}
        footnote="A single short window. A strategy that beats buy-and-hold here can still lose money out of sample."
      >
        <StatGrid cols={4}>
          <Stat label="Strategy return" value={bt.strategy_return_pct != null ? `${num(bt.strategy_return_pct)}%` : dash} tone={deltaColor(Number(bt.strategy_return_pct ?? 0))} />
          <Stat label="Buy & hold" value={bt.buy_and_hold_return_pct != null ? `${num(bt.buy_and_hold_return_pct)}%` : dash} tone={deltaColor(Number(bt.buy_and_hold_return_pct ?? 0))} />
          <Stat label="Alpha" value={bt.alpha_pct != null ? `${num(bt.alpha_pct)}%` : dash} />
          <Stat label="Sharpe" value={num(bt.strategy_sharpe_ratio)} hint={`B&H ${num(bt.buy_and_hold_sharpe)}`} />
          <Stat label="Max drawdown" value={bt.max_drawdown_pct != null ? `${num(bt.max_drawdown_pct)}%` : dash} tone="text-down" />
          <Stat label="Win rate" value={bt.win_rate_pct != null ? `${num(bt.win_rate_pct, 1)}%` : dash} />
          <Stat label="Profit factor" value={num(bt.profit_factor)} />
          <Stat label="Trades" value={bt.total_trades ?? dash} />
        </StatGrid>
        <p className="px-4 pb-3 text-2xs text-muted-foreground">Price reference {inr(s.verdict?.price)}.</p>
      </DataCard>
    </div>
  );
}
