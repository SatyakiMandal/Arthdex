"use client";

import { useState } from "react";
import { Bookmark, Check, X } from "lucide-react";
import { useLocalStore } from "@/lib/client/use-local-store";
import { cn } from "@/lib/utils";

interface Preset<T> {
  id: string;
  name: string;
  value: T;
}

const EMPTY: never[] = [];

/**
 * Saves the current set of filters under a name and restores it in one click.
 * Presets live in this browser's localStorage, one list per `storageKey`.
 */
export function SavedPresets<T>({
  storageKey,
  current,
  onApply,
  defaultName,
  className,
}: {
  storageKey: string;
  current: T;
  onApply: (value: T) => void;
  /** Suggested name for the preset being saved, derived from the current filters. */
  defaultName: (value: T) => string;
  className?: string;
}) {
  const [presets, setPresets, ready] = useLocalStore<Preset<T>[]>(`arthdex:presets:${storageKey}`, EMPTY as Preset<T>[]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  function save() {
    const label = name.trim() || defaultName(current);
    setPresets((prev) => [...prev, { id: crypto.randomUUID(), name: label.slice(0, 40), value: current }]);
    setName("");
    setNaming(false);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" /> Saved screens
      </span>

      {ready && presets.length === 0 && !naming ? <span className="text-2xs text-muted-foreground">None yet</span> : null}

      {presets.map((p) => (
        <span key={p.id} className="group inline-flex items-center overflow-hidden rounded-full border border-border bg-surface-muted text-xs">
          <button
            type="button"
            onClick={() => onApply(p.value)}
            className="px-3 py-1 transition-colors hover:bg-accent/10 hover:text-accent"
            title="Apply this screen"
          >
            {p.name}
          </button>
          <button
            type="button"
            aria-label={`Delete saved screen ${p.name}`}
            onClick={() => setPresets((prev) => prev.filter((x) => x.id !== p.id))}
            className="border-l border-border px-1.5 py-1 text-muted-foreground transition-colors hover:bg-down/10 hover:text-down"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {naming ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder={defaultName(current)}
            aria-label="Name for this screen"
            className="h-8 w-44 rounded-lg border border-accent/60 bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={save} aria-label="Save screen" className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground active:scale-95">
            <Check className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
        >
          Save current
        </button>
      )}
    </div>
  );
}
