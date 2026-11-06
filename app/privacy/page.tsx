import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ShieldCheck, Lock, EyeOff, Server, UserCheck, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · Arthdex",
  description:
    "Privacy Policy for Arthdex detailing data handling, local storage usage, zero third-party tracking, and DPDP / GDPR / CCPA compliance.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "November 6, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="border border-border bg-surface p-6 sm:p-10">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-up" />
            <span>Legal Documentation · DPDP Act 2023 & GDPR</span>
          </div>
          <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="mt-1 text-2xs text-muted-foreground">Last updated: {lastUpdated}</p>

          <div className="mt-8 space-y-8 text-xs leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lock className="h-4 w-4 text-accent" /> 1. Overview & Commitment to Privacy
              </h2>
              <p>
                Arthdex (&quot;we&quot;, &quot;our&quot;, or &quot;the platform&quot;) operates a quantitative financial market research and analytics intelligence platform. We believe quantitative finance should be built on verifiable data, not on extracting and selling personal user data. We do not sell, rent, monetize, or broker user personal information to data brokers, ad networks, or commercial third parties.
              </p>
              <p>
                This Privacy Policy explains how information is handled in compliance with applicable data protection laws, including the Indian Digital Personal Data Protection Act (DPDP Act 2023), the EU General Data Protection Regulation (GDPR), and the California Consumer Privacy Act / California Privacy Rights Act (CCPA/CPRA).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <EyeOff className="h-4 w-4 text-accent" /> 2. Zero Keystroke Recording & Input Privacy
              </h2>
              <p>
                Unlike conventional consumer web applications, Arthdex does not run intrusive third-party session replay software (such as FullStory, LogRocket, Hotjar, or Microsoft Clarity) that captures visitor keystrokes, form fields, or screen recordings.
              </p>
              <p>
                Search queries entered into our universal search bar are processed strictly to return matching listed equity tickers, indices, or unlisted companies. Search keystrokes are never logged against personal identities or shared with third parties.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Server className="h-4 w-4 text-accent" /> 3. Data Storage & Client-Side LocalStorage
              </h2>
              <p>
                To provide instantaneous performance without requiring intrusive user tracking or cloud account profiling, Arthdex stores personalization data locally within your browser&apos;s Web Storage (`localStorage`):
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>
                  <strong className="text-foreground">Watchlist:</strong> Symbols and securities you choose to pin for continuous price monitoring.
                </li>
                <li>
                  <strong className="text-foreground">Custom Alert Rules:</strong> Numerical price thresholds and change % trigger conditions you configure.
                </li>
                <li>
                  <strong className="text-foreground">Terminal Preferences:</strong> Light/dark theme selection, UI density preferences, and audio alert toggles.
                </li>
              </ul>
              <p>
                This data resides exclusively on your device. You can clear or reset this data at any time by clearing your browser cache and cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Server className="h-4 w-4 text-accent" /> 4. Server Logs & Technical Telemetry
              </h2>
              <p>
                When you access the Arthdex platform, our reverse proxy web servers log standard transient diagnostic data: IP address, HTTP request method, requested URL path, status code, user agent, and timestamp. These logs are maintained exclusively for system security, DDoS mitigation, and operational uptime monitoring, and are rotated and deleted automatically.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCheck className="h-4 w-4 text-accent" /> 5. Age Requirement & Children&apos;s Privacy (COPPA)
              </h2>
              <p>
                Arthdex is an institutional and retail financial market analytical terminal intended strictly for individuals aged 18 years or older who possess the legal capacity to review financial data and manage market risk under the Indian Contract Act, 1872.
              </p>
              <p>
                In strict compliance with the Children&apos;s Online Privacy Protection Act (COPPA) and international standards, our platform does not knowingly collect, solicit, or maintain personal information from children under 13 years of age. If you believe an underage person has provided information, please notify our Grievance Officer immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-accent" /> 6. Your Rights Under GDPR & DPDP Act
              </h2>
              <p>
                Under the Indian DPDP Act 2023, EU GDPR, and California CPRA, you maintain fundamental statutory rights:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>Right to confirm whether personal data is being processed and access information regarding its processing.</li>
                <li>Right to correction, completion, and updating of personal data.</li>
                <li>Right to erasure of personal data that is no longer necessary for the purpose it was gathered.</li>
                <li>Right to grievance redressal through our designated officer.</li>
                <li>Right to nominate an individual in the event of death or incapacity (DPDP Section 14).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                7. Grievance Officer & Contact
              </h2>
              <p>
                In accordance with the Information Technology Act 2000 and the DPDP Act 2023, for questions or grievances regarding privacy and data protection, contact:
              </p>
              <div className="rounded-none border border-border bg-surface-muted p-4 text-foreground">
                <p className="font-semibold">Arthdex Data Grievance Cell</p>
                <p className="mt-1 text-2xs text-muted-foreground">Attention: Grievance Officer</p>
                <p className="text-2xs text-muted-foreground">Email: privacy@arthdex.com</p>
                <p className="text-2xs text-muted-foreground">Physical Address: Arthdex Quantitative Intelligence, Vasco da Gama, Goa 403802, India</p>
              </div>
            </section>

            <div className="border-t border-border pt-6 text-2xs">
              <p>
                See also:{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                ·{" "}
                <Link href="/disclaimer" className="underline hover:text-foreground">
                  SEBI Regulatory Disclaimer
                </Link>{" "}
                ·{" "}
                <Link href="/copyright" className="underline hover:text-foreground">
                  DMCA & Copyright Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
