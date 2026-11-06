import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { KeyboardHud } from "@/components/ui/keyboard-hud";
import { TerminalHelpDesk } from "@/components/terminal/terminal-help-desk";

export const metadata: Metadata = {
  title: "Terminal Academy & Command Directory (HELP) · Arthdex Terminal",
  description: "Complete guide on how to use Arthdex like a Bloomberg Terminal: command grammar syntax, universal mnemonic directory, keyboard shortcuts, and power-user workflows.",
};

export const revalidate = 86400; // Static guide

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2 pt-1 pb-4 sm:px-3 lg:px-4">
        <TerminalHelpDesk />
      </main>

      <KeyboardHud />
      <SiteFooter />
    </div>
  );
}
