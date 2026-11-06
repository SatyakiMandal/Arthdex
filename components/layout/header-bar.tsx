"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CandlestickChart,
  ChevronDown,
  Coins,
  FileBarChart,
  FlaskConical,
  Gauge,
  Layers,
  LineChart,
  Menu,
  Network,
  Newspaper,
  Radio,
  Rocket,
  ScanSearch,
  ShieldAlert,
  Sigma,
  Sparkles,
  Star,
  Sunrise,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { UniversalSearch } from "@/components/search/universal-search";
import { TerminalCommandBar } from "@/components/terminal/terminal-command-bar";
import { HeaderActions } from "./header-actions";
import { useLocale, getLocalizedNavGroups, NavGroup } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const UNDERLINE = { type: "spring", stiffness: 500, damping: 40 } as const;

function GroupMenu({ group, pathname, open, onOpen, onClose }: { group: NavGroup; pathname: string; open: boolean; onOpen: () => void; onClose: () => void }) {
  const active = group.items.some((i) => isActive(pathname, i.href));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Hover intent: open after a short pause and close after a longer one, so passing the cursor over does nothing
  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onOpen, 90);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onClose, 160);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          "relative inline-flex items-center gap-1 whitespace-nowrap px-3 text-sm transition-colors",
          active || open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          active && "font-medium",
        )}
      >
        {group.label}
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        {active ? <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-px h-0.5 bg-gold" transition={UNDERLINE} /> : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 pt-2"
          >
            <div className="grid w-[38rem] grid-cols-[11rem_1fr] overflow-hidden rounded-none border border-border bg-surface-raised shadow-xl">
              <div className="border-r border-border bg-surface-muted/60 p-4">
                <span className="block h-px w-6 bg-gold" aria-hidden />
                <p className="mt-3 font-display text-lg font-semibold leading-tight">{group.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{group.blurb}</p>
              </div>
              <ul className="grid grid-cols-2 content-start gap-0.5 p-2">
                {group.items.map((m) => {
                  const Icon = m.icon;
                  const here = isActive(pathname, m.href);
                  return (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        onClick={onClose}
                        aria-current={here ? "page" : undefined}
                        className={cn("group flex items-start gap-2.5 rounded-none px-2.5 py-2 transition-colors hover:bg-surface-muted", here && "bg-surface-muted")}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-2xs leading-snug text-muted-foreground">{m.hint}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function HeaderBar() {
  const { locale, dict, meta } = useLocale();
  const groups = useMemo(() => getLocalizedNavGroups(locale, dict), [locale, dict]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);

  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setMobileOpen(false);
    setOpenGroup(null);
  }

  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenGroup(null);
    const onDown = (e: MouseEvent) => !navRef.current?.contains(e.target as Node) && setOpenGroup(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openGroup]);

  return (
    <div className="chrome border-b border-border">
      <div className="flex h-12 w-full items-stretch gap-2 px-2 sm:gap-3 sm:px-3 lg:px-4">
        <Link href="/" className="flex shrink-0 items-center">
          <Logo />
        </Link>

        <nav ref={navRef} aria-label="Primary" className="relative ml-4 hidden items-stretch lg:flex">
          {groups.map((g) => (
            <GroupMenu
              key={g.key}
              group={g}
              pathname={pathname}
              open={openGroup === g.key}
              onOpen={() => setOpenGroup(g.key)}
              onClose={() => setOpenGroup((v) => (v === g.key ? null : v))}
            />
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 sm:gap-2 sm:pl-4">
          <TerminalCommandBar className="hidden sm:block w-48 md:w-64 lg:w-80" />
          <UniversalSearch className="hidden xl:block" placeholder={dict.commands.searchPlaceholder} />
          <HeaderActions />

          {/* Regional Numbering Scale Indicator (M30) */}
          <div
            className="hidden md:inline-flex items-center gap-1.5 h-9 px-2 border border-border bg-surface-muted/60 font-mono text-2xs select-none transition-colors"
            title={`Active Numbering System: 1 ${meta.lakhScale} (100K) / 1 ${meta.croreScale} (10M)`}
          >
            <span className="text-accent font-bold">₹</span>
            <span className="font-sans font-semibold text-foreground text-xs">{meta.lakhScale}</span>
            <span className="text-muted-foreground/60">/</span>
            <span className="font-sans font-semibold text-foreground text-xs">{meta.croreScale}</span>
          </div>

          <LanguageToggle />
          <ThemeToggle />
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mobileOpen ? (
          <motion.nav
            aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-border lg:hidden"
          >
            <div className="p-3">
              <UniversalSearch className="mb-3" placeholder={dict.commands.searchPlaceholder} />
              {groups.map((g) => (
                <div key={g.key} className="mb-3">
                  <p className="px-2 pb-1 text-2xs font-medium text-muted-foreground">{g.label}</p>
                  <div className="grid grid-cols-2 gap-0.5">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const here = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-none px-2 py-2 text-sm transition-colors duration-150",
                            here ? "bg-surface-muted font-medium text-foreground" : "text-foreground/80 hover:bg-surface-muted",
                          )}
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

