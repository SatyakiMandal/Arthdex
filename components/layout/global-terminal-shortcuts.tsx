"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Briefcase,
  CandlestickChart,
  Command,
  FileBarChart,
  Moon,
  Radio,
  Rocket,
  ScanSearch,
  Sigma,
  Star,
  Sunrise,
  X,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutItem {
  chord: string;
  fallbackKey: string;
  label: string;
  href?: string;
  action?: "contrast" | "search";
  icon: typeof Radio;
  desc: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { chord: "G M", fallbackKey: "Shift+M", label: "Market Watch", href: "/market-watch", icon: CandlestickChart, desc: "NSE movers, sector RRG & breadth" },
  { chord: "G L", fallbackKey: "Shift+L", label: "Live Market Cockpit", href: "/live", icon: Radio, desc: "Real-time God's-eye radar & tick pulse" },
  { chord: "G D", fallbackKey: "Shift+D", label: "Derivatives & F&O", href: "/derivatives", icon: Sigma, desc: "Option chains, buildup & ban list" },
  { chord: "G O", fallbackKey: "Shift+O", label: "Order Flow & Deals", href: "/orderflow", icon: Activity, desc: "VRVP, CVD, footprint & block deals" },
  { chord: "G S", fallbackKey: "Shift+S", label: "Screener Desk", href: "/screener", icon: ScanSearch, desc: "Vetted fundamentals & MACD momentum" },
  { chord: "G R", fallbackKey: "Shift+R", label: "Earnings & Catalysts", href: "/results", icon: FileBarChart, desc: "Scorecards, calendar & implied moves" },
  { chord: "G P", fallbackKey: "Shift+P", label: "Portfolio & Tax", href: "/portfolio", icon: Briefcase, desc: "Newton-Raphson XIRR & tax harvester" },
  { chord: "G B", fallbackKey: "Shift+B", label: "Daily Bhavcopy", href: "/bhavcopy", icon: Sunrise, desc: "Official NSE security-wise delivery radar" },
  { chord: "G W", fallbackKey: "Shift+W", label: "Watchlist Desk", href: "/watchlist", icon: Star, desc: "Listed & unlisted tracking portfolio" },
  { chord: "G I", fallbackKey: "Shift+I", label: "IPO Primary Desk", href: "/ipo", icon: Rocket, desc: "Mainboard & SME issues with subscription" },
  { chord: "G C", fallbackKey: "Shift+C", label: "Terminal Contrast", action: "contrast", icon: Moon, desc: "Toggle pitch-black charcoal theme" },
];

export function GlobalTerminalShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chordPending, setChordPending] = useState(false);
  const chordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearChord = useCallback(() => {
    setChordPending(false);
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }, []);

  const navigateTo = useCallback(
    (href?: string, action?: "contrast" | "search") => {
      setOpen(false);
      clearChord();
      if (href) {
        router.push(href);
      } else if (action === "contrast") {
        document.documentElement.classList.toggle("ultra-contrast");
        try {
          const cur = document.documentElement.classList.contains("ultra-contrast");
          localStorage.setItem("arthdex-contrast-mode", cur ? "ultra" : "standard");
        } catch {
          // ignore
        }
      }
    },
    [clearChord, router]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in form controls
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      // Help Modal Toggle on '?'
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
        clearChord();
        return;
      }

      // Escape closes modal and cancels active chord
      if (e.key === "Escape") {
        setOpen(false);
        clearChord();
        return;
      }

      // Search focus with '/'
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          "input[type='search'], input#search-input, input[name='q'], input[placeholder*='Search']"
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        clearChord();
        return;
      }

      // 1. Two-key chord navigation (G + Key)
      const key = e.key.toLowerCase();
      if (!chordPending) {
        if (key === "g" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setChordPending(true);
          chordTimerRef.current = setTimeout(() => {
            setChordPending(false);
          }, 1800);
          return;
        }
      } else {
        // Second chord key arrived
        e.preventDefault();
        clearChord();
        switch (key) {
          case "m":
            router.push("/market-watch");
            return;
          case "l":
            router.push("/live");
            return;
          case "d":
            router.push("/derivatives");
            return;
          case "o":
            router.push("/orderflow");
            return;
          case "s":
            router.push("/screener");
            return;
          case "r":
            router.push("/results");
            return;
          case "p":
            router.push("/portfolio");
            return;
          case "b":
            router.push("/bhavcopy");
            return;
          case "w":
            router.push("/watchlist");
            return;
          case "i":
            router.push("/ipo");
            return;
          case "c":
            document.documentElement.classList.toggle("ultra-contrast");
            try {
              const cur = document.documentElement.classList.contains("ultra-contrast");
              localStorage.setItem("arthdex-contrast-mode", cur ? "ultra" : "standard");
            } catch {
              // ignore
            }
            return;
          default:
            return;
        }
      }

      // 2. Direct Shift + Key fallbacks
      if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const k = e.key.toUpperCase();
        switch (k) {
          case "L":
            e.preventDefault();
            router.push("/live");
            break;
          case "M":
            e.preventDefault();
            router.push("/market-watch");
            break;
          case "D":
            e.preventDefault();
            router.push("/derivatives");
            break;
          case "O":
            e.preventDefault();
            router.push("/orderflow");
            break;
          case "S":
            e.preventDefault();
            router.push("/screener");
            break;
          case "R":
            e.preventDefault();
            router.push("/results");
            break;
          case "B":
            e.preventDefault();
            router.push("/bhavcopy");
            break;
          case "P":
            e.preventDefault();
            router.push("/portfolio");
            break;
          case "W":
            e.preventDefault();
            router.push("/watchlist");
            break;
          case "C":
            e.preventDefault();
            document.documentElement.classList.toggle("ultra-contrast");
            try {
              const cur = document.documentElement.classList.contains("ultra-contrast");
              localStorage.setItem("arthdex-contrast-mode", cur ? "ultra" : "standard");
            } catch {
              // ignore
            }
            break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, [chordPending, clearChord, router]);

  return (
    <>
      {/* Floating Chord HUD Toast */}
      {chordPending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 border border-gold bg-background/95 px-3 py-1.5 font-mono text-xs shadow-2xl backdrop-blur-md rounded-none animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="flex items-center gap-1.5 text-gold font-bold uppercase tracking-wider text-2xs">
            <span className="h-2 w-2 rounded-none bg-gold animate-ping" />
            [G] Chord
          </span>
          <span className="text-border">|</span>
          <span className="text-3xs text-muted-foreground">
            Tap <strong className="text-foreground">M</strong> (Market) · <strong className="text-foreground">L</strong> (Live) · <strong className="text-foreground">D</strong> (Deriv) · <strong className="text-foreground">O</strong> (Orderflow) · <strong className="text-foreground">S</strong> (Screener) · <strong className="text-foreground">R</strong> (Results)
          </span>
        </div>
      )}

      {/* Global Hotkeys Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl border border-border bg-surface p-5 rounded-none shadow-2xl space-y-4 font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-accent/15 border border-accent/30 text-accent rounded-none">
                  <Command className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-base text-foreground tracking-tight flex items-center gap-2">
                    <span>Bloomberg Terminal Navigation Hotkeys</span>
                  </h2>
                  <p className="text-3xs text-muted-foreground">
                    Zero-latency two-key chords [G + Key] or Shift + Key instant jump
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="border border-border bg-surface-raised px-2 py-1 text-muted-foreground hover:text-foreground rounded-none"
                title="Close (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs">
              {SHORTCUTS.map((sc) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={sc.chord}
                    onClick={() => navigateTo(sc.href, sc.action)}
                    className="flex items-center justify-between border border-border/70 bg-surface-muted/40 p-2 text-left hover:bg-surface-muted hover:border-accent/40 transition-colors rounded-none group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
                      <div className="min-w-0">
                        <span className="block font-bold text-foreground truncate group-hover:text-accent">
                          {sc.label}
                        </span>
                        <span className="block text-3xs text-muted-foreground truncate">
                          {sc.desc}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <kbd className="border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-3xs font-bold text-gold">
                        {sc.chord}
                      </kbd>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-2 text-3xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <kbd className="border border-border bg-surface-muted px-1.5 py-0.5 text-foreground font-bold">/</kbd>
                <span>Global Search Focus</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <kbd className="border border-border bg-surface-muted px-1.5 py-0.5 text-foreground font-bold">?</kbd>
                <span>Toggle Cheat Sheet</span>
              </div>
            </div>

            <div className="border-t border-border/80 pt-2 flex items-center justify-between text-3xs text-muted-foreground">
              <span>Pro-tip: Tap <kbd className="text-gold font-bold">G</kbd> then <kbd className="text-foreground font-bold">M</kbd> for Market Watch, <kbd className="text-gold font-bold">G</kbd> then <kbd className="text-foreground font-bold">L</kbd> for Live Cockpit</span>
              <button
                onClick={() => setOpen(false)}
                className="border border-border bg-surface-raised px-3 py-1 font-bold text-foreground hover:bg-surface-muted transition-colors rounded-none"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
