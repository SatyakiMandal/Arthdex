"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Filter out React 19 false-positive warning for next-themes script tag injection
// which triggers the Next.js Turbopack dev error overlay
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Encountered a script tag") ||
       args[0].includes("data-new-gr-c-s-check-loaded") ||
       args[0].includes("data-gr-ext-installed") ||
       args[0].includes("A tree hydrated but some attributes of the server rendered HTML") ||
       args[0].includes("Hydration failed because the server rendered HTML didn't match"))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
