"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Route-driven tab strip. The active indicator is a shared `layoutId`, so it
 * slides between tabs on navigation instead of snapping.
 */
export function CompanyTabs({
  symbol,
  action,
}: {
  symbol: string;
  /** Rendered flush right in the tab bar — used for the alerts trigger. */
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  // Highlight the clicked tab at once; the page behind it can take a moment to render.
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [pathname]);

  const tabs = [
    { label: "Overview", href: `/company/${symbol}` },
    { label: "Statistics", href: `/company/${symbol}/statistics` },
    { label: "Analysts", href: `/company/${symbol}/analysts` },
    { label: "Statements", href: `/company/${symbol}/statements` },
    { label: "Historical", href: `/company/${symbol}/history` },
    { label: "Shareholders", href: `/company/${symbol}/shareholding` },
    { label: "Technicals", href: `/company/${symbol}/technicals` },
    { label: "Order Flow", href: `/company/${symbol}/orderflow` },
    { label: "Research Dossier", href: `/company/${symbol}/research` },
    { label: "Quant Engine", href: `/company/${symbol}/quant` },
    { label: "Macro & News", href: `/company/${symbol}/macro` },
  ];

  return (
    <nav className="border-b border-border bg-surface-muted/40">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto whitespace-nowrap px-4 sm:px-6">
        {tabs.map((tab) => {
          const active = (pending ?? pathname) === tab.href;
          const loading = pending === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              onClick={() => (pathname === tab.href ? null : setPending(tab.href))}
              prefetch
              className={cn(
                "relative px-3 py-2.5 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {loading ? <span className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse rounded-full bg-accent/60" /> : null}
              {active ? (
                <motion.span
                  layoutId="company-tab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : null}
            </Link>
          );
        })}

        <div className="ml-auto py-1.5">{action}</div>
      </div>
    </nav>
  );
}
