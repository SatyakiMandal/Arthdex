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
            px: 1.5,
            py: 1,
            fontSize: "0.75rem",
            lineHeight: 1.45,
            fontFamily: "var(--font-sans)",
            color: "hsl(var(--foreground))",
            backgroundColor: "hsl(var(--surface-raised))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            boxShadow: "0 12px 32px -12px hsl(224 40% 2% / 0.55)",
          },
        },
        arrow: { sx: { color: "hsl(var(--surface-raised))", "&::before": { border: "1px solid hsl(var(--border))" } } },
      }}
    >
      {children}
    </Tooltip>
  );
}
