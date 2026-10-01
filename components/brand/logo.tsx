import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The Arthdex mark.
 *
 * The letter A is built as a price peak. Its crossbar is a small rising trend line, and the
 * apex is a data point. A thin bar runs across the top, the way the shirorekha (headline)
 * does over Devanagari, nodding to अर्थ (arth): meaning, purpose, wealth.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} role="img" aria-label="Arthdex">
      <defs>
        <linearGradient id={`${id}-bg`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(var(--accent))" />
          <stop offset="1" stopColor="hsl(var(--accent) / 0.55)" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-bg)`} />
      <rect width="32" height="32" rx="9" fill={`url(#${id}-shine)`} />
      <g fill="none" stroke="hsl(var(--accent-foreground))" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 6H25" strokeWidth="1.5" strokeOpacity="0.55" />
        <path d="M8.4 25.6 16 9.6l7.6 16" strokeWidth="2.8" />
        <path d="m10.9 20.6 3.6-2.3 2.1 1.5 2.7-3.3" strokeWidth="2" />
      </g>
      <circle cx="16" cy="9.6" r="1.9" fill="hsl(var(--accent-foreground))" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold leading-none tracking-[-0.035em]", className)}>
      Arth<span className="text-gradient">dex</span>
    </span>
  );
}

/** Mark + wordmark, with the Devanagari line under it when there is room. */
export function Logo({ tagline = true, full = false, className }: { tagline?: boolean; full?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col justify-center gap-[3px]">
        <Wordmark className="text-[1.0625rem]" />
        {tagline ? (
          <span lang="sa" className="font-deva text-[0.625rem] leading-none tracking-[0.12em] text-muted-foreground">
            अर्थ <span className={cn("text-muted-foreground/60", full ? "inline" : "hidden 2xl:inline")}>· meaning, purpose, wealth</span>
          </span>
        ) : null}
      </span>
    </span>
  );
}
