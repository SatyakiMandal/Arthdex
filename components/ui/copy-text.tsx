"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm transition-all hover:bg-surface-muted active:scale-[0.98]";

/** Copy a prepared plain-text version of a page, or print it. */
export function CopyText({ text, label = "Copy as text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: fall back to a selectable prompt
      window.prompt("Copy this text", text);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={copy} className={BTN}>
        {copied ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : label}
      </button>
      <button type="button" onClick={() => window.print()} className={BTN}>
        <Printer className="h-3.5 w-3.5" /> Print or save PDF
      </button>
    </div>
  );
}
