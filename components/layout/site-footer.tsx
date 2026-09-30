import { Activity } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/40">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded bg-accent text-accent-foreground">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Arth<span className="text-accent">dex</span>
          </span>
        </div>

        <p className="text-2xs text-muted-foreground sm:ml-auto sm:max-w-xl sm:text-right">
          Figures shown are structured mock data for interface development and are not
          investment advice. Arthdex is not a registered investment adviser.
        </p>
      </div>
    </footer>
  );
}
