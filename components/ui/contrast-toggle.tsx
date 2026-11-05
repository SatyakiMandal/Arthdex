"use client";

import { useEffect, useState } from "react";
import { Contrast } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContrastToggle({ className }: { className?: string }) {
  const [isUltra, setIsUltra] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("arthdex_contrast");
    if (saved === "ultra") {
      setIsUltra(true);
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

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        isUltra
          ? "Switch to standard slate contrast (Shift+C)"
          : "Switch to ultra-dark pitch terminal contrast (Shift+C)"
      }
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 px-2.5 text-3xs font-mono font-bold tracking-wider uppercase rounded-none border transition-colors",
        isUltra
          ? "border-accent bg-accent/15 text-accent shadow-xs"
          : "border-border bg-surface-muted text-muted-foreground hover:text-foreground hover:bg-surface",
        className,
      )}
    >
      <Contrast className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{isUltra ? "Ultra Pitch" : "Pitch Mode"}</span>
    </button>
  );
}
