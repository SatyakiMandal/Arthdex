"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { describeRule, evaluate, useAlertRules, type AlertRule } from "@/lib/client/alert-rules";
import { fetchSnapshot } from "@/lib/client/snapshot";
import { formatINR } from "@/lib/utils";

const CHECK_MS = 60_000;

interface Toast {
  id: string;
  text: string;
}

/**
 * Checks the user's alert rules while any Arthdex page is open.
 *
 * A fired rule is marked in localStorage and shows as an unread count on the bell.
 * This runs in the browser only: nothing is delivered when every tab is closed.
 */
export function AlertRunner() {
  const { rules, setRules, ready } = useAlertRules();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const rulesRef = useRef<AlertRule[]>([]);
  rulesRef.current = rules;

  useEffect(() => {
    if (!ready) return;
    let stopped = false;

    async function check() {
      const armed = rulesRef.current.filter((r) => !r.triggeredAt);
      if (armed.length === 0 || document.hidden) return;
      const snap = await fetchSnapshot(armed.map((r) => ({ kind: r.kind, id: r.target })));
      if (!snap || stopped) return;

      const fired: { rule: AlertRule; value: number }[] = [];
      for (const rule of armed) {
        let value: number | null | undefined;
        if (rule.kind === "listed") {
          const q = snap.listed.find((x) => x.id === rule.target);
          value = rule.metric === "price" ? q?.price : q?.changePct;
        } else {
          value = snap.unlisted.find((x) => x.id === rule.target)?.price;
        }
        if (value != null && evaluate(rule, value)) fired.push({ rule, value });
      }
      if (fired.length === 0) return;

      const now = new Date().toISOString();
      setRules((prev) =>
        prev.map((r) => {
          const hit = fired.find((f) => f.rule.id === r.id);
          return hit && !r.triggeredAt ? { ...r, triggeredAt: now, triggeredValue: hit.value, seen: false } : r;
        }),
      );

      for (const { rule, value } of fired) {
        const shown = rule.metric === "price" ? `₹${formatINR(value, 2)}` : `${value.toFixed(2)}%`;
        const text = `${describeRule(rule)} (now ${shown})`;
        setToasts((t) => [...t, { id: `${rule.id}-${now}`, text }]);
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Arthdex alert", { body: text });
        }
      }
    }

    // A tab left in the background is not polled, so catch up as soon as it is visible again
    const onVisible = () => {
      if (!document.hidden) void check();
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, setRules]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((all) => all.slice(1)), 9000);
    return () => clearTimeout(t);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start gap-3 rounded-xl border border-accent/40 bg-surface-raised p-3 shadow-xl">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Alert triggered</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">{t.text}</p>
            <Link href="/alerts" className="mt-1.5 inline-block text-2xs font-medium text-accent hover:underline">
              View alerts
            </Link>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
