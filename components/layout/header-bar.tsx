"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Building2,
  CandlestickChart,
  Coins,
  FlaskConical,
  Layers,
  Menu,
  Newspaper,
  Rocket,
  ScanSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UniversalSearch } from "@/components/search/universal-search";
import { cn } from "@/lib/utils";

const NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Market Watch", href: "/market-watch", icon: CandlestickChart },
  { label: "Commodities", href: "/commodities", icon: Coins },
  { label: "Screener", href: "/screener", icon: ScanSearch },
  { label: "Bhavcopy", href: "/bhavcopy", icon: Layers },
  { label: "IPO", href: "/ipo", icon: Rocket },
  { label: "News", href: "/news", icon: Newspaper },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Unlisted", href: "/unlisted", icon: Building2 },
  { label: "Analyzer", href: "/analyzer", icon: FlaskConical },
];

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
          <Logo className="[&_svg]:transition-transform [&_svg]:duration-300 group-hover:[&_svg]:rotate-[-5deg] group-hover:[&_svg]:scale-105" />
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
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UniversalSearch className="hidden md:block" />
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
              {NAV.map((item) => {
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
