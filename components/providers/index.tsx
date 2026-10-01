"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { MotionProvider } from "./motion-provider";
import { AlertRunner } from "@/components/alerts/alert-runner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionProvider>
        {children}
        <AlertRunner />
      </MotionProvider>
    </ThemeProvider>
  );
}
