import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Arthdex · Quantitative Market Intelligence",
  description:
    "Institutional-grade Indian market intelligence: listed fundamentals, quant risk models, unlisted valuation and IPO analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
