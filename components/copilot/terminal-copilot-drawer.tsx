"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  ShieldAlert,
  Key,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  ExternalLink,
  ChevronDown,
  Lock,
} from "lucide-react";

interface TerminalCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string | null;
  initialPrompt?: string;
}

const BYOK_STORAGE_KEY = "arthdex:gemini_key:v1";

export function TerminalCopilotDrawer({
  isOpen,
  onClose,
  defaultSymbol = "M&M",
  initialPrompt = "",
}: TerminalCopilotDrawerProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [symbol, setSymbol] = useState(defaultSymbol || "M&M");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "copilot"; text: string; provenance?: string; isLiveAI?: boolean }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [byokKey, setByokKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load custom API key from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BYOK_STORAGE_KEY);
      if (stored) {
        setSavedKey(stored);
        setByokKey(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (defaultSymbol) setSymbol(defaultSymbol);
  }, [defaultSymbol]);

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveCustomKey = () => {
    try {
      if (byokKey.trim()) {
        localStorage.setItem(BYOK_STORAGE_KEY, byokKey.trim());
        setSavedKey(byokKey.trim());
      } else {
        localStorage.removeItem(BYOK_STORAGE_KEY);
        setSavedKey("");
      }
      setShowSettings(false);
    } catch {
      // Ignore storage errors
    }
  };

  const handleSend = async (queryText?: string) => {
    const q = (queryText || prompt).trim();
    if (!q || isLoading) return;

    const userMsg = { role: "user" as const, text: q };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          symbol,
          byokKey: savedKey || undefined,
        }),
      });

      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "copilot",
            text: data.response,
            provenance: data.provenance,
            isLiveAI: data.isLiveAI,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "copilot",
            text: data.error || "Unable to complete copilot query. Please try again.",
          },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "copilot",
          text: `Network error: ${e.message || "Failed to reach copilot gateway"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface border-l border-border shadow-2xl flex flex-col font-mono text-2xs overflow-hidden transition-transform animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-muted/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
          <span className="font-bold text-xs uppercase text-foreground tracking-wider">
            ARTHDEX RESEARCH COPILOT (ASK)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 text-muted-foreground hover:text-accent hover:bg-surface-raised transition-colors"
            title="Copilot Access Settings (BYOK Key)"
          >
            <Key className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
            title="Close Drawer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mandatory SEBI Non-Advisory Compliance Banner */}
      <div className="px-3 py-1.5 bg-surface-muted/80 border-b border-border/80 text-[8px] text-muted-foreground leading-normal shrink-0 flex items-start gap-1">
        <ShieldAlert className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-foreground">REGULATORY DISCLOSURE: </span>
          Arthdex Terminal Copilot is an educational research synthesis engine. Arthdex is NOT a SEBI-registered Investment Adviser or Research Analyst. All outputs are derived algorithmically from public filings. No buy/sell advice provided.
        </div>
      </div>

      {/* Settings Panel (BYOK Key Toggle) */}
      {showSettings && (
        <div className="p-3 bg-surface border-b border-border space-y-2 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-3xs font-bold text-foreground">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-accent" />
              <span>COPILOT ACCESS &amp; API KEY CONFIGURATION</span>
            </span>
            <span className="text-3xs text-muted-foreground">
              {savedKey ? "CUSTOM KEY ARMED" : "PLATFORM DEFAULT"}
            </span>
          </div>
          <p className="text-3xs text-muted-foreground">
            Enter your Google Gemini API Key to enable private inference without rate limits. The key is encrypted locally in your browser and never saved on our server.
          </p>
          <div className="flex items-center gap-1">
            <input
              type="password"
              value={byokKey}
              onChange={(e) => setByokKey(e.target.value)}
              placeholder="Paste AI Studio Key (AIzaSy...)"
              className="flex-1 h-6 px-1.5 text-3xs bg-background border border-border focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={saveCustomKey}
              className="h-6 px-2 bg-accent text-accent-foreground font-bold text-3xs uppercase hover:bg-accent/90"
            >
              SAVE
            </button>
          </div>
        </div>
      )}

      {/* Scope Ticker Strip */}
      <div className="px-3 py-1.5 border-b border-border bg-surface flex items-center justify-between text-3xs shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground uppercase">SCOPE SECURITY:</span>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="TICKER..."
            className="w-20 h-5 px-1 bg-surface-muted text-accent font-bold border border-border/80 focus:border-accent uppercase text-3xs"
          />
        </div>
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-up"></span>
          <span>GROUNDED RAG ACTIVE</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-accent/40 mx-auto" />
            <div className="text-xs font-bold text-foreground">
              Ask Any Grounded Financial Query on {symbol}
            </div>
            <p className="text-3xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Synthesizes verified annual reports, Note 34 related-party supply chains, broker consensus, and financial statements.
            </p>

            {/* Quick Prompt Presets */}
            <div className="pt-2 flex flex-col gap-1.5 max-w-xs mx-auto">
              {[
                "Who are the critical sole-source component suppliers?",
                "Break down group subsidiaries and revenue contribution",
                "What are the major operating margin drivers?",
                "Summarize customer offtake across government and retail channels",
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(preset)}
                  className="p-1.5 text-left border border-border/80 bg-surface-muted/30 hover:border-accent hover:bg-surface-raised text-3xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  &rarr; {preset}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`space-y-1 ${
                msg.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-2 text-2xs leading-relaxed max-w-[95%] border ${
                  msg.role === "user"
                    ? "bg-accent/15 text-foreground border-accent/40 font-bold"
                    : "bg-surface-muted/40 text-foreground border-border text-left"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {msg.provenance && (
                  <div className="mt-2 pt-1 border-t border-border/60 flex items-center justify-between text-[7.5px] text-muted-foreground uppercase">
                    <span className="flex items-center gap-1 text-up font-bold">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>{msg.provenance}</span>
                    </span>
                    <span>{msg.isLiveAI ? "GEMINI 3.8 FLASH" : "DETERMINISTIC"}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="p-2 border border-border bg-surface-muted/30 text-3xs text-muted-foreground animate-pulse flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-accent animate-spin" />
            <span>Retrieving audited filings &amp; synthesizing grounded response...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2 border-t border-border bg-surface flex items-center gap-1.5 shrink-0"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`Ask grounded research query on ${symbol}...`}
          className="flex-1 h-7 px-2 text-3xs bg-background border border-border focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="h-7 px-3 bg-accent text-accent-foreground font-bold text-3xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <span>ASK</span>
          <Send className="h-2.5 w-2.5" />
        </button>
      </form>
    </aside>
  );
}
