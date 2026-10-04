"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Bell,
  Building2,
  CalendarDays,
  CandlestickChart,
  ChevronDown,
  Coins,
  FlaskConical,
  Gauge,
  Layers,
  Menu,
  Newspaper,
  Rocket,
  ScanSearch,
  ScrollText,
  Sunrise,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UniversalSearch } from "@/components/search/universal-search";
import { HeaderActions } from "./header-actions";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Market Watch", href: "/market-watch", icon: CandlestickChart },
  { label: "Commodities", href: "/commodities", icon: Coins },
  { label: "Screener", href: "/screener", icon: ScanSearch },
  { label: "IPO", href: "/ipo", icon: Rocket },
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Unlisted", href: "/unlisted", icon: Building2 },
  { label: "Analyzer", href: "/analyzer", icon: FlaskConical },
];

/** Less frequent destinations, kept behind one menu so the bar stays on a single line. */
const MORE: { label: string; href: string; icon: LucideIcon; hint: string }[] = [
  { label: "Morning briefing", href: "/briefing", icon: Sunrise, hint: "Today in one page" },
  { label: "Bulk & block deals", href: "/deals", icon: ArrowLeftRight, hint: "Large trades disclosed today" },
  { label: "Results & actions calendar", href: "/calendar", icon: CalendarDays, hint: "Next 30 days" },
  { label: "Bhavcopy", href: "/bhavcopy", icon: Layers, hint: "End-of-day delivery data" },
  { label: "Alerts", href: "/alerts", icon: Bell, hint: "Price alerts and filings" },
  { label: "Methodology", href: "/methodology", icon: ScrollText, hint: "How figures are computed" },
  { label: "Data status", href: "/status", icon: Gauge, hint: "Feed freshness" },
];

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = MORE.some((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          active || open ? "text-accent" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
        )}
      >
        More
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 overflow-hidden rounded-xl border border-border bg-surface-raised p-1.5 shadow-xl"
          >
            {MORE.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  role="menuitem"
                  className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-muted"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors group-hover:border-accent/40 group-hover:text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.label}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{m.hint}</span>
                  </span>
                </Link>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function HeaderBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "glass-panel border-x-0 border-t-0 transition-shadow duration-300",
        scrolled && "shadow-[0_10px_30px_-18px_hsl(224_40%_2%/0.6)]",
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Arthdex home" className="group flex shrink-0 items-center">
          <Logo className="[&_img]:transition-transform [&_img]:duration-300 group-hover:[&_img]:scale-105" />
        </Link>

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/nav relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                  active ? "text-accent" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg border border-accent/25 bg-accent/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <Icon className={cn("relative hidden h-3.5 w-3.5 2xl:block", !active && "opacity-70 transition-opacity group-hover/nav:opacity-100")} />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
          <MoreMenu pathname={pathname} />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-4">
          <UniversalSearch className="hidden md:block" />
          <HeaderActions />
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border lg:hidden"
          >
            <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
              <UniversalSearch className="col-span-full mb-1" />
              {[...NAV, ...MORE].map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
