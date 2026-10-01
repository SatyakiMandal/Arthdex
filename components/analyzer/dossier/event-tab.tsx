"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Newspaper, Radar, Grid3x3 } from "lucide-react";
import { DataCard } from "@/components/ui/data-card";
import { cn, deltaColor } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { Empty, Table, Td, dash, fracSigned, num } from "./shared";

export function EventTab({ s }: { s: ListedSummary }) {
  const es = s.detail.event_study;
  const [open, setOpen] = useState<string | null>(null);
  const mult = es.robustness.multipliers ?? [];

  return (
    <div className="space-y-4">
      <DataCard
        title="Candidate incident days"
        subtitle={`${es.incidents.length} day${es.incidents.length === 1 ? "" : "s"} where unusual coverage met an unusual benchmark-adjusted move. Select a row to read the stories.`}
        icon={Newspaper}
        footnote="CAR is the cumulative abnormal return around the day; the p-value is empirical, from placebo windows of the same length in this company's own history. Descriptive association, not proof of causation."
      >
        {es.incidents.length === 0 ? (
          <Empty>No day cleared both the coverage and return thresholds in this window.</Empty>
        ) : (
          <Table
            min={960}
            head={[
              "",
              "Day",
              { label: "Abn. ret.", right: true },
              { label: "Ret z", right: true },
              { label: "Vol z", right: true },
              { label: "Articles", right: true },
              { label: "Tone", right: true },
              "Agrees?",
              { label: "CAR", right: true },
              { label: "t", right: true },
              { label: "p", right: true },
            ]}
          >
            {es.incidents.map((i) => {
              const isOpen = open === i.day;
              return (
                <Fragment key={i.day}>
                  <tr
                    className="cursor-pointer border-b border-border hover:bg-surface-muted/50"
                    onClick={() => setOpen(isOpen ? null : i.day)}
                  >
                    <Td className="w-6 pr-0 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Td>
                    <Td mono>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className="font-mono"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(isOpen ? null : i.day);
                        }}
                      >
                        {i.day}
                      </button>
                    </Td>
                    <Td right className={i.abnormal_return != null ? deltaColor(i.abnormal_return) : ""}>{fracSigned(i.abnormal_return)}</Td>
                    <Td right>{num(i.abnormal_return_z, 1)}</Td>
                    <Td right>{num(i.volume_z, 1)}</Td>
                    <Td right>{i.item_count ?? dash}</Td>
                    <Td right className={i.mean_sentiment != null ? deltaColor(i.mean_sentiment) : ""}>
                      {i.mean_sentiment != null ? (i.mean_sentiment > 0 ? "+" : "") + i.mean_sentiment.toFixed(2) : dash}
                    </Td>
                    <Td>{i.direction_agrees == null ? dash : i.direction_agrees ? "Yes" : "No"}</Td>
                    <Td right className={i.car != null ? deltaColor(i.car) : ""}>{fracSigned(i.car)}</Td>
                    <Td right>{num(i.t_stat, 2)}</Td>
                    <Td right>{num(i.p_value, 3)}</Td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-b border-border bg-surface-muted/30">
                      <td colSpan={11} className="px-4 py-3">
                        <p className="mb-2 text-2xs text-muted-foreground">
                          {[i.dominant_event, i.dominant_emotion, i.trajectory_type].filter(Boolean).join(" · ") || "No event classification"}
                        </p>
                        {i.headlines.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No stories were attached to this day.</p>
                        ) : (
                          <ul className="space-y-3">
                            {i.headlines.map((h, k) => (
                              <li key={k} className="text-sm">
                                <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
                                  <span className="font-mono uppercase">{(h.source ?? "").replace(/_/g, " ")}</span>
                                  {h.published ? <span className="font-mono">{h.published}</span> : null}
                                  {h.sentiment_label ? (
                                    <span className="rounded-full border border-border px-2 py-0.5">{h.sentiment_label}</span>
                                  ) : null}
                                </div>
                                {h.url ? (
                                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block hover:text-accent hover:underline">
                                    {h.headline}
                                  </a>
                                ) : (
                                  <p className="mt-0.5">{h.headline}</p>
                                )}
                                {h.summary ? <p className="mt-0.5 text-2xs text-muted-foreground">{h.summary}</p> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </Table>
        )}
      </DataCard>

      <DataCard
        title="Threshold robustness"
        subtitle={`Each candidate re-tested across ${es.robustness.combos ?? 9} coverage / return threshold combinations${mult.length ? ` (${mult.map((m) => `${m}×`).join(", ")})` : ""}`}
        icon={Grid3x3}
        footnote={es.robustness.note ?? undefined}
      >
        {es.robustness.days.length === 0 ? (
          <Empty>No candidate days to test.</Empty>
        ) : (
          <Table min={420} head={["Day", { label: "Flagged in", right: true }, "Robustness"]}>
            {es.robustness.days.map((d) => {
              const f = d.fraction ?? 0;
              return (
                <tr key={d.day} className="border-b border-border last:border-0">
                  <Td mono>{d.day}</Td>
                  <Td right>
                    {d.flagged_in ?? dash} / {d.of ?? dash}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-muted">
                        <div className={cn("h-full", f >= 0.99 ? "bg-up" : f >= 0.5 ? "bg-flat" : "bg-down")} style={{ width: `${f * 100}%` }} />
                      </div>
                      <span className="text-2xs text-muted-foreground">{f >= 0.99 ? "Robust" : f >= 0.5 ? "Moderate" : "Threshold-sensitive"}</span>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </DataCard>

      <DataCard
        title="Unattributed news radar"
        subtitle="Stories the engine could not pin to a trading day (missing or unreliable timestamp)"
        icon={Radar}
      >
        {es.unattributed.length === 0 ? (
          <Empty>Every collected story was attributed to a trading day.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {es.unattributed.map((u, i) => (
              <li key={i} className="px-4 py-2.5 text-sm">
                <span className="mr-2 font-mono text-2xs uppercase text-muted-foreground">{(u.source ?? "").replace(/_/g, " ")}</span>
                {u.url ? (
                  <a href={u.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">
                    {u.headline}
                  </a>
                ) : (
                  u.headline
                )}
                {u.reason ? <span className="ml-2 text-2xs text-muted-foreground">({u.reason})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}
