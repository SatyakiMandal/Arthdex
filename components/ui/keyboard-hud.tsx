"use client";

import { useEffect, useState } from "react";
import { Keyboard, ChevronDown, ChevronUp, Terminal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KeyboardShortcutItem {
  key: string;
  label: string;
  action?: () => void;
  accent?: boolean;
}

interface KeyboardHudProps {
  shortcuts?: KeyboardShortcutItem[];
  contextLabel?: string;
  className?: string;
  defaultExpanded?: boolean;
}

const DEFAULT_DESK_SHORTCUTS: KeyboardShortcutItem[] = [
  { key: "/", label: "Quick Filter", accent: true },
  { key: "↑ / ↓", label: "Row Select" },
  { key: "Enter", label: "Inspect Scrip" },
  { key: "G + D", label: "F&O Desk" },
  { key: "G + B", label: "Bhavcopy" },
  { key: "Shift+C", label: "Pitch Mode" },
  { key: "?", label: "All Hotkeys" },
];

export function KeyboardHud({
  shortcuts = DEFAULT_DESK_SHORTCUTS,
  contextLabel = "BLOOMBERG TERMINAL COMMAND HUD",
  className,
  defaultExpanded = true,
}: KeyboardHudProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (e.key === "/") {
        setActiveKey("/");
        setTimeout(() => setActiveKey(null), 300);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setActiveKey("↑ / ↓");
        setTimeout(() => setActiveKey(null), 300);
      } else if (e.key === "Enter") {
        setActiveKey("Enter");
        setTimeout(() => setActiveKey(null), 300);
      } else if (e.key === "?") {
        setActiveKey("?");
        setTimeout(() => setActiveKey(null), 300);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className={cn(
        "rounded-none border border-border/70 bg-surface/95 backdrop-blur-xs font-mono text-3xs shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-accent shrink-0" />
          <span className="font-bold tracking-wider uppercase text-foreground">
            {contextLabel}
          </span>
          <span className="text-border">|</span>
          <span className="text-muted-foreground hidden sm:inline flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 bg-emerald-500 rounded-none animate-pulse" />
            ZERO-LATENCY KEYBOARD NAVIGATION
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded-none"
            aria-label={expanded ? "Collapse hotkeys bar" : "Expand hotkeys bar"}
          >
            <Keyboard className="h-3 w-3" />
            <span className="hidden md:inline">{expanded ? "Hide HUD" : "Show HUD"}</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-surface-muted/30">
          {shortcuts.map((sc) => {
            const isPressed = activeKey === sc.key;
            return (
              <button
                key={sc.key}
                type="button"
                onClick={sc.action}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-none border transition-all text-left",
                  isPressed
                    ? "border-accent bg-accent/20 text-accent ring-1 ring-accent"
                    : sc.accent
                    ? "border-accent/40 bg-accent/10 text-foreground hover:border-accent"
                    : "border-border/60 bg-surface hover:bg-surface-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <kbd
                  className={cn(
                    "px-1 py-0.2 rounded-none font-bold text-3xs border",
                    sc.accent
                      ? "border-accent/60 bg-accent/20 text-accent"
                      : "border-border bg-muted/60 text-foreground",
                  )}
                >
                  {sc.key}
                </kbd>
                <span className="font-sans text-2xs font-medium text-foreground">
                  {sc.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
