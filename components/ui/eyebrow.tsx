import type { LucideIcon } from "lucide-react";

/**
 * Page label above a page title: the brand's gold rule and a plain caption, the
 * same device as the home page date line, so every page opens the same way.
 * The icon prop is accepted for existing call sites but no longer drawn.
 */
export function Eyebrow({ children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2.5 text-xs font-medium text-muted-foreground">
      <span className="h-px w-6 bg-gold" aria-hidden />
      {children}
    </p>
  );
}
