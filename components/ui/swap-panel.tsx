"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Animated content swap for segmented controls and tab strips.
 *
 * Deliberately does NOT use `AnimatePresence mode="wait"`. That pattern holds
 * the outgoing subtree mounted until its exit animation reports completion, and
 * when the swap is triggered from a control that is itself running a `layoutId`
 * animation in the same subtree, the exit can be interrupted and never report —
 * leaving the old panel frozen mid-fade and the new one never mounted. It is a
 * hard stall, not a flicker: the UI silently shows stale data.
 *
 * Keying a single element and animating only on entry gives the same visual
 * result with no dependency on an exit callback.
 */
export function SwapPanel({
  swapKey,
  children,
  className,
}: {
  /** Changing this remounts and replays the entry animation. */
  swapKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      key={swapKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
