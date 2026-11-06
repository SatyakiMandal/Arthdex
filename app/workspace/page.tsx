import type { Metadata } from "next";
import { TerminalWorkspaceGrid } from "@/components/terminal/terminal-workspace-grid";

export const metadata: Metadata = {
  title: "Multi-Panel Terminal Launchpad Shell (WORKSPACE, W) · Arthdex",
  description:
    "4-window tiling Bloomberg-style workstation layout with cross-panel color-channel synchronization and institutional preset layouts.",
};

export default function WorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-2 sm:p-4 space-y-3">
      {/* Title Header */}
      <div className="flex flex-wrap items-baseline justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-foreground">
            MULTI-PANEL TERMINAL LAUNCHPAD SHELL (WORKSPACE, W)
          </h1>
          <span className="font-mono text-3xs text-muted-foreground">M1, M29 · 4-WINDOW TILED WORKSTATION</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
          <span className="text-accent font-bold">ALT+K: W &lt;GO&gt;</span>
          <span>•</span>
          <span>COLOR CHANNEL SYNC • 4 TILED PANELS</span>
        </div>
      </div>

      <TerminalWorkspaceGrid />
    </div>
  );
}
