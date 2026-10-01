"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ExportCsv } from "@/components/ui/export-csv";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import type { ApiCalendar } from "@/lib/api/types";

type View = "results" | "meetings" | "actions";
type ActionKind = "all" | "dividend" | "split" | "bonus" | "rights" | "other";

const ACTION_KINDS: { id: ActionKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "dividend", label: "Dividends" },
  { id: "split", label: "Splits" },
  { id: "bonus", label: "Bonus" },
  { id: "rights", label: "Rights" },
];

const KIND_TONE: Record<string, string> = {
  dividend: "bg-up/10 text-up",
  split: "bg-accent/10 text-accent",
  bonus: "bg-accent/10 text-accent",
  rights: "bg-flat/10 text-flat",
  other: "bg-muted text-muted-foreground",
};

function dayLabel(iso: string | null): string {
  if (!iso) return "Date not stated";
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const base = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return diff === 0 ? `Today · ${base}` : diff === 1 ? `Tomorrow · ${base}` : base;
}

function groupByDate<T extends { date?: string | null; exDate?: string | null }>(rows: T[], pick: (r: T) => string | null) {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = pick(r) ?? "";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()];
}

export function CalendarView({ calendar }: { calendar: ApiCalendar }) {
  const resultsCount = calendar.meetings.filter((m) => m.isResults).length;
  const [view, setView] = useState<View>("results");
  const [kind, setKind] = useState<ActionKind>("all");
  const [query, setQuery] = useState("");

  const views = [
    { id: "results" as const, label: `Results (${resultsCount})` },
    { id: "meetings" as const, label: `All board meetings (${calendar.meetings.length})` },
    { id: "actions" as const, label: `Corporate actions (${calendar.actions.length})` },
  ];

  const q = query.trim().toLowerCase();
  const meetings = useMemo(
    () =>
      calendar.meetings.filter(
        (m) => (view === "meetings" || m.isResults) && (!q || m.name.toLowerCase().includes(q) || m.symbol.toLowerCase().includes(q)),
      ),
    [calendar.meetings, view, q],
  );
  const actions = useMemo(
    () =>
      calendar.actions.filter(
        (a) => (kind === "all" || a.kind === kind) && (!q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)),
      ),
    [calendar.actions, kind, q],
  );

  const label = "mb-1.5 block text-2xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-4 rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
        <div>
          <span className={label}>Show</span>
          <SegmentedControl options={views} value={view} onChange={setView} layoutGroupId="cal-view" />
        </div>
        {view === "actions" ? (
          <div>
            <span className={label}>Type</span>
            <SegmentedControl options={ACTION_KINDS} value={kind} onChange={setKind} layoutGroupId="cal-kind" />
          </div>
        ) : null}
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="cal-search" className={label}>
            Company
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="cal-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or symbol"
              className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-accent/60"
            />
          </div>
        </div>
        {view === "actions" ? (
          <ExportCsv
            filename="arthdex-corporate-actions"
            header={["Symbol", "Company", "Type", "Subject", "Ex-date", "Record date"]}
            rows={actions.map((a) => [a.symbol, a.name, a.kind, a.subject, a.exDate, a.recordDate])}
          />
        ) : (
          <ExportCsv
            filename="arthdex-board-meetings"
            header={["Date", "Symbol", "Company", "Purpose", "Results"]}
            rows={meetings.map((m) => [m.date, m.symbol, m.name, m.purpose, m.isResults ? "yes" : ""])}
          />
        )}
      </div>

      {view === "actions" ? (
        actions.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-3">
            {groupByDate(actions, (a) => a.exDate).map(([date, rows]) => (
              <section key={date} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <h2 className="border-b border-border bg-surface-muted/40 px-4 py-2 text-xs font-semibold">
                  Ex-date {dayLabel(date || null)}
                </h2>
                <ul className="divide-y divide-border/60">
                  {rows.map((a, i) => (
                    <li key={`${a.symbol}-${i}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/company/${a.symbol}`} className="font-mono text-xs font-semibold hover:text-accent">
                          {a.symbol}
                        </Link>
                        <span className="ml-2 text-2xs text-muted-foreground">{a.name}</span>
                        <p className="mt-0.5 text-sm">{a.subject}</p>
                      </div>
                      <span className={cn("rounded px-2 py-0.5 font-mono text-2xs font-semibold uppercase", KIND_TONE[a.kind])}>{a.kind}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : meetings.length === 0 ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {groupByDate(meetings, (m) => m.date).map(([date, rows]) => (
            <section key={date} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <h2 className="border-b border-border bg-surface-muted/40 px-4 py-2 text-xs font-semibold">
                {dayLabel(date || null)} <span className="font-normal text-muted-foreground">· {rows.length}</span>
              </h2>
              <ul className="divide-y divide-border/60">
                {rows.map((m, i) => (
                  <li key={`${m.symbol}-${i}`} className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/company/${m.symbol}`} className="font-mono text-xs font-semibold hover:text-accent">
                        {m.symbol}
                      </Link>
                      <span className="text-2xs text-muted-foreground">{m.name}</span>
                      {m.isResults ? <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-2xs text-accent">Results</span> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">{m.purpose}{m.detail ? `: ${m.detail}` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
      Nothing matches those filters in the next 30 days.
    </p>
  );
}
