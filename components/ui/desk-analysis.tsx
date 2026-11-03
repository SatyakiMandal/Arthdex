import { ArrowDownRight, ArrowUpRight, Info, ListChecks, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeskInsights } from "@/lib/api/types";

const TONE_TEXT: Record<string, string> = { up: "text-up", down: "text-down", flat: "text-flat", info: "text-foreground" };
const TONE_BORDER: Record<string, string> = {
  up: "border-up/30 bg-up/5",
  down: "border-down/30 bg-down/5",
  flat: "border-flat/30 bg-flat/5",
  info: "border-border bg-surface-muted/40",
};

function ToneIcon({ tone }: { tone: string }) {
  const c = "h-4 w-4 shrink-0";
  if (tone === "up") return <ArrowUpRight className={cn(c, "text-up")} />;
  if (tone === "down") return <ArrowDownRight className={cn(c, "text-down")} />;
  if (tone === "flat") return <Minus className={cn(c, "text-flat")} />;
  return <Info className={cn(c, "text-accent")} />;
}

/**
 * The analysis panel shared by the data-heavy pages. It renders a payload the backend computed
 * from the very data shown below it: a one-line read, headline figures, findings that each
 * cite a number, and small supporting tables.
 */
export function DeskAnalysis({ insights, title = "Desk analysis", className }: { insights: DeskInsights | null | undefined; title?: string; className?: string }) {
  if (!insights) return null;
  const { headline, metrics, findings, tables, method } = insights;

  return (
    <section className={cn("overflow-hidden rounded-lg border border-border bg-surface", className)}>
      <header className="flex items-start gap-3 border-b border-border/70 px-4 py-3">
        <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-balance text-sm font-medium leading-snug sm:text-base">{headline}</p>
        </div>
      </header>

      {metrics.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-px border-b border-border/70 bg-border">
          {metrics.map((m) => (
            <div key={m.label} className="bg-surface px-3 py-2.5">
              <p className="truncate text-2xs text-muted-foreground">{m.label}</p>
              <p className={cn("mt-0.5 truncate font-mono text-base font-medium tabular-nums", TONE_TEXT[m.tone])}>{m.value}</p>
              {m.sub ? <p className="truncate text-2xs text-muted-foreground">{m.sub}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ul className="space-y-2">
          {findings.length === 0 ? <li className="text-sm text-muted-foreground">Nothing in the data stands out enough to call out.</li> : null}
          {findings.map((f, i) => (
            <li key={i} className={cn("flex gap-2.5 rounded-lg border px-3 py-2", TONE_BORDER[f.tone] ?? TONE_BORDER.info)}>
              <span className="mt-0.5">
                <ToneIcon tone={f.tone} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{f.title}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {tables.length > 0 ? (
          <div className="space-y-3">
            {tables.map((t) => (
              <div key={t.title} className="overflow-x-auto rounded-lg border border-border bg-surface">
                <p className="border-b border-border px-3 py-1.5 text-2xs font-medium text-muted-foreground">{t.title}</p>
                <table className="w-full min-w-[260px] text-left text-[0.8125rem]">
                  <thead className="text-[0.625rem] text-muted-foreground">
                    <tr className="border-b border-border">
                      {t.columns.map((c, i) => (
                        <th key={i} className={cn("whitespace-nowrap px-3 py-1.5 font-medium", i > 0 && "text-right")}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        {r.map((cell, j) => (
                          <td key={j} className={cn("whitespace-nowrap px-3 py-1.5", j > 0 && "text-right font-mono tabular-nums")}>
                            {cell == null ? "—" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <p className="border-t border-border/70 px-4 py-2 text-2xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground/80">How this is computed. </span>
        {method} Descriptive statistics, not investment advice.
      </p>
    </section>
  );
}
