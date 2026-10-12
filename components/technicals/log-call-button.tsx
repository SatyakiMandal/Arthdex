"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";

/** Records today's call for this stock in the track record, to be scored later against Nifty. */
export function LogCallButton({ symbol }: { symbol: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const log = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not log the call.");
      setMessage(`Logged ${body.call} at ${body.price}.`);
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not log the call.");
      setState("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={log}
        disabled={state === "busy" || state === "done"}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground disabled:opacity-60"
        title="Record today's indicator call so it can be scored against Nifty later"
      >
        {state === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
        Log this call
      </button>
      {message ? (
        <span role={state === "error" ? "alert" : "status"} className={state === "error" ? "text-2xs text-down" : "text-2xs text-muted-foreground"}>
          {message}{" "}
          {state === "done" ? (
            <Link href="/track-record" className="text-accent hover:underline">
              View track record
            </Link>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
