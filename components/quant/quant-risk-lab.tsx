"use client";

import { useState } from "react";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ApiBacktestPeriod, ApiBacktestResult, ApiCrisisScenario, ApiFactorExposure, ApiStressTestResult } from "@/lib/api/types";

interface QuantRiskLabProps {
  scenarios: ApiCrisisScenario[];
  scenariosError?: string | null;
}

type Tab = "STRESS" | "REGRESSION" | "BACKTEST";
interface HoldingInput {
  id: number;
  symbol: string;
  value: string;
}

const DASH = "—";
const MAX_HOLDINGS = 15;
const num = (v: number | null | undefined, digits = 2) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
const signedPct = (v: number | null | undefined, digits = 2) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${num(v, digits)}%` : DASH);
const rupees = (v: number | null | undefined) => (typeof v === "number" ? `${v < 0 ? "−" : ""}₹${num(Math.abs(v), 0)}` : DASH);
const tone = (v: number | null | undefined) => (typeof v !== "number" || v === 0 ? "text-foreground" : v > 0 ? "text-up" : "text-down");
const METHOD_LABEL = { recorded: "Recorded prices", estimate: "Estimate (beta × index)", unavailable: "No history" } as const;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : `The request failed (${res.status}).`);
  return data as T;
}
const post = <T,>(url: string, body: unknown) =>
  call<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const inputClass = "border border-border bg-surface-muted px-2 py-1 text-2xs text-foreground focus:border-accent focus:outline-none";
const buttonClass = "bg-accent px-3 py-1.5 text-3xs font-bold uppercase tracking-wider text-accent-foreground hover:brightness-110 disabled:opacity-50";

function ErrorNote({ message }: { message: string | null }) {
  return message ? <p className="border border-down/40 bg-down/5 p-2 text-2xs text-down" role="alert">{message}</p> : null;
}

function Caveats({ items, provenance }: { items: string[]; provenance: string }) {
  return (
    <div className="space-y-1 text-3xs text-muted-foreground">
      <p className="font-bold uppercase text-accent">{provenance}</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {items.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function QuantRiskLab({ scenarios, scenariosError = null }: QuantRiskLabProps) {
  const [tab, setTab] = useState<Tab>("STRESS");

  // -- stress test
  const [holdings, setHoldings] = useState<HoldingInput[]>([{ id: 1, symbol: "", value: "" }]);
  const [nextId, setNextId] = useState(2);
  const [mode, setMode] = useState<"scenario" | "move">(scenarios.length ? "scenario" : "move");
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.scenario_id ?? "");
  const [move, setMove] = useState("-10");
  const [stress, setStress] = useState<ApiStressTestResult | null>(null);
  const [stressError, setStressError] = useState<string | null>(null);
  const [stressBusy, setStressBusy] = useState(false);

  // -- regression
  const [regSymbol, setRegSymbol] = useState("");
  const [regression, setRegression] = useState<ApiFactorExposure | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);

  // -- backtest
  const [bt, setBt] = useState({ symbol: "NIFTY50", fast: "20", slow: "50", years: "5", capital: "1000000" });
  const [backtest, setBacktest] = useState<ApiBacktestResult | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [btBusy, setBtBusy] = useState(false);

  const updateHolding = (id: number, patch: Partial<HoldingInput>) =>
    setHoldings((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const runStress = async (e: React.FormEvent) => {
    e.preventDefault();
    const portfolio = holdings
      .map((h) => ({ symbol: h.symbol.trim().toUpperCase(), value_inr: Number(h.value) }))
      .filter((h) => h.symbol || h.value_inr);
    if (!portfolio.length || portfolio.some((h) => !/^[A-Z0-9&_-]{1,20}$/.test(h.symbol) || !(h.value_inr > 0))) {
      setStressError("Enter a ticker and a rupee value above zero for each holding.");
      return;
    }
    setStressBusy(true);
    setStressError(null);
    try {
      setStress(await post<ApiStressTestResult>("/api/risk-lab/stress-test", mode === "scenario" ? { portfolio, scenario_id: scenarioId } : { portfolio, index_move_pct: Number(move) }));
    } catch (err) {
      setStress(null);
      setStressError(err instanceof Error ? err.message : "The stress test did not complete.");
    } finally {
      setStressBusy(false);
    }
  };

  const runRegression = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = regSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9&_-]{1,20}$/.test(symbol)) return setRegError("Enter a ticker.");
    setRegBusy(true);
    setRegError(null);
    try {
      setRegression(await call<ApiFactorExposure>(`/api/risk-lab/factor-exposures?symbol=${encodeURIComponent(symbol)}`));
    } catch (err) {
      setRegression(null);
      setRegError(err instanceof Error ? err.message : "The regression did not complete.");
    } finally {
      setRegBusy(false);
    }
  };

  const runBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtBusy(true);
    setBtError(null);
    try {
      setBacktest(
        await post<ApiBacktestResult>("/api/risk-lab/backtest", {
          symbol: bt.symbol.trim().toUpperCase(),
          fast_period: Number(bt.fast),
          slow_period: Number(bt.slow),
          years: Number(bt.years),
          initial_capital: Number(bt.capital),
        }),
      );
    } catch (err) {
      setBacktest(null);
      setBtError(err instanceof Error ? err.message : "The backtest did not complete.");
    } finally {
      setBtBusy(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "STRESS", label: "Stress test" },
    { id: "REGRESSION", label: "Benchmark regression" },
    { id: "BACKTEST", label: "Backtest" },
  ];
  const selected = scenarios.find((s) => s.scenario_id === scenarioId);

  return (
    <div className="w-full space-y-4 font-mono text-xs">
      <div className="flex flex-wrap items-center gap-2 border border-border/80 bg-surface-muted/40 p-2.5 text-2xs">
        <ShieldAlert className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="font-bold uppercase tracking-wider text-foreground">
          Calculations on recorded prices, for study. Not a forecast and not investment advice.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border" role="tablist" aria-label="Risk lab tools">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("border-b-2 px-3 py-1.5 text-3xs font-bold uppercase tracking-wider", tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "STRESS" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <form onSubmit={runStress} className="space-y-3 border border-border bg-surface p-3">
            <h2 className="border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">Your holdings</h2>
            {holdings.map((h, i) => (
              <div key={h.id} className="flex items-center gap-1.5">
                <input aria-label={`Holding ${i + 1} ticker`} value={h.symbol} onChange={(e) => updateHolding(h.id, { symbol: e.target.value.toUpperCase() })} placeholder="TICKER" maxLength={20} className={cn(inputClass, "w-28 uppercase")} />
                <input aria-label={`Holding ${i + 1} value in rupees`} value={h.value} onChange={(e) => updateHolding(h.id, { value: e.target.value })} placeholder="Value ₹" inputMode="decimal" className={cn(inputClass, "min-w-0 flex-1")} />
                <button type="button" aria-label={`Remove holding ${i + 1}`} disabled={holdings.length === 1} onClick={() => setHoldings((rows) => rows.filter((r) => r.id !== h.id))} className="p-1 text-muted-foreground hover:text-down disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" disabled={holdings.length >= MAX_HOLDINGS} onClick={() => { setHoldings((rows) => [...rows, { id: nextId, symbol: "", value: "" }]); setNextId((n) => n + 1); }} className="flex items-center gap-1 text-3xs font-bold uppercase text-accent disabled:opacity-40">
              <Plus className="h-3 w-3" aria-hidden /> Add holding
            </button>

            <fieldset className="space-y-2 border-t border-border/60 pt-2">
              <legend className="text-3xs font-bold uppercase text-muted-foreground">Test against</legend>
              <label className="flex items-center gap-2 text-2xs">
                <input type="radio" name="stress-mode" checked={mode === "scenario"} disabled={!scenarios.length} onChange={() => setMode("scenario")} />
                A past crisis
              </label>
              {mode === "scenario" ? (
                <>
                  <select aria-label="Crisis" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={cn(inputClass, "w-full")}>
                    {scenarios.map((s) => (
                      <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                    ))}
                  </select>
                  {selected ? (
                    <p className="text-3xs text-muted-foreground">
                      {selected.description} {selected.start} to {selected.end}. Nifty 50: <span className={tone(selected.index_change_pct)}>{signedPct(selected.index_change_pct)}</span>.
                    </p>
                  ) : null}
                </>
              ) : null}
              <label className="flex items-center gap-2 text-2xs">
                <input type="radio" name="stress-mode" checked={mode === "move"} onChange={() => setMode("move")} />
                A Nifty 50 move of
                <input aria-label="Index move in percent" value={move} onChange={(e) => setMove(e.target.value)} disabled={mode !== "move"} inputMode="decimal" className={cn(inputClass, "w-16")} />%
              </label>
              {scenariosError ? <p className="text-3xs text-muted-foreground">Crisis windows are unavailable: {scenariosError}</p> : null}
            </fieldset>
            <button type="submit" disabled={stressBusy} className={buttonClass}>{stressBusy ? "Running…" : "Run stress test"}</button>
            <ErrorNote message={stressError} />
          </form>

          <div className="space-y-3 border border-border bg-surface p-3 lg:col-span-2" aria-live="polite">
            {stress ? (
              <>
                <h2 className="border-b border-border/60 pb-1.5 text-3xs font-bold uppercase text-muted-foreground">{stress.scenario.name}</h2>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {[
                    ["Portfolio", signedPct(stress.change_pct), stress.change_pct],
                    ["In rupees", rupees(stress.pnl_inr), stress.pnl_inr],
                    ["Nifty 50", signedPct(stress.index_change_pct), stress.index_change_pct],
                    ["Against the index", signedPct(stress.relative_to_index_pct), stress.relative_to_index_pct],
                  ].map(([label, value, raw]) => (
                    <div key={label as string} className="border border-border bg-surface-muted/30 p-2">
                      <span className="text-3xs uppercase text-muted-foreground">{label}</span>
                      <div className={cn("mt-0.5 text-sm font-bold", tone(raw as number | null))}>{value}</div>
                    </div>
                  ))}
                </div>
                {stress.coverage_pct < 100 ? (
                  <p className="text-3xs text-muted-foreground">
                    The totals cover {num(stress.coverage_pct, 1)}% of the portfolio by value; holdings with no price history are left out.
                  </p>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-2xs">
                    <thead>
                      <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                        <th className="py-1.5" scope="col">Holding</th>
                        <th className="py-1.5 text-right" scope="col">Weight</th>
                        <th className="py-1.5 text-right" scope="col">Change</th>
                        <th className="py-1.5 text-right" scope="col">Gain / loss</th>
                        <th className="py-1.5 pl-3" scope="col">Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {stress.holdings.map((h) => (
                        <tr key={h.symbol}>
                          <th className="py-1.5 font-bold" scope="row">{h.symbol}</th>
                          <td className="py-1.5 text-right">{num(h.weight_pct, 1)}%</td>
                          <td className={cn("py-1.5 text-right font-bold", tone(h.change_pct))}>{signedPct(h.change_pct)}</td>
                          <td className={cn("py-1.5 text-right", tone(h.pnl_inr))}>{rupees(h.pnl_inr)}</td>
                          <td className="py-1.5 pl-3 text-muted-foreground" title={h.note ?? undefined}>{METHOD_LABEL[h.method]}{h.beta !== null ? `, beta ${num(h.beta)}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Caveats items={stress.caveats} provenance={stress.provenance} />
              </>
            ) : (
              <p className="py-6 text-center text-2xs text-muted-foreground">
                Enter your holdings and run a test. A crisis replay uses what each share actually did across those dates; a share that was not listed then is estimated from its beta and marked.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "REGRESSION" ? (
        <div className="space-y-3 border border-border bg-surface p-3">
          <form onSubmit={runRegression} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="reg-symbol">Ticker</label>
            <input id="reg-symbol" value={regSymbol} onChange={(e) => setRegSymbol(e.target.value.toUpperCase())} placeholder="TICKER" maxLength={20} className={cn(inputClass, "w-32 uppercase")} />
            <button type="submit" disabled={regBusy} className={buttonClass}>{regBusy ? "Fitting…" : "Run regression"}</button>
          </form>
          <ErrorNote message={regError} />
          <div aria-live="polite">
            {regression ? (
              regression.rows.length ? (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-2xs">
                      <thead>
                        <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                          <th className="py-1.5" scope="col">Index</th>
                          <th className="py-1.5 text-right" scope="col">Beta</th>
                          <th className="py-1.5 text-right" scope="col">Alpha (a year)</th>
                          <th className="py-1.5 text-right" scope="col">R²</th>
                          <th className="py-1.5 text-right" scope="col">t (beta)</th>
                          <th className="py-1.5 text-right" scope="col">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {regression.rows.map((r) => (
                          <tr key={r.benchmarkId} className={r.benchmarkId === regression.primary ? "font-bold text-accent" : undefined}>
                            <th className="py-1.5 font-[inherit]" scope="row">{r.benchmarkName}</th>
                            <td className="py-1.5 text-right">{num(r.beta)}</td>
                            <td className="py-1.5 text-right">{signedPct(r.alphaPct)}</td>
                            <td className="py-1.5 text-right">{num(r.rSquared, 3)}</td>
                            <td className="py-1.5 text-right">{num(r.tStatBeta)}</td>
                            <td className="py-1.5 text-right">{r.observationWindowDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-3xs text-muted-foreground">
                    {regression.symbol}: ordinary least squares on daily returns over three years. The highlighted index explains the most of the share&apos;s movement. Size, value and momentum factors are not offered: no free source publishes those return series for India.
                  </p>
                </div>
              ) : (
                <p className="text-2xs text-muted-foreground">{regression.note}</p>
              )
            ) : (
              <p className="py-4 text-2xs text-muted-foreground">Enter a ticker to see how its daily returns relate to each index with a usable history.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "BACKTEST" ? (
        <div className="space-y-3 border border-border bg-surface p-3">
          <form onSubmit={runBacktest} className="flex flex-wrap items-end gap-3 text-2xs">
            {([
              ["symbol", "Ticker", "w-28 uppercase"],
              ["fast", "Fast average (days)", "w-20"],
              ["slow", "Slow average (days)", "w-20"],
              ["years", "Years of history", "w-16"],
              ["capital", "Capital (₹)", "w-28"],
            ] as const).map(([key, label, width]) => (
              <label key={key} className="flex flex-col gap-1 text-3xs uppercase text-muted-foreground">
                {label}
                <input value={bt[key]} onChange={(e) => setBt((v) => ({ ...v, [key]: key === "symbol" ? e.target.value.toUpperCase() : e.target.value }))} inputMode={key === "symbol" ? "text" : "numeric"} maxLength={20} className={cn(inputClass, width)} />
              </label>
            ))}
            <button type="submit" disabled={btBusy} className={buttonClass}>{btBusy ? "Running…" : "Run backtest"}</button>
          </form>
          <ErrorNote message={btError} />
          <div aria-live="polite">
            {backtest ? (
              <div className="space-y-3">
                <p className="text-2xs text-foreground">
                  <span className="font-bold">{backtest.symbol}</span>: {backtest.strategy}, on {backtest.data.sessions} daily closes from {backtest.data.from} to {backtest.data.to}.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-2xs">
                    <thead>
                      <tr className="border-b border-border text-3xs font-bold uppercase text-muted-foreground">
                        <th className="py-1.5" scope="col">Measure</th>
                        <th className="py-1.5 text-right" scope="col">Earlier stretch</th>
                        <th className="py-1.5 text-right" scope="col">Later stretch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {([
                        ["Dates", (p) => `${p.from} to ${p.to}`],
                        ["Return after charges", (p) => signedPct(p.net_return_pct)],
                        ["Buy and hold, same dates", (p) => signedPct(p.buy_and_hold_return_pct)],
                        ["Return a year (CAGR)", (p) => signedPct(p.net_cagr_pct)],
                        ["Largest fall from a peak", (p) => `${num(p.max_drawdown_pct)}%`],
                        ["Sharpe ratio", (p) => num(p.sharpe_ratio)],
                        ["Closed trades", (p) => `${p.closed_trades}${p.open_position ? " (one still open)" : ""}`],
                        ["Winning trades", (p) => (p.win_rate_pct === null ? DASH : `${num(p.win_rate_pct, 1)}%`)],
                        ["Charges paid", (p) => rupees(p.charges_paid_inr)],
                      ] as [string, (p: ApiBacktestPeriod) => string][]).map(([label, fmt]) => (
                        <tr key={label}>
                          <th className="py-1.5 font-bold" scope="row">{label}</th>
                          <td className="py-1.5 text-right">{fmt(backtest.earlier_period)}</td>
                          <td className="py-1.5 text-right">{fmt(backtest.later_period)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Caveats items={backtest.caveats} provenance={backtest.provenance} />
              </div>
            ) : (
              <p className="py-4 text-2xs text-muted-foreground">
                Tests a moving-average crossover on the share&apos;s recorded daily closes, split into an earlier and a later stretch so you can see whether the rule held up. Use NIFTY50 for the index.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
