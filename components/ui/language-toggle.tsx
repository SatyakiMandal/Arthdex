"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLocale, LOCALES_META, SupportedLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, meta } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const localesList = Object.entries(LOCALES_META) as [SupportedLocale, typeof LOCALES_META[SupportedLocale]][];

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label="Change language / भाषा बदलें"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative inline-flex h-9 items-center justify-center gap-1.5 px-2 rounded-none border border-border",
          "bg-surface-muted text-muted-foreground transition-colors hover:text-foreground hover:border-accent/50",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          open && "border-accent text-accent",
          className
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="font-mono text-2xs font-bold uppercase tracking-wider">
          {locale.toUpperCase()}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-10 z-50 w-64 border border-border bg-surface p-1 shadow-2xl rounded-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1.5 border-b border-border/60 flex items-center justify-between">
            <span className="font-mono text-3xs font-bold tracking-wider text-muted-foreground uppercase">
              14 Indian Languages (M30)
            </span>
            <span className="text-3xs font-mono text-accent">VOICE · Alt+V</span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1 space-y-0.5 font-mono text-xs">
            {localesList.map(([code, itemMeta]) => {
              const selected = code === locale;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setLocale(code);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors rounded-none text-2xs",
                    selected
                      ? "bg-accent/15 text-accent font-bold border-l-2 border-accent"
                      : "text-foreground hover:bg-surface-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-3xs uppercase font-bold text-muted-foreground">
                      {code}
                    </span>
                    <span className="font-sans font-medium text-xs">{itemMeta.nativeName}</span>
                    <span className="text-3xs text-muted-foreground font-mono">({itemMeta.name})</span>
                  </div>
                  {selected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="px-2 py-1.5 border-t border-border/60 bg-surface-muted/50 text-3xs text-muted-foreground flex justify-between items-center">
            <span>SEBI Compliant Terminology</span>
            <span className="text-accent font-bold">Lakh / Crore</span>
          </div>
        </div>
      )}
    </div>
  );
}
