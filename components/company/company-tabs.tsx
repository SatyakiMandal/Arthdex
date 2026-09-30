"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const tabs = [
    { label: "Overview", href: `/company/${symbol}` },
    { label: "Quant Engine", href: `/company/${symbol}/quant` },
    { label: "Macro & News", href: `/company/${symbol}/macro` },
  ];

  return (
    <nav className="border-b border-border bg-surface-muted/40">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 px-4 sm:px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3 py-2.5 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
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
