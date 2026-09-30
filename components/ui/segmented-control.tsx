"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

/**
 * Pill selector with a shared layoutId so the active indicator slides between
 * options rather than popping. `layoutGroupId` must be unique per instance,
 * otherwise two controls on the same page animate into each other.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutGroupId,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
  layoutGroupId: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5", className)}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative rounded-md px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutGroupId}
                className="absolute inset-0 rounded-md border border-border bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
