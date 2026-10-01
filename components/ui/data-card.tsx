import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tip";

/** Shared panel shell used across the quant, unlisted and IPO surfaces. */
export function DataCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  footnote,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footnote?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "group/card flex animate-fade-up flex-col rounded-xl border border-border bg-surface shadow-[0_1px_2px_hsl(224_40%_2%/0.12)] transition-[border-color,box-shadow] duration-300 hover:border-accent/30 hover:shadow-[0_10px_30px_-18px_hsl(var(--accent)/0.45)]",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-t-xl border-b border-border bg-gradient-to-b from-surface-muted/60 to-transparent px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-gradient-to-br from-accent/15 to-accent/5 text-accent shadow-inner transition-transform duration-300 group-hover/card:scale-105">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-2xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {badge}
      </header>

      <div className="flex-1">{children}</div>

      {footnote ? (
        <p className="border-t border-border px-4 py-2 text-2xs text-muted-foreground">{footnote}</p>
      ) : null}
    </section>
  );
}

/**
 * Status pill. Never wraps: a two-line pill next to single-line ones reads as a
 * different kind of element, so the label stays on one line and the pill grows.
 */
export function StatusPill({
  label,
  tone,
  hint,
  className,
}: {
  label: string;
  tone: "up" | "down" | "flat" | "neutral";
  hint?: string;
  className?: string;
}) {
  const styles = {
    up: "border-up/30 bg-up/10 text-up",
    down: "border-down/30 bg-down/10 text-down",
    flat: "border-flat/30 bg-flat/10 text-flat",
    neutral: "border-border bg-surface-muted text-muted-foreground",
  } as const;
  const dot = {
    up: "bg-up",
    down: "bg-down",
    flat: "bg-flat",
    neutral: "bg-muted-foreground",
  } as const;

  const pill = (
    <span
      className={cn(
        "inline-flex h-6 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-2xs font-semibold uppercase tracking-wider transition-colors",
        styles[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full shadow-[0_0_6px_currentColor]", dot[tone])} aria-hidden />
      {label}
    </span>
  );
  return hint ? <Tip title={hint}>{pill}</Tip> : pill;
}
