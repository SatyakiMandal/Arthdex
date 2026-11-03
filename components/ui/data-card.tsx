import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tip";

/**
 * Shared panel shell used across the quant, unlisted, IPO and company surfaces.
 *
 * The title carries the panel; the icon prop is still accepted from existing
 * call sites but no longer drawn, since an icon on every panel is decoration
 * the reader has to look past rather than information.
 */
export function DataCard({
  title,
  subtitle,
  badge,
  children,
  footnote,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footnote?: string;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-border bg-surface", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {badge}
      </header>

      <div className="flex-1 border-t border-border">{children}</div>

      {footnote ? (
        <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">{footnote}</p>
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
        "inline-flex h-6 select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-2xs font-medium uppercase tracking-wide transition-colors",
        styles[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot[tone])} aria-hidden />
      {label}
    </span>
  );
  return hint ? <Tip title={hint}>{pill}</Tip> : pill;
}
