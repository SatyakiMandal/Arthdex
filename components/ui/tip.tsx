"use client";

import Tooltip from "@mui/material/Tooltip";
import type { ReactElement, ReactNode } from "react";

/**
 * Material UI tooltip, restyled from the site's own colour tokens so it follows
 * the light and dark themes without a separate MUI theme provider.
 */
export function Tip({
  title,
  children,
  placement = "top",
}: {
  title: ReactNode;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}) {
  if (!title) return children;
  return (
    <Tooltip
      title={title}
      placement={placement}
      arrow
      enterDelay={150}
      enterNextDelay={80}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 280,
            px: 1.25,
            py: 0.75,
            fontSize: "0.6875rem",
            lineHeight: 1.4,
            fontFamily: "var(--font-sans)",
            color: "hsl(var(--foreground))",
            backgroundColor: "hsl(var(--surface-raised))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0px",
            boxShadow: "0 8px 24px -8px hsl(224 40% 2% / 0.7)",
          },
        },
        arrow: { sx: { color: "hsl(var(--surface-raised))", "&::before": { border: "1px solid hsl(var(--border))" } } },
      }}
    >
      {children}
    </Tooltip>
  );
}
