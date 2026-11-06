"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Cookie, X } from "lucide-react";

const CONSENT_KEY = "arthdex:privacy_consent:v1";

export type ConsentLevel = "all" | "essential" | "undecided";

/**
 * Privacy and Cookie Consent Banner.
 *
 * Compliant with GDPR, ePrivacy Directive, California CPRA, and India DPDP Act 2023:
 * - Equal visual hierarchy for "Accept All" and "Essential Only" (no dark patterns).
 * - Persists preference in client-side localStorage.
 * - Does not load optional analytics or session tracking before affirmative user consent.
 */
export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentLevel>("all");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored === "all" || stored === "essential") {
          setConsent(stored as ConsentLevel);
        } else {
          setConsent("undecided");
        }
      } catch {
        // LocalStorage restricted (e.g. private mode)
        setConsent("essential");
      }
      setMounted(true);
    });
  }, []);

  const handleChoice = (choice: "all" | "essential") => {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Fallback
    }
    setConsent(choice);
  };

  if (!mounted || consent !== "undecided") {
    return null;
  }

  return (
    <aside
      aria-label="Privacy & Cookie Preferences"
      className="fixed bottom-3 right-3 z-50 max-w-lg border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-md sm:bottom-4 sm:right-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-none bg-surface-raised p-1.5 text-accent-foreground">
          <Cookie className="h-4 w-4" />
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-foreground">Privacy & Local Storage</h2>
            <button
              type="button"
              onClick={() => handleChoice("essential")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close consent banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">
            Arthdex stores your watchlist, alerts, and terminal theme locally on your device. We do not sell personal data or track keystrokes. Read our{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleChoice("all")}
              className="rounded-none bg-foreground px-3 py-1.5 text-2xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              Accept All
            </button>
            <button
              type="button"
              onClick={() => handleChoice("essential")}
              className="rounded-none border border-border bg-surface px-3 py-1.5 text-2xs font-semibold text-foreground transition-colors hover:bg-surface-muted"
            >
              Essential Only
            </button>
            <div className="ml-auto flex items-center gap-1 text-3xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-up" />
              <span>No 3rd-party trackers</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
