"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Terminal, CornerDownLeft, Sparkles, X, History, BookOpen, HelpCircle, Mic } from "lucide-react";
import { VoiceBoxModal } from "@/components/voice/voice-box-modal";
import { TerminalCopilotDrawer } from "@/components/copilot/terminal-copilot-drawer";
import { parseTerminalCommand, searchFunctions, TERMINAL_FUNCTIONS, TerminalFunction, SecurityType } from "@/lib/terminal/functions";
import { useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "arthdex_terminal_cmd_history";

export function TerminalCommandBar({ className }: { className?: string }) {
  const router = useRouter();
  const { dict } = useLocale();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [history, setHistory] = useState<string[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotSymbol, setCopilotSymbol] = useState("RELIANCE");
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load command history
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem(HISTORY_KEY);
        if (saved) {
          setHistory(JSON.parse(saved));
        }
      } catch {
        // Ignore storage errors
      }
    });
  }, []);

  // Global Keyboard shortcuts: '/' or 'Alt+K' or '`' (backtick) focuses the command line
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in another input/textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.altKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        setVoiceOpen((v) => !v);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setCopilotOpen((c) => !c);
        return;
      }
      if ((e.key === "/" || e.key === "`" || e.key === "F1" || (e.key === "?" && !isInput) || (e.altKey && e.key.toLowerCase() === "k")) && !isInput) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside to collapse dropdown if empty
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!input) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [input]);

  const parsed = parseTerminalCommand(input);
  const rawQuery = input.split(/\s+/).pop() || "";
  const suggestions = rawQuery.trim()
    ? searchFunctions(rawQuery)
    : selectedCategory === "ALL"
    ? TERMINAL_FUNCTIONS.slice(0, 16)
    : TERMINAL_FUNCTIONS.filter((f) => f.category === selectedCategory);

  const executeCommand = (cmdText: string) => {
    const trimmed = cmdText.trim();
    const upper = trimmed.toUpperCase();

    if (upper === "VOICE" || upper === "SPEECH") {
      setVoiceOpen(true);
      setIsOpen(false);
      setInput("");
      return;
    }
    const askMatch = trimmed.match(/^([A-Za-z0-9_&]+)\s+(?:ASK|COPILOT|AI)(?:\s+(.*))?$/i);
    if (askMatch) {
      setCopilotSymbol(askMatch[1].toUpperCase());
      setCopilotInitialPrompt(askMatch[2] ? askMatch[2].replace(/^["']|["']$/g, "").trim() : "");
      setCopilotOpen(true);
      setIsOpen(false);
      setInput("");
      return;
    }
    if (upper === "ASK" || upper === "AI" || upper === "COPILOT" || upper.startsWith("ASK ")) {
      const q = upper.startsWith("ASK ") ? trimmed.slice(4).trim() : "";
      setCopilotInitialPrompt(q);
      setCopilotOpen(true);
      setIsOpen(false);
      setInput("");
      return;
    }
    const cmd = parseTerminalCommand(cmdText);
    if (!cmd.targetUrl) return;

    // Save to history
    try {
      const updated = [cmdText, ...history.filter((h) => h !== cmdText)].slice(0, 20);
      setHistory(updated);
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    setIsOpen(false);
    setInput("");
    setHistoryIndex(-1);

    startTransition(() => {
      router.push(cmd.targetUrl!);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        executeCommand(input.trim());
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx] ?? "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx] ?? "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const badgeColor = (type: SecurityType) => {
    switch (type) {
      case "EQ":
        return "bg-accent/20 text-accent border-accent/40";
      case "IX":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      case "COMM":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "MACRO":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "PORT":
        return "bg-purple-500/20 text-purple-400 border-purple-500/40";
      default:
        return "bg-muted text-foreground border-border";
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-2xl font-mono text-2xs", className)}>
      {/* Command Line Input Ribbon */}
      <div
        className={cn(
          "flex items-center gap-1.5 h-7 px-2 border bg-surface transition-all duration-150 rounded-none",
          isOpen
            ? "border-accent shadow-[0_0_12px_rgba(235,160,0,0.25)] ring-1 ring-accent/40"
            : "border-border/80 hover:border-border text-muted-foreground"
        )}
      >
        <Terminal className={cn("h-3.5 w-3.5 shrink-0", isOpen ? "text-accent animate-pulse" : "text-muted-foreground")} />

        {/* Dynamic Context Tag */}
        {input && parsed.symbol ? (
          <span
            className={cn(
              "px-1 py-0 text-3xs font-bold uppercase tracking-wider border rounded-none shrink-0",
              badgeColor(parsed.securityType)
            )}
          >
            {parsed.symbol} · {parsed.securityType}
          </span>
        ) : (
          <span className="hidden sm:inline-block px-1 py-0 text-3xs font-bold uppercase tracking-wider border border-border/80 bg-surface-muted text-muted-foreground rounded-none shrink-0">
            CMD
          </span>
        )}

        <input
          ref={inputRef}
          type="text"
          value={input}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setInput(e.target.value);
            setHistoryIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? "TCS FA · NIFTY OMON · SURV · GC · MOST · BHAV · PORT..." : (dict?.commands?.searchPlaceholder || "PRESS / OR ` FOR COMMAND LINE")}
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground/70 outline-none uppercase tracking-wider"
        />

        {/* Clear Button */}
        {input && (
          <button
            type="button"
            onClick={() => {
              setInput("");
              setHistoryIndex(-1);
              inputRef.current?.focus();
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Bloomberg <GO> Button */}
        <button
          type="button"
          onClick={() => {
            if (input.trim()) executeCommand(input.trim());
          }}
          disabled={!input.trim()}
          title="Execute Command (Enter)"
          className={cn(
            "flex items-center gap-1 h-5 px-1.5 font-mono text-3xs font-bold uppercase tracking-wider border rounded-none transition-colors shrink-0",
            input.trim()
              ? "bg-accent text-accent-foreground border-accent hover:brightness-110 active:scale-95"
              : "bg-surface-muted text-muted-foreground border-border/60 opacity-60 cursor-not-allowed"
          )}
        >
          <span>GO</span>
          <CornerDownLeft className="h-2.5 w-2.5" />
        </button>

        {/* Regional Voice Box (M30) */}
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          title="Regional 14-Language Voice Box (Alt+V)"
          className="flex items-center gap-0.5 h-5 px-1 font-mono text-3xs font-bold uppercase tracking-wider border border-border/80 bg-surface-muted/60 hover:bg-surface-muted hover:border-cyan-500 hover:text-cyan-400 text-muted-foreground rounded-none transition-colors shrink-0"
        >
          <Mic className="h-2.5 w-2.5 text-cyan-400" />
          <span className="hidden lg:inline">VOICE</span>
        </button>

        {/* AI Research Copilot (M24) */}
        <button
          type="button"
          onClick={() => setCopilotOpen(true)}
          title="AI Research Copilot (Alt+A)"
          className="flex items-center gap-0.5 h-5 px-1 font-mono text-3xs font-bold uppercase tracking-wider border border-border/80 bg-surface-muted/60 hover:bg-surface-muted hover:border-accent hover:text-accent text-muted-foreground rounded-none transition-colors shrink-0"
        >
          <Sparkles className="h-2.5 w-2.5 text-accent" />
          <span className="hidden lg:inline">ASK</span>
        </button>

        {/* Command Directory / Help Quick Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Command Directory & Academy (F1 / ?)"
          className="flex items-center gap-0.5 h-5 px-1 font-mono text-3xs font-bold uppercase tracking-wider border border-border/80 bg-surface-muted/60 hover:bg-surface-muted hover:border-accent hover:text-accent text-muted-foreground rounded-none transition-colors shrink-0"
        >
          <HelpCircle className="h-2.5 w-2.5" />
          <span className="hidden md:inline">CMD</span>
        </button>
      </div>

      {/* Autocomplete & Quick Reference Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-8 z-50 border border-border bg-surface shadow-2xl p-2 rounded-none space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Active Parse Preview */}
          {input.trim() && (
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5 text-3xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-accent" />
                <span>
                  TARGET: <strong className="text-foreground">{parsed.targetUrl}</strong>
                </span>
                {parsed.matchedFunction && (
                  <span className="text-accent font-semibold">({parsed.matchedFunction.name})</span>
                )}
              </div>
              <span className="text-muted-foreground/80 font-normal">PRESS ENTER TO EXECUTE</span>
            </div>
          )}

          {/* Category Filter Tabs & Quick Suggestions Grid */}
          <div>
            <div className="flex items-center justify-between gap-1 border-b border-border/60 pb-1 mb-1.5">
              <div className="flex items-center gap-1 overflow-x-auto text-3xs">
                {(["ALL", "Company", "Derivatives", "Markets", "Macro & Rates", "Portfolio", "Research", "System"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-1 py-0.2 border transition-colors whitespace-nowrap rounded-none",
                      selectedCategory === cat
                        ? "bg-accent text-accent-foreground border-accent font-bold"
                        : "bg-surface-muted/40 text-muted-foreground border-border/40 hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Link
                href="/help"
                onClick={() => setIsOpen(false)}
                className="hidden sm:flex items-center gap-1 text-3xs font-bold text-accent hover:underline shrink-0 pl-1"
              >
                <span>ACADEMY (HELP)</span>
                <BookOpen className="h-2.5 w-2.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-1">
              {suggestions.map((fn) => (
                <button
                  key={fn.code}
                  type="button"
                  onClick={() => {
                    const symbol = parsed.symbol || fn.defaultSymbol || "";
                    const fullCmd = symbol ? `${symbol} ${fn.code}` : fn.code;
                    executeCommand(fullCmd);
                  }}
                  className="flex items-center justify-between p-1.5 border border-border/50 bg-surface-muted/40 hover:bg-surface-muted hover:border-accent/60 transition-colors text-left rounded-none group"
                >
                  <div className="min-w-0 pr-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-accent group-hover:text-foreground">{fn.code}</span>
                      <span className="text-3xs text-muted-foreground truncate">{fn.name}</span>
                    </div>
                    <p className="text-3xs text-muted-foreground/80 truncate font-sans">{fn.description}</p>
                  </div>
                  <span className="text-3xs text-muted-foreground uppercase border border-border/40 px-1 py-0 shrink-0">
                    {fn.category}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent History Strip */}
          {history.length > 0 && (
            <div className="border-t border-border/60 pt-1.5 flex items-center gap-1.5 text-3xs text-muted-foreground overflow-x-auto whitespace-nowrap">
              <History className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="shrink-0 uppercase">Recent:</span>
              {history.slice(0, 5).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => executeCommand(h)}
                  className="px-1.5 py-0.5 border border-border/60 bg-surface-muted/60 text-foreground hover:border-accent hover:text-accent rounded-none"
                >
                  {h}
                </button>
              ))}
            </div>
          )}

          {/* Quick Academy Link */}
          <div className="border-t border-border/60 pt-1.5 flex items-center justify-between text-3xs text-muted-foreground">
            <Link
              href="/help"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1.5 text-accent hover:underline font-bold uppercase"
            >
              <BookOpen className="h-3 w-3" />
              <span>TERMINAL TUTORIAL &amp; HOW-TO GUIDE (HELP &lt;GO&gt;) →</span>
            </Link>
            <span className="hidden sm:inline-block font-mono text-muted-foreground/70">
              PRESS F1 OR ? TO TOGGLE
            </span>
          </div>
        </div>
      )}

      {/* Voice Box Modal (M30) */}
      <VoiceBoxModal
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onExecute={(cmd) => executeCommand(cmd)}
      />

      {/* AI Research Copilot Floating Bloomberg Window (M24) */}
      <TerminalCopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        defaultSymbol={copilotSymbol}
        initialPrompt={copilotInitialPrompt}
      />
    </div>
  );
}
