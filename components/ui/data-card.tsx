import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <section className={cn("flex flex-col rounded-xl border border-border bg-surface", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-accent">
            <Icon className="h-3.5 w-3.5" />
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

/** Uppercase pill used for regime / toxicity / verdict states inside the cards. */
export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "up" | "down" | "flat" | "neutral";
}) {
  const styles = {
    up: "border-up/40 bg-up/10 text-up",
    down: "border-down/40 bg-down/10 text-down",
    flat: "border-flat/40 bg-flat/10 text-flat",
    neutral: "border-border bg-surface-muted text-muted-foreground",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-2xs font-semibold uppercase tracking-widest",
        styles[tone],
      )}
    >
      {label}
    </span>
  );
}
