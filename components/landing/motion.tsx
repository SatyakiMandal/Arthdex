"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades and lifts its children in once, when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers the entrance of each direct StaggerItem. */
export function Stagger({ children, className, gap = 0.07 }: { children: React.ReactNode; className?: string; gap?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A surface whose border and fill light up under the cursor. The pointer position
 * is written straight to CSS variables, so it never re-renders React.
 */
export function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("spotlight", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - box.left}px`);
        el.style.setProperty("--my", `${e.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** A section with a soft accent glow trailing the pointer behind its content. */
export function GlowSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const glow = useRef<HTMLDivElement>(null);
  return (
    <section
      className={cn("relative", className)}
      onPointerMove={(e) => {
        const el = glow.current;
        if (!el) return;
        const box = e.currentTarget.getBoundingClientRect();
        el.style.transform = `translate(${e.clientX - box.left - 240}px, ${e.clientY - box.top - 240}px)`;
        el.style.opacity = "1";
      }}
      onPointerLeave={() => {
        if (glow.current) glow.current.style.opacity = "0";
      }}
    >
      <div
        ref={glow}
        className="pointer-events-none absolute left-0 top-0 h-[30rem] w-[30rem] rounded-full bg-accent/10 opacity-0 blur-[100px] transition-opacity duration-500 will-change-transform"
        aria-hidden
      />
      {children}
    </section>
  );
}
