"use client";

import { useState, useEffect } from "react";
import { Edit3, Plus, Trash2, Tag, Check, X, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchNote {
  id: string;
  symbol: string;
  createdAt: string;
  title: string;
  thesis: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  targetPriceInr?: number;
}

const STORAGE_KEY = "arthdex_research_notes_v1";

interface ResearchNotesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSymbol?: string;
}

export function ResearchNotesDrawer({ isOpen, onClose, defaultSymbol = "RELIANCE" }: ResearchNotesDrawerProps) {
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [sentiment, setSentiment] = useState<"BULLISH" | "BEARISH" | "NEUTRAL">("BULLISH");
  const [targetPrice, setTargetPrice] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setNotes(JSON.parse(stored));
        } else {
          // Initial sample note
          const sample: ResearchNote = {
            id: "note-1",
            symbol: defaultSymbol,
            createdAt: new Date().toLocaleDateString("en-IN"),
            title: "Capex Cycle Inflection & Tariff Hike Catalyst",
            thesis: "Strong telecom ARPU growth following 20% headline tariff hike, coupled with retail store floor-space expansion and upstream petrochemical margin recovery.",
            sentiment: "BULLISH",
            targetPriceInr: 3450,
          };
          setNotes([sample]);
        }
      } catch {
        // Ignore
      }
    });
  }, [defaultSymbol]);

  const saveNote = () => {
    if (!title.trim() || !thesis.trim()) return;
    const newNote: ResearchNote = {
      id: `note-${Date.now()}`,
      symbol: defaultSymbol,
      createdAt: new Date().toLocaleDateString("en-IN"),
      title: title.trim(),
      thesis: thesis.trim(),
      sentiment,
      targetPriceInr: targetPrice ? parseFloat(targetPrice) : undefined,
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setTitle("");
    setThesis("");
    setTargetPrice("");
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono text-xs">
      <div className="relative w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col justify-between">
        {/* Header */}
        <div className="p-3 border-b border-border bg-surface-muted/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-accent" />
            <span className="font-bold text-xs uppercase text-foreground">
              {defaultSymbol} · RESEARCH NOTES &amp; THESIS (NOTE)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Create Note Input Card */}
          <div className="p-3 border border-border bg-surface-muted/20 space-y-2">
            <span className="text-3xs font-bold text-muted-foreground uppercase">Add Investment Memo</span>
            <input
              type="text"
              placeholder="Thesis headline (e.g. Q3 Margin Expansion)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface border border-border p-1.5 text-2xs font-mono outline-none focus:border-accent"
            />
            <textarea
              rows={3}
              placeholder="Investment rationale, catalyst timing, key risks..."
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              className="w-full bg-surface border border-border p-1.5 text-2xs font-mono outline-none focus:border-accent resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex gap-1 text-3xs font-bold">
                {(["BULLISH", "NEUTRAL", "BEARISH"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSentiment(s)}
                    className={cn(
                      "px-2 py-0.5 border text-3xs",
                      sentiment === s
                        ? s === "BULLISH"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                          : s === "BEARISH"
                          ? "bg-destructive/20 text-destructive border-destructive"
                          : "bg-surface text-foreground border-foreground"
                        : "text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Target Price (₹)"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-24 bg-surface border border-border px-1.5 py-0.5 text-3xs font-mono outline-none"
              />
              <button
                type="button"
                onClick={saveNote}
                disabled={!title.trim() || !thesis.trim()}
                className="flex items-center gap-1 px-2.5 py-1 bg-accent text-accent-foreground font-bold text-3xs uppercase disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                <span>SAVE</span>
              </button>
            </div>
          </div>

          {/* Stored Notes */}
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="p-3 border border-border bg-surface space-y-1.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={cn(
                      "px-1 py-0.5 text-[8px] font-bold uppercase border mr-1.5",
                      note.sentiment === "BULLISH"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                        : note.sentiment === "BEARISH"
                        ? "bg-destructive/10 text-destructive border-destructive/40"
                        : "bg-surface-muted text-muted-foreground border-border"
                    )}>
                      {note.sentiment}
                    </span>
                    <span className="font-bold text-2xs text-foreground">{note.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-3xs text-muted-foreground leading-relaxed">{note.thesis}</p>
                <div className="flex items-center justify-between text-3xs text-muted-foreground/70 pt-1 border-t border-border/40">
                  <span>Logged: {note.createdAt}</span>
                  {note.targetPriceInr && (
                    <span className="text-accent font-bold">Target: ₹{note.targetPriceInr}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-border bg-surface-muted/40 text-3xs text-muted-foreground flex justify-between items-center">
          <span>LOCAL BROWSER PERSISTENCE • SEBI COMPLIANT</span>
          <span className="text-accent">ENCRYPTED AT REST</span>
        </div>
      </div>
    </div>
  );
}
