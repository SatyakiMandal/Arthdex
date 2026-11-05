"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn, deltaColor, formatINR, formatPct } from "@/lib/utils";

/**
 * Route-driven tab strip, pinned under the site header. Once the company
 * masthead has scrolled away, the symbol and price fold into the left of the
 * bar, so a reader deep in the statements still knows what they are looking at.
 */
export function CompanyTabs({
  symbol,
  price,
  action,
}: {
  symbol: string;
  /** Last price and today's percentage change, for the pinned mini quote. */
  price?: { cmp: number; percent: number } | null;
  /** Rendered flush right in the tab bar — used for the alerts trigger. */
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  // Highlight the clicked tab at once; the page behind it can take a moment to render.
  // It is remembered with the path it was clicked from, so it lapses by itself once the route changes.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const pending = clicked && clicked.from === pathname ? clicked.href : null;

  const sentinel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header.sticky");
    const node = sentinel.current;
    if (!node || !bar.current) return;
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      const offset = header?.offsetHeight ?? 0;
      if (bar.current) bar.current.style.top = `${offset}px`;
      observer?.disconnect();
      observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
        rootMargin: `-${offset}px 0px 0px 0px`,
      });
      observer.observe(node);
    };
    attach();
    const resize = header ? new ResizeObserver(attach) : null;
    if (header) resize?.observe(header);
    return () => {
      observer?.disconnect();
      resize?.disconnect();
    };
  }, []);

  const tabs = [
    { label: "Overview", href: `/company/${symbol}` },
    { label: "Statistics", href: `/company/${symbol}/statistics` },
    { label: "Analysts", href: `/company/${symbol}/analysts` },
    { label: "Statements", href: `/company/${symbol}/statements` },
    { label: "History", href: `/company/${symbol}/history` },
    { label: "Shareholders", href: `/company/${symbol}/shareholding` },
    { label: "Technicals", href: `/company/${symbol}/technicals` },
    { label: "Order flow", href: `/company/${symbol}/orderflow` },
    { label: "Research dossier", href: `/company/${symbol}/research` },
    { label: "Quant engine", href: `/company/${symbol}/quant` },
    { label: "Macro and news", href: `/company/${symbol}/macro` },
  ];

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <nav
        ref={bar}
        aria-label={`${symbol} sections`}
        className={cn("chrome sticky z-40 -mt-px border-b border-border transition-shadow", stuck && "shadow-sm")}
      >
        <div className="mx-auto flex w-full max-w-[1920px] items-center gap-1 px-2 sm:px-3 lg:px-4">
          <div
            className={cn(
              "flex shrink-0 items-baseline gap-2 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
              stuck && price ? "mr-3 max-w-[16rem] opacity-100" : "max-w-0 opacity-0",
            )}
            aria-hidden={!stuck}
          >
            <span className="font-mono text-xs font-bold text-accent">{symbol}</span>
            {price ? (
              <>
                <span className="font-mono text-xs font-semibold tabular-nums">₹{formatINR(price.cmp)}</span>
                <span className={cn("hidden font-mono text-3xs font-semibold tabular-nums sm:inline", deltaColor(price.percent))}>
                  {formatPct(price.percent)}
                </span>
              </>
            ) : null}
            <span className="ml-1 h-3.5 w-px self-center bg-border" />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
            {tabs.map((tab) => {
              const active = (pending ?? pathname) === tab.href;
              const loading = pending === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => (pathname === tab.href ? null : setClicked({ href: tab.href, from: pathname }))}
                  prefetch
                  className={cn(
                    "relative px-2.5 py-2 font-mono text-xs uppercase tracking-wider transition-colors rounded-none",
                    active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {loading ? <span className="absolute inset-x-3 bottom-0 h-0.5 animate-pulse bg-gold/60" /> : null}
                  {active ? (
                    <motion.span
                      layoutId="company-tab-underline"
                      className="absolute inset-x-3 -bottom-px h-0.5 bg-gold"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="shrink-0 py-1.5 pl-2">{action}</div>
        </div>
      </nav>
    </>
  );
}
