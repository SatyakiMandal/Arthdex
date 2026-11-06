"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { MotionProvider } from "./motion-provider";
import { AlertRunner } from "@/components/alerts/alert-runner";
import { GlobalTerminalShortcuts } from "@/components/layout/global-terminal-shortcuts";
import { LocaleProvider } from "@/lib/i18n";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LocaleProvider>
        <MotionProvider>
          {children}
          <AlertRunner />
          <GlobalTerminalShortcuts />
        </MotionProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
