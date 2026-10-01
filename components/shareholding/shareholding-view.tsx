"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Building2, Lock, PieChart, Scale, Users, UserCheck } from "lucide-react";
import { DataCard, StatusPill } from "@/components/ui/data-card";
import { Tip } from "@/components/ui/tip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn, deltaColor, formatINR } from "@/lib/utils";
import type { ApiShareholding, ShareholdingCategory, ShareholdingTable } from "@/lib/api/types";

const COLORS: Record<ShareholdingCategory["key"], string> = {
  promoters: "hsl(var(--accent))",
  fiis: "#22d3ee",
  diis: "#a78bfa",
  government: "#fb923c",
  public: "hsl(var(--muted-foreground) / 0.65)",
};
const KEYS: ShareholdingCategory["key"][] = ["promoters", "fiis", "diis", "government", "public"];
const NAMES: Record<ShareholdingCategory["key"], string> = {
  promoters: "Promoters",
  fiis: "FIIs",
  diis: "DIIs",
  government: "Government",
  public: "Public",
};
const MEANING: Record<ShareholdingCategory["key"], string> = {
  promoters: "The founding family or controlling shareholder and related entities.",
  fiis: "Foreign institutional investors: foreign funds and portfolio investors.",
  diis: "Domestic institutions: mutual funds, insurers, banks and pension funds.",
  government: "Holdings by the Government of India and its agencies.",
  public: "Retail investors, high-net-worth individuals, corporates and others.",
};

const fmt = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${v.toFixed(d)}%`);
const pp = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`);

function SignalIcon({ s }: { s: ShareholdingCategory["signal"] }) {
  if (s === "increasing") return <ArrowUpRight className="h-3.5 w-3.5 text-up" />;
  if (s === "decreasing") return <ArrowDownRight className="h-3.5 w-3.5 text-down" />;
  return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Spark({ values, color }: { values: (number | null)[]; color: string }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(22 - ((x - lo) / (hi - lo || 1)) * 20 - 1).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 22" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Donut({ parts }: { parts: { key: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="mx-auto w-full max-w-[200px]" role="img" aria-label="Latest ownership composition">
      <circle cx={70} cy={70} r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth={18} />
      {parts.map((p, i) => {
        const len = (p.value / total) * C;
        const el = (
          <circle
            key={p.key}
            cx={70}
            cy={70}
            r={R}
            fill="none"
            stroke={COLORS[p.key as ShareholdingCategory["key"]]}
            strokeWidth={18}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
            style={{ opacity: 1, transition: `opacity 0.5s ${i * 0.08}s` }}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function StackedHistory({ t }: { t: ShareholdingTable }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = t.labels.length;
  const idx = hover ?? n - 1;
  const step = 100 / n;
  return (
    <div onMouseLeave={() => setHover(null)}>
      <div className="flex h-56 items-end gap-[3px] px-4 pt-4" onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
      }}>
        {t.labels.map((label, i) => {
          const total = KEYS.reduce((a, k) => a + (t[k]?.[i] ?? 0), 0) || 100;
          return (
            <div key={label} className={cn("flex h-full min-w-0 flex-1 flex-col-reverse overflow-hidden rounded-t-sm transition-opacity", hover != null && hover !== i && "opacity-55")} style={{ width: `${step}%` }}>
              {KEYS.map((k) => {
                const v = t[k]?.[i];
                if (v == null) return null;
                return <div key={k} style={{ height: `${(v / total) * 100}%`, background: COLORS[k] }} />;
              })}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-4 pt-1 font-mono text-2xs text-muted-foreground">
        <span>{t.labels[0]}</span>
        <span>{t.labels[Math.floor(n / 2)]}</span>
        <span>{t.labels[n - 1]}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-3 text-2xs">
        <span className="font-mono text-muted-foreground">{t.labels[idx]}</span>
        {KEYS.filter((k) => t[k]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />
            <span className="text-muted-foreground">{NAMES[k]}</span>
            <span className="font-mono">{fmt(t[k]?.[idx], 2)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}

export function ShareholdingView({ data }: { data: ApiShareholding }) {
  const [view, setView] = useState<"quarterly" | "yearly">("quarterly");
  const a = data.analytics;
  const table = data.pattern ? data.pattern[view] : null;
  const cats = a?.categories ?? [];
  const latestParts = cats.filter((c) => c.latest != null && c.latest > 0).map((c) => ({ key: c.key, value: c.latest as number }));
  const pl = data.pledge;

  return (
    <div className="space-y-4">
      {!data.pattern ? (
        <p role="alert" className="rounded-xl border border-flat/40 bg-flat/10 px-4 py-3 text-sm">
          The shareholding pattern could not be loaded from screener.in. Filings-based sections below are still shown where available.
        </p>
      ) : null}

      {a ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {cats.map((c) => (
              <Tip key={c.key} title={MEANING[c.key]}>
                <div className="animate-fade-up rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[c.key] }} />
                      {c.label}
                    </p>
                    <SignalIcon s={c.signal} />
                  </div>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{fmt(c.latest)}</p>
                  <p className={cn("font-mono text-2xs", c.qoq != null && deltaColor(c.qoq))}>{pp(c.qoq)} QoQ · {pp(c.yoy)} YoY</p>
                  {data.pattern ? <Spark values={data.pattern.quarterly[c.key] ?? []} color={COLORS[c.key]} /> : null}
                </div>
              </Tip>
            ))}
          </div>
          {a.notes.length > 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <span className="mr-2 font-mono text-2xs uppercase tracking-wider text-accent">Notable</span>
              {a.notes.join(" ")}
            </p>
          ) : null}
        </>
      ) : null}

      {table ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DataCard
            title="Ownership over time"
            subtitle="Share of the company held by each group, as filed"
            icon={PieChart}
            badge={<SegmentedControl options={[{ id: "quarterly", label: "Quarterly" }, { id: "yearly", label: "Yearly" }]} value={view} onChange={setView} layoutGroupId="holding-view" />}
            footnote="Hover a bar to read that period. Each bar adds to 100%."
          >
            <StackedHistory t={table} />
          </DataCard>

          <DataCard title="Who owns it today" subtitle={a?.asOf ? `Filing for ${a.asOf}` : undefined} icon={Users}>
            <div className="grid items-center gap-4 p-4 sm:grid-cols-[170px_minmax(0,1fr)] lg:grid-cols-1 2xl:grid-cols-[170px_minmax(0,1fr)]">
              <Donut parts={latestParts} />
              <ul className="space-y-2.5 text-sm">
                {cats.map((c) => (
                  <li key={c.key}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[c.key] }} />
                        {c.label}
                      </span>
                      <span className="font-mono">{fmt(c.latest)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, c.latest ?? 0))}%`, background: COLORS[c.key] }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {a ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border p-4 text-sm sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Institutions (FII + DII)</p>
                  <p className="font-mono">{fmt(a.institutionalPct)}</p>
                  <p className={cn("font-mono text-2xs", deltaColor(a.institutionalYoy))}>{pp(a.institutionalYoy)} YoY</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Non-promoter float</p>
                  <p className="font-mono">{fmt(a.freeFloatPct)}</p>
                </div>
                {a.shareholderCount ? (
                  <div>
                    <p className="text-2xs uppercase tracking-wider text-muted-foreground">Shareholders</p>
                    <p className="font-mono">
                      {formatINR(a.shareholderCount.latest, 0)}{" "}
                      {a.shareholderCount.yoyPct != null ? <span className={cn("text-2xs", deltaColor(a.shareholderCount.yoyPct))}>({a.shareholderCount.yoyPct > 0 ? "+" : ""}{a.shareholderCount.yoyPct}% YoY)</span> : null}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DataCard>
        </div>
      ) : null}

      {cats.length > 0 ? (
        <DataCard
          title="Who is buying and selling"
          subtitle="Change in each group's holding between filings"
          icon={Scale}
          footnote={`A move of less than 0.25 percentage points between two filings is treated as stable. The streak counts consecutive quarters moving the same way. A holding can fall because others bought in a share issue, not only because someone sold.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Group</th>
                  <th className="px-3 py-2 text-right font-medium">Latest</th>
                  <th className="px-3 py-2 text-right font-medium">QoQ</th>
                  <th className="px-3 py-2 text-right font-medium">YoY</th>
                  <th className="px-3 py-2 text-right font-medium">Range</th>
                  <th className="px-3 py-2 text-right font-medium">Streak</th>
                  <th className="px-4 py-2 font-medium">Signal</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{c.label}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.latest)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", c.qoq != null && deltaColor(c.qoq))}>{pp(c.qoq)}</td>
                    <td className={cn("px-3 py-2 text-right font-mono", c.yoy != null && deltaColor(c.yoy))}>{pp(c.yoy)}</td>
                    <td className="px-3 py-2 text-right font-mono text-2xs text-muted-foreground">{fmt(c.low, 1)} – {fmt(c.high, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-2xs">{c.streak === 0 ? "—" : `${Math.abs(c.streak)}Q ${c.streak > 0 ? "up" : "down"}`}</td>
                    <td className="px-4 py-2">
                      <StatusPill
                        label={c.signal === "increasing" ? (c.key === "public" ? "Retail rising" : "Accumulating") : c.signal === "decreasing" ? (c.key === "public" ? "Retail falling" : "Reducing") : "Stable"}
                        tone={c.signal === "increasing" ? (c.key === "public" ? "flat" : "up") : c.signal === "decreasing" ? (c.key === "public" ? "flat" : "down") : "neutral"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard
          title="Promoter pledge"
          subtitle="Promoter shares pledged as security for loans"
          icon={Lock}
          badge={a?.pledgeTier ? <StatusPill label={`${a.pledgeTier} pledge`} tone={a.pledgeTier === "None" || a.pledgeTier === "Low" ? "up" : a.pledgeTier === "Moderate" ? "flat" : "down"} /> : undefined}
          footnote="Pledged shares can be sold by lenders if the share price falls far enough, so a high pledge adds risk. Filed quarterly."
        >
          {!pl ? (
            <Empty>No pledge disclosure was found. Companies with no promoter, or with no pledge, often file nothing.</Empty>
          ) : (
            <div className="space-y-4 p-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xs uppercase tracking-wider text-muted-foreground">Pledged share of promoter holding</span>
                  <span className="font-mono text-xl font-semibold">{fmt(pl.pledgedPct)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div className={cn("h-full rounded-full", (pl.pledgedPct ?? 0) >= 20 ? "bg-down" : (pl.pledgedPct ?? 0) >= 5 ? "bg-flat" : "bg-up")} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pl.pledgedPct ?? 0)}%` }} transition={{ duration: 0.9 }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Promoter holding</p>
                  <p className="font-mono">{fmt(pl.promoterPct)}</p>
                </div>
                <div>
                  <p className="text-2xs uppercase tracking-wider text-muted-foreground">Shares pledged</p>
                  <p className="font-mono">{pl.sharesPledged != null ? formatINR(pl.sharesPledged, 0) : "—"}</p>
                </div>
                <div className="col-span-2 text-2xs text-muted-foreground">As of {pl.asOf ?? "latest filing"}</div>
              </div>
            </div>
          )}
        </DataCard>

        <DataCard title="Holder summary" subtitle="Insider and institutional share of the float (Yahoo Finance)" icon={Building2}>
          {!data.yahoo ? (
            <Empty>Yahoo Finance returned no holder summary for this company.</Empty>
          ) : (
            <div className="grid grid-cols-3 gap-3 p-4 text-sm">
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Insiders</p>
                <p className="font-mono text-lg">{fmt(data.yahoo.insidersPct, 1)}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Institutions</p>
                <p className="font-mono text-lg">{fmt(data.yahoo.institutionsPct, 1)}</p>
              </div>
              <div>
                <p className="text-2xs uppercase tracking-wider text-muted-foreground">Institutions of float</p>
                <p className="font-mono text-lg">{fmt(data.yahoo.institutionsOfFloatPct, 1)}</p>
              </div>
            </div>
          )}
          <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">Yahoo&apos;s definitions differ from the exchange filing categories above, so the figures will not match exactly.</p>
        </DataCard>
      </div>

      <DataCard
        title="Significant holders: acquisitions and sales"
        subtitle="Disclosures by anyone crossing or moving a 5% holding (SEBI Takeover Regulation 29)"
        icon={UserCheck}
        footnote="Each row is what the holder reported to the exchange: how much they moved, and their stake afterwards."
      >
        {data.largeHolders.length === 0 ? (
          <Empty>No large-holder disclosures were found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Holder</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 text-right font-medium">Shares</th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                  <th className="px-3 py-2 text-right font-medium">Stake after</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Filed</th>
                </tr>
              </thead>
              <tbody>
                {data.largeHolders.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      {r.name}
                      {r.promoterGroup ? <span className="ml-2 rounded border border-accent/30 px-1.5 text-2xs text-accent">Promoter group</span> : null}
                    </td>
                    <td className="px-3 py-2"><StatusPill label={r.action} tone={r.action === "Acquired" ? "up" : "down"} /></td>
                    <td className="px-3 py-2 text-right font-mono">{r.shares != null ? formatINR(r.shares, 0) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.pctChange != null ? `${r.action === "Sold" ? "−" : "+"}${r.pctChange.toFixed(2)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.pctAfter)}</td>
                    <td className="px-3 py-2 text-2xs text-muted-foreground">{r.period ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-2xs text-muted-foreground">{r.filedOn?.slice(0, 11) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard
        title="Insider trading"
        subtitle="Trades reported by directors, key managers and their relatives"
        icon={UserCheck}
        badge={a?.insiderFlow ? <StatusPill label={`${a.insiderFlow.net} · ${a.insiderFlow.window}`} tone={a.insiderFlow.net === "Net buying" ? "up" : a.insiderFlow.net === "Net selling" ? "down" : "neutral"} hint={`Bought ₹${formatINR(a.insiderFlow.buyValueInr, 0)}, sold ₹${formatINR(a.insiderFlow.sellValueInr, 0)} across ${a.insiderFlow.count} disclosures`} /> : undefined}
        footnote="Insiders sell for many reasons (tax, diversification, option exercises), so selling is a weaker signal than buying with their own money."
      >
        {data.insiders.length === 0 ? (
          <Empty>No insider-trading disclosures were found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 text-right font-medium">Shares</th>
                  <th className="px-3 py-2 text-right font-medium">Value ₹</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Traded</th>
                </tr>
              </thead>
              <tbody>
                {data.insiders.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-3 py-2 text-2xs text-muted-foreground">{r.category}</td>
                    <td className="px-3 py-2"><StatusPill label={r.action || "—"} tone={r.action === "Buy" ? "up" : r.action === "Sell" ? "down" : "neutral"} /></td>
                    <td className="px-3 py-2 text-right font-mono">{r.securities != null ? formatINR(r.securities, 0) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.valueInr != null ? formatINR(r.valueInr, 0) : "—"}</td>
                    <td className="px-3 py-2 text-2xs text-muted-foreground">{r.mode}</td>
                    <td className="px-4 py-2 font-mono text-2xs text-muted-foreground">{r.tradedOn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
