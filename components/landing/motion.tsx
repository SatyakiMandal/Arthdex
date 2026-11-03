import { cn } from "@/lib/utils";

/*
 * Scroll reveals, done in CSS rather than JavaScript.
 *
 * The `.reveal` class (globals.css) runs a short fade-and-rise on a scroll-driven
 * timeline (`animation-timeline: view()`). Content is visible by default: a browser
 * without scroll timelines, a reader who prefers reduced motion, a slow device or a
 * page that never hydrates all get the finished layout instead of a blank section.
 * These are server components, so no animation library ships with them.
 */

/** Fades and lifts its children in as they scroll into view. */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  /** Kept for call-site compatibility; a scroll-driven reveal has no clock to delay. */
  delay?: number;
  className?: string;
}) {
  return <div className={cn("reveal", className)}>{children}</div>;
}

/** Container for StaggerItems; each item reveals on its own position, which reads as a stagger. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string; gap?: number }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("reveal", className)}>{children}</div>;
}

/** Formerly a cursor-tracking glow; now a plain positioned surface. */
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative", className)}>{children}</div>;
}
