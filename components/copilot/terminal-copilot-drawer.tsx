"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  X,
  Send,
  ShieldAlert,
  Key,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Lock,
  Minus,
  Maximize2,
  Minimize2,
  GripHorizontal,
  Copy,
  Check,
  TrendingUp,
  Activity,
  ShieldCheck,
  Globe2,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FinancialRole,
  FINANCIAL_ROLES,
  CORE_INSTITUTIONAL_CHIPS,
  getStockDossier,
  generateDeterministicSynthesis,
  StockDossier,
} from "@/lib/copilot/quant-synthesis";

interface TerminalCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string | null;
  initialPrompt?: string;
}

interface Message {
  id: string;
  role: "user" | "copilot";
  text: string;
  title?: string;
  provenance?: string;
  sourceCitations?: string[];
  isLiveAI?: boolean;
  timestamp: string;
}

const BYOK_STORAGE_KEY = "arthdex:gemini_key:v1";
const MODE_STORAGE_KEY = "arthdex:copilot_mode:v1";
const ROLE_STORAGE_KEY = "arthdex:copilot_role:v1";

function generateMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getFormattedNow(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function TerminalCopilotDrawer({
  isOpen,
  onClose,
  defaultSymbol = "RELIANCE",
  initialPrompt = "",
}: TerminalCopilotDrawerProps) {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [symbol, setSymbol] = useState(defaultSymbol || "RELIANCE");
  const [activeRole, setActiveRole] = useState<FinancialRole>("equity_analyst");
  const [mode, setMode] = useState<"GEMINI" | "DETERMINISTIC">("DETERMINISTIC");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [byokKey, setByokKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Floating Window State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Active dossier for the selected symbol
  const dossier: StockDossier = getStockDossier(symbol);

  // Extract symbol from current pathname if user is browsing a stock page
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/company\/([a-zA-Z0-9_&]+)/i);
      if (match && match[1]) {
        const pathSym = decodeURIComponent(match[1]).toUpperCase();
        queueMicrotask(() => {
          setSymbol(pathSym);
        });
      }
    }
  }, [pathname]);

  // Load saved preferences from localStorage
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedKey = localStorage.getItem(BYOK_STORAGE_KEY);
        if (storedKey) {
          setSavedKey(storedKey);
          setByokKey(storedKey);
        }

        const storedMode = localStorage.getItem(MODE_STORAGE_KEY) as "GEMINI" | "DETERMINISTIC" | null;
        if (storedMode === "GEMINI" || storedMode === "DETERMINISTIC") {
          setMode(storedMode);
        }

        const storedRole = localStorage.getItem(ROLE_STORAGE_KEY) as FinancialRole | null;
        if (storedRole && FINANCIAL_ROLES.some((r) => r.id === storedRole)) {
          setActiveRole(storedRole);
        }
      } catch {
        // Ignore storage errors in restricted contexts
      }
    });
  }, []);

  // Set default floating position (top-16, right-8)
  useEffect(() => {
    if (typeof window === "undefined" || position) return;
    const initialX = Math.max(16, window.innerWidth - 760 - 32);
    const initialY = 64; // top-16 in standard rem
    queueMicrotask(() => {
      setPosition({ x: initialX, y: initialY });
    });
  }, [position]);

  useEffect(() => {
    if (defaultSymbol) {
      queueMicrotask(() => {
        setSymbol(defaultSymbol);
      });
    }
  }, [defaultSymbol]);

  useEffect(() => {
    if (initialPrompt) {
      queueMicrotask(() => {
        setPrompt(initialPrompt);
      });
    }
  }, [initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle Dragging
  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse click only
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select") || target.closest("a")) {
      return;
    }
    if (isMaximized) return;

    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const onMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const currentWidth = isMinimized ? 380 : 760;
      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - Math.min(currentWidth, window.innerWidth - 16));
      const minY = 8;
      const maxY = Math.max(minY, window.innerHeight - 44);

      const nextX = Math.max(minX, Math.min(maxX, ev.clientX - offsetX));
      const nextY = Math.max(minY, Math.min(maxY, ev.clientY - offsetY));

      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleModeChange = (newMode: "GEMINI" | "DETERMINISTIC") => {
    setMode(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // Ignore
    }
  };

  const handleRoleChange = (newRole: FinancialRole) => {
    setActiveRole(newRole);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, newRole);
    } catch {
      // Ignore
    }
  };

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
      // Ignore
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  const handleSend = async (queryText?: string) => {
    const q = (queryText || prompt).trim();
    if (!q || isLoading) return;

    const msgId = generateMsgId("msg");
    const userMsg: Message = {
      id: generateMsgId("user"),
      role: "user",
      text: q,
      timestamp: getFormattedNow(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setIsLoading(true);

    // If mode is DETERMINISTIC, or if external fetch fails, we have full client-side algorithmic coverage
    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          symbol,
          byokKey: savedKey || undefined,
          mode,
          role: activeRole,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            role: "copilot",
            text: data.response,
            title: data.title,
            provenance: data.provenance,
            sourceCitations: data.sourceCitations,
            isLiveAI: data.isLiveAI,
            timestamp: getFormattedNow(),
          },
        ]);
      } else {
        throw new Error(data.error || "Malformed response payload");
      }
    } catch {
      // Resilient Client-Side Deterministic Quant Fallback
      const fallback = generateDeterministicSynthesis(q, symbol, activeRole);
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          role: "copilot",
          text: fallback.markdown,
          title: fallback.title,
          provenance: fallback.provenance,
          sourceCitations: fallback.sourceCitations,
          isLiveAI: false,
          timestamp: getFormattedNow(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!isOpen) return null;

  const currentRoleMeta = FINANCIAL_ROLES.find((r) => r.id === activeRole) || FINANCIAL_ROLES[0];

  return (
    <div
      ref={windowRef}
      style={
        isMaximized
          ? undefined
          : position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : { right: "32px", top: "64px" }
      }
      className={cn(
        "fixed z-50 bg-surface border-2 border-border shadow-[0_20px_50px_rgba(0,0,0,0.55)] flex flex-col font-mono text-2xs overflow-hidden transition-all duration-150",
        isMaximized
          ? "top-3 left-3 right-3 bottom-3 w-auto h-auto"
          : isMinimized
          ? "w-[440px] h-10 select-none"
          : "w-[760px] min-w-[680px] max-w-[96vw] h-[640px] max-h-[88vh]"
      )}
    >
      {/* Title Bar (Draggable) */}
      <div
        onMouseDown={handleTitleBarMouseDown}
        className={cn(
          "flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-muted/90 shrink-0 select-none cursor-move",
          isMinimized && "border-b-0"
        )}
      >
        {/* Left: Drag Handle & Title */}
        <div className="flex items-center gap-2">
          <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-accent p-0.5" title="Drag Cockpit Window">
            <GripHorizontal className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
            <span className="font-bold text-xs uppercase text-foreground tracking-wider">
              ARTHDEX RESEARCH COPILOT (M24)
            </span>
          </div>
          {isMinimized && (
            <span className="px-1.5 py-0.5 bg-accent/15 text-accent text-3xs font-bold border border-accent/30 uppercase">
              {symbol}
            </span>
          )}
        </div>

        {/* Right: Controls & Mode Switcher */}
        <div className="flex items-center gap-1.5">
          {!isMinimized && (
            <>
              {/* Dual Engine Toggle Switch */}
              <div className="flex items-center bg-background/80 border border-border p-0.5 text-3xs font-bold">
                <button
                  type="button"
                  onClick={() => handleModeChange("GEMINI")}
                  className={cn(
                    "px-2 py-0.5 uppercase transition-all flex items-center gap-1",
                    mode === "GEMINI"
                      ? "bg-accent text-accent-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Gemini 3.8 Flash Generative Agentic Model"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>GEMINI 3.8 FLASH</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("DETERMINISTIC")}
                  className={cn(
                    "px-2 py-0.5 uppercase transition-all flex items-center gap-1",
                    mode === "DETERMINISTIC"
                      ? "bg-gold text-black shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Deterministic Quant Rules (Zero API Quota / Guaranteed Uptime)"
                >
                  <Activity className="h-2.5 w-2.5" />
                  <span>QUANT RULES (OFFLINE)</span>
                </button>
              </div>

              {/* BYOK Key Settings */}
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "p-1 border border-border/70 hover:border-accent hover:text-accent transition-colors",
                  savedKey ? "text-accent bg-accent/10 border-accent/40" : "text-muted-foreground bg-surface"
                )}
                title="Configure Google Gemini API Key (BYOK)"
              >
                <Key className="h-3 w-3" />
              </button>
            </>
          )}

          {/* Window Controls: Minimize, Maximize, Close */}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-transparent hover:border-border transition-colors"
            title={isMinimized ? "Restore Cockpit" : "Minimize to Title Bar"}
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMaximized(!isMaximized);
              setIsMinimized(false);
            }}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-raised border border-transparent hover:border-border transition-colors"
            title={isMaximized ? "Restore Window" : "Full Screen Window"}
          >
            {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30 transition-colors"
            title="Close Copilot (Esc)"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Window Content (Hidden when minimized) */}
      {!isMinimized && (
        <>
          {/* Mandatory SEBI Non-Advisory Compliance Banner */}
          <div className="px-3 py-1 bg-surface-muted/70 border-b border-border/80 text-[8px] text-muted-foreground leading-normal shrink-0 flex items-start gap-1.5">
            <ShieldAlert className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-foreground">REGULATORY DISCLOSURE: </span>
              Arthdex Terminal Copilot is an educational research synthesis engine. Arthdex is NOT a SEBI-registered Investment Adviser or Research Analyst. All outputs are derived algorithmically from public filings. No buy/sell advice provided.
            </div>
          </div>

          {/* Settings Panel (BYOK Key Drawer) */}
          {showSettings && (
            <div className="p-3 bg-surface border-b border-border space-y-2 animate-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between text-3xs font-bold text-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-accent" />
                  <span>COPILOT ACCESS &amp; PRIVATE API KEY CONFIGURATION</span>
                </span>
                <span
                  className={cn(
                    "text-[8px] px-1.5 py-0.5 font-bold uppercase border",
                    savedKey
                      ? "bg-up/10 text-up border-up/30"
                      : "bg-surface-muted text-muted-foreground border-border"
                  )}
                >
                  {savedKey ? "CUSTOM KEY ARMED" : "PLATFORM / DETERMINISTIC MODE"}
                </span>
              </div>
              <p className="text-3xs text-muted-foreground">
                Enter your Google Gemini API Key from Google AI Studio to unlock private live inference without terminal rate limits. Keys are stored locally in your browser storage and never logged on our servers.
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="password"
                  value={byokKey}
                  onChange={(e) => setByokKey(e.target.value)}
                  placeholder="Paste Google AI Studio Key (AIzaSy...)"
                  className="flex-1 h-6 px-1.5 text-3xs bg-background border border-border focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={saveCustomKey}
                  className="h-6 px-2.5 bg-accent text-accent-foreground font-bold text-3xs uppercase hover:bg-accent/90 transition-colors"
                >
                  SAVE KEY
                </button>
              </div>
            </div>
          )}

          {/* Active Stock Dossier Bar */}
          <div className="px-3 py-1.5 border-b border-border bg-surface-muted/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Left: Security Selector Input */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground uppercase text-3xs font-bold">SCOPE SECURITY:</span>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="TICKER..."
                className="w-24 h-5 px-1.5 bg-surface text-accent font-bold border border-border/80 focus:border-accent uppercase text-3xs"
              />
            </div>

            {/* Center/Right: Instant Financial Dossier Summary Badge */}
            <div className="flex items-center gap-2">
              <div
                className="px-2 py-0.5 bg-surface border border-border text-3xs text-foreground font-bold flex items-center gap-1.5 shadow-sm"
                title={`${dossier.name} · ${dossier.sector}`}
              >
                <span className="text-accent">{dossier.symbol}</span>
                <span className="text-muted-foreground">·</span>
                <span>{dossier.cmp}</span>
                <span className={dossier.isPositive ? "text-up" : "text-down"}>
                  ({dossier.change})
                </span>
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground font-normal">P/E:</span>
                <span>{dossier.pe}</span>
                <span className="text-muted-foreground font-normal">|</span>
                <span className="text-muted-foreground font-normal">EV/EBITDA:</span>
                <span>{dossier.evEbitda}</span>
                <span className="text-muted-foreground font-normal">|</span>
                <span className="text-muted-foreground font-normal">ROE:</span>
                <span>{dossier.roe}</span>
                <span className="text-muted-foreground font-normal">|</span>
                <span className="text-muted-foreground font-normal">Beta:</span>
                <span>{dossier.beta}</span>
              </div>
              <span className="hidden sm:inline-block px-1 py-0.5 bg-surface-muted text-[7.5px] font-bold text-muted-foreground border border-border uppercase">
                ACTUAL FILING
              </span>
            </div>
          </div>

          {/* Financial Role Selector Bar */}
          <div className="px-3 py-1.5 border-b border-border bg-surface shrink-0 space-y-1">
            <div className="flex items-center justify-between text-3xs text-muted-foreground">
              <span className="font-bold uppercase tracking-wider text-foreground">
                SELECT FINANCIAL ANALYST ROLE:
              </span>
              <span className="text-[8px] text-muted-foreground italic truncate max-w-[340px]">
                {currentRoleMeta.tagline}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {FINANCIAL_ROLES.map((roleDef) => {
                const isSelected = activeRole === roleDef.id;
                return (
                  <button
                    key={roleDef.id}
                    type="button"
                    onClick={() => handleRoleChange(roleDef.id)}
                    className={cn(
                      "px-2 py-1 text-center border truncate transition-all text-3xs font-bold uppercase",
                      isSelected
                        ? "bg-accent text-accent-foreground border-accent shadow-sm"
                        : "bg-surface-muted/50 text-muted-foreground border-border/80 hover:text-foreground hover:border-foreground/50 hover:bg-surface-raised"
                    )}
                  >
                    [{roleDef.label}]
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1-Click Pre-loaded Institutional Prompt Chips */}
          <div className="px-3 py-1.5 border-b border-border bg-surface-muted/30 shrink-0">
            <div className="text-[8px] font-bold text-muted-foreground uppercase mb-1 flex items-center justify-between">
              <span>INSTITUTIONAL 1-CLICK PROMPT SUITE:</span>
              <span className="text-accent/90">CLICK ANY CHIP TO RUN ANALYSIS</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {CORE_INSTITUTIONAL_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(chip)}
                  disabled={isLoading}
                  className="px-2 py-0.5 text-3xs border border-border/90 bg-surface hover:border-accent hover:bg-surface-raised text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 text-left"
                >
                  &rarr; {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/50">
            {messages.length === 0 ? (
              <div className="py-6 text-center space-y-3">
                <div className="inline-block p-3 bg-surface border border-border rounded-full shadow-sm">
                  <Sparkles className="h-6 w-6 text-accent animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Institutional Terminal Cockpit: {dossier.name} ({symbol})
                  </div>
                  <p className="text-3xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Zero-speculation analytical cockpit powered by Ind AS audited filings, Note 34 supply chain disclosures, and deterministic quant models.
                  </p>
                </div>

                {/* Role Specific Recommended Quick Actions */}
                <div className="pt-2 max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-left">
                  {currentRoleMeta.chips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(chip)}
                      className="p-2 border border-border bg-surface hover:border-accent hover:bg-surface-raised transition-all group"
                    >
                      <div className="text-3xs font-bold text-foreground group-hover:text-accent flex items-center justify-between">
                        <span>{chip}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-[7.5px] text-muted-foreground mt-0.5">
                        Run verified quant model on {symbol}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Provenance Tier Legend */}
                <div className="pt-3 border-t border-border/40 max-w-md mx-auto flex items-center justify-around text-[7.5px] text-muted-foreground uppercase">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-up rounded-full"></span>
                    <span>[ACTUAL FILING] Audited Disclosures</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
                    <span>[MODELLED] Algorithmic Formulas</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                    <span>[CONSENSUS] Analyst Estimates</span>
                  </span>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("space-y-1", msg.role === "user" ? "text-right" : "text-left")}
                >
                  <div
                    className={cn(
                      "inline-block p-3 text-2xs leading-relaxed max-w-[96%] border text-left",
                      msg.role === "user"
                        ? "bg-accent/15 text-foreground border-accent/40 font-bold"
                        : "bg-surface text-foreground border-border shadow-sm"
                    )}
                  >
                    {/* Header if present */}
                    {msg.title && (
                      <div className="font-bold text-xs uppercase text-accent border-b border-border/80 pb-1 mb-2">
                        {msg.title}
                      </div>
                    )}

                    {/* Formatted Markdown Content */}
                    <div className="whitespace-pre-wrap font-mono text-2xs space-y-2">
                      <CopilotTextRenderer text={msg.text} />
                    </div>

                    {/* Provenance & Citation Footer for Copilot Messages */}
                    {msg.role === "copilot" && (
                      <div className="mt-3 pt-2 border-t border-border/70 flex flex-wrap items-center justify-between gap-1.5 text-[7.5px] text-muted-foreground uppercase">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-up font-bold">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>{msg.provenance || "ACTUAL FILING & QUANT RULES"}</span>
                          </span>
                          <span className="px-1 py-0.2 bg-surface-muted border border-border">
                            {msg.isLiveAI ? "GEMINI 3.8 FLASH" : "DETERMINISTIC QUANT ENGINE"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.text, msg.id)}
                            className="flex items-center gap-0.5 hover:text-foreground text-muted-foreground p-0.5 transition-colors"
                            title="Copy Markdown Analysis"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-up" />
                                <span className="text-up font-bold">COPIED</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>COPY</span>
                              </>
                            )}
                          </button>
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="p-3 border border-border bg-surface text-3xs text-muted-foreground animate-pulse flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent animate-spin" />
                  <span>
                    {mode === "GEMINI"
                      ? "Executing Gemini 3.8 Flash grounded inference with audited filings..."
                      : "Calculating deterministic quantitative matrices & DuPont decomposition..."}
                  </span>
                </div>
                <span className="text-[7.5px] px-1 bg-accent/20 text-accent font-bold uppercase">
                  {mode}
                </span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Bottom Prompt Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2 border-t border-border bg-surface flex items-center gap-1.5 shrink-0"
          >
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="h-7 px-2 border border-border text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors text-3xs"
                title="Reset conversation"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ask grounded institutional research on ${symbol} (or select prompt chip above)...`}
              className="flex-1 h-7 px-2 text-3xs bg-background border border-border focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || isLoading}
              className="h-7 px-3 bg-accent text-accent-foreground font-bold text-3xs uppercase hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <span>RUN</span>
              <Send className="h-2.5 w-2.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

/**
 * Enhanced Monospace Text Renderer for Copilot Financial Dossiers
 * Handles markdown tables, blockquotes, math syntax, and provenance badges.
 */
function CopilotTextRenderer({ text }: { text: string }) {
  // Replace provenance markers with styled badges
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Render Markdown Table Row
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
          // If header separator row | :--- | :--- |
          if (trimmed.includes("---")) {
            return <div key={idx} className="border-b border-border/80 my-1" />;
          }

          const cells = trimmed
            .split("|")
            .filter((_, i, arr) => i > 0 && i < arr.length - 1)
            .map((c) => c.trim());

          return (
            <div
              key={idx}
              className="grid grid-flow-col auto-cols-fr gap-2 py-0.5 px-1 hover:bg-surface-muted/30 border-b border-border/30 text-3xs"
            >
              {cells.map((cell, cIdx) => (
                <div key={cIdx} className="truncate">
                  {renderFormattedInline(cell)}
                </div>
              ))}
            </div>
          );
        }

        // Render Markdown Headers
        if (trimmed.startsWith("### ")) {
          return (
            <div key={idx} className="font-bold text-foreground text-xs pt-1.5 pb-0.5 border-b border-border/60">
              {trimmed.replace("### ", "")}
            </div>
          );
        }
        if (trimmed.startsWith("#### ")) {
          return (
            <div key={idx} className="font-bold text-accent text-3xs pt-1 uppercase tracking-wide">
              {trimmed.replace("#### ", "")}
            </div>
          );
        }

        // Render Blockquotes / Disclaimers
        if (trimmed.startsWith("> ")) {
          return (
            <div
              key={idx}
              className="p-1.5 bg-amber-500/10 border-l-2 border-amber-500 text-[8px] text-muted-foreground leading-normal"
            >
              {renderFormattedInline(trimmed.replace("> ", ""))}
            </div>
          );
        }

        // Render Horizontal Rules
        if (trimmed === "---") {
          return <div key={idx} className="border-b border-border/80 my-1.5" />;
        }

        // Render Bullet Points
        if (trimmed.startsWith("- ")) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5 text-2xs leading-relaxed">
              <span className="text-accent shrink-0">&bull;</span>
              <div>{renderFormattedInline(trimmed.replace("- ", ""))}</div>
            </div>
          );
        }

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Standard Paragraph
        return (
          <div key={idx} className="leading-relaxed">
            {renderFormattedInline(trimmed)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Highlights provenance badges like [ACTUAL FILING], [MODELLED], [CONSENSUS]
 */
function renderFormattedInline(content: string) {
  // Regex to detect provenance tokens and bold text
  const parts = content.split(/(\[[^\]]+\]|\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (!part) return null;

    if (part === "[ACTUAL FILING]" || part.includes("ACTUAL FILING")) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.2 mx-0.5 rounded text-[7.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase"
        >
          {part.replace(/[[\]`]/g, "")}
        </span>
      );
    }

    if (part === "[MODELLED / ALGORITHMIC]" || part.includes("MODELLED")) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.2 mx-0.5 rounded text-[7.5px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 uppercase"
        >
          {part.replace(/[[\]`]/g, "")}
        </span>
      );
    }

    if (part === "[CONSENSUS ESTIMATE]" || part.includes("CONSENSUS")) {
      return (
        <span
          key={i}
          className="inline-block px-1 py-0.2 mx-0.5 rounded text-[7.5px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase"
        >
          {part.replace(/[[\]`]/g, "")}
        </span>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="text-foreground font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="px-1 py-0.2 bg-surface-muted text-foreground border border-border text-[8px]">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <span key={i}>{part}</span>;
  });
}
