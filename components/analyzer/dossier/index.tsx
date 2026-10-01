"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ListedSummary } from "@/types/analyzer";
import { CallTab } from "./call-tab";
import { KeyStrip } from "./key-strip";
import { SystemicTab } from "./systemic-tab";
import { TimelineTab } from "./timeline-tab";
import { ValidationTab } from "./validation-tab";
import { ValuationTab } from "./valuation-tab";
import { EventTab } from "./event-tab";
import { FinancialsTab } from "./financials-tab";
import { MacroTab } from "./macro-tab";
import { PeersTab } from "./peers-tab";
import { ReturnVolTab } from "./quant-tab";
import { RiskTab } from "./risk-tab";
import { TechnicalsTab } from "./technicals-tab";

const TABS = [
  { id: "call", label: "Call & Dossier", render: (s: ListedSummary) => <CallTab s={s} /> },
  { id: "timeline", label: "Timeline", render: (s: ListedSummary) => <TimelineTab s={s} /> },
  { id: "event", label: "Event Study", render: (s: ListedSummary) => <EventTab s={s} /> },
  { id: "tech", label: "Technicals", render: (s: ListedSummary) => <TechnicalsTab s={s} /> },
  { id: "fin", label: "Financials", render: (s: ListedSummary) => <FinancialsTab s={s} /> },
  { id: "val", label: "Valuation", render: (s: ListedSummary) => <ValuationTab s={s} /> },
  { id: "quant", label: "Return & Volatility", render: (s: ListedSummary) => <ReturnVolTab s={s} /> },
  { id: "risk", label: "Risk & XAI", render: (s: ListedSummary) => <RiskTab s={s} /> },
  { id: "sys", label: "Portfolio & Systemic", render: (s: ListedSummary) => <SystemicTab s={s} /> },
  { id: "valid", label: "Validation", render: (s: ListedSummary) => <ValidationTab s={s} /> },
  { id: "macro", label: "Nifty & Macro", render: (s: ListedSummary) => <MacroTab s={s} /> },
  { id: "peers", label: "Peer Valuations", render: (s: ListedSummary) => <PeersTab s={s} /> },
] as const;

/** The research dossier for a finished listed-company analysis. */
export function ListedDossier({ s, hideEvent = false }: { s: ListedSummary; hideEvent?: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("call");
  // The event study is the one section that needs scraped news
  const tabs = hideEvent ? TABS.filter((t) => t.id !== "event") : TABS;
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="dossier">
      <KeyStrip s={s} />
      <div role="tablist" aria-label="Research dossier sections" className="sticky top-[84px] z-30 -mx-1 mb-3 flex gap-0.5 overflow-x-auto border-b border-border bg-background/90 px-1 backdrop-blur-md">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative shrink-0 px-2.5 py-2 text-[0.8125rem] transition-colors",
              t.id === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.id === tab ? (
              <motion.span
                layoutId="dossier-tab-underline"
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_10px_hsl(var(--accent)/0.7)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
          </button>
        ))}
      </div>
      <div key={active.id} role="tabpanel" className="animate-fade-up">
        {active.render(s)}
      </div>
      {s.caveats.length > 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold tracking-tight">Caveats from the run</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {s.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
