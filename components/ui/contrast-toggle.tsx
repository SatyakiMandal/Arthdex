"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Contrast } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

export function ContrastToggle({ className }: { className?: string }) {
  const [isUltra, setIsUltra] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("arthdex_contrast") === "ultra";
  });

  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (localStorage.getItem("arthdex_contrast") === "ultra") {
      document.documentElement.setAttribute("data-contrast", "ultra");
      document.documentElement.classList.add("ultra-contrast");
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && (e.key === "C" || e.key === "c")) {
        const activeEl = document.activeElement;
        const isInput =
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.tagName === "SELECT";
        if (isInput) return;
        e.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggle() {
    setIsUltra((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.setAttribute("data-contrast", "ultra");
        document.documentElement.classList.add("ultra-contrast");
        localStorage.setItem("arthdex_contrast", "ultra");
      } else {
        document.documentElement.removeAttribute("data-contrast");
        document.documentElement.classList.remove("ultra-contrast");
        localStorage.setItem("arthdex_contrast", "standard");
      }
      return next;
    });
  }

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-7 w-7 rounded-none border border-border/80 bg-surface/50 opacity-0",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        isUltra
          ? "Switch to standard contrast mode (Shift+C)"
          : "Switch to high contrast terminal mode (Shift+C)"
      }
      aria-label="Toggle terminal contrast mode"
      aria-pressed={isUltra}
      className={cn(
        "group relative flex h-7 items-center gap-1.5 rounded-none border px-2 font-mono text-2xs font-semibold uppercase tracking-wider transition-all duration-150",
        isUltra
          ? "border-accent bg-accent/15 text-accent shadow-[0_0_8px_rgba(235,160,0,0.25)]"
          : "border-border/80 bg-surface text-muted-foreground hover:border-accent/50 hover:bg-surface-muted hover:text-foreground",
        className,
      )}
    >
      <Contrast
        className={cn(
          "h-3 w-3 transition-transform duration-200 group-hover:rotate-180",
          isUltra ? "text-accent fill-accent/20" : "text-muted-foreground",
        )}
      />
      <span className="hidden sm:inline">
        {isUltra ? "Ultra" : "Standard"}
      </span>
      <span className="hidden xl:inline text-3xs font-normal opacity-60">
        [⇧C]
      </span>
    </button>
  );
}
