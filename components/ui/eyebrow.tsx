import type { LucideIcon } from "lucide-react";

/** Section label used at the top of every page: an icon chip and a tracked caption. */
export function Eyebrow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.2em] text-accent">
      <span className="grid h-6 w-6 place-items-center rounded-md border border-accent/25 bg-gradient-to-br from-accent/20 to-accent/5 shadow-[0_0_14px_-4px_hsl(var(--accent)/0.6)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </p>
  );
}
