import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Scale, CheckCircle2, AlertOctagon, Terminal, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service · Arthdex",
  description:
    "Terms of Service governing the use of Arthdex quantitative financial intelligence, models, and analytics desks.",
};

export default function TermsOfServicePage() {
  const lastUpdated = "November 6, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="border border-border bg-surface p-6 sm:p-10">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-muted-foreground">
            <Scale className="h-4 w-4 text-up" />
            <span>Legal Agreement · Terms & Conditions</span>
          </div>
          <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Terms of Service
          </h1>
          <p className="mt-1 text-2xs text-muted-foreground">Last updated: {lastUpdated}</p>

          <div className="mt-8 space-y-8 text-xs leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-accent" /> 1. Acceptance of Terms
              </h2>
              <p>
                By accessing, browsing, or utilizing the Arthdex quantitative platform (&quot;the Platform&quot;, &quot;Arthdex&quot;), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service, along with our{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/disclaimer" className="underline hover:text-foreground">
                  SEBI Regulatory Disclaimer
                </Link>.
              </p>
              <p>
                If you do not agree to these terms in their entirety, you must immediately cease accessing and using the Platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertOctagon className="h-4 w-4 text-accent" /> 2. Eligibility & Capacity
              </h2>
              <p>
                The Platform provides sophisticated mathematical, derivative, and quantitative financial models. You represent and warrant that you are at least eighteen (18) years of age, possess the legal capacity to enter into binding agreements under the Indian Contract Act, 1872, and are legally permitted to view and analyze financial market data in your jurisdiction.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Terminal className="h-4 w-4 text-accent" /> 3. Nature of Service: Research & Analytics Only
              </h2>
              <p>
                Arthdex provides quantitative tools, mathematical modeling, and public data synthesis strictly for educational, informational, and research purposes.
              </p>
              <p>
                <strong className="text-foreground">Arthdex is NOT a SEBI-registered Investment Adviser (RIA), Research Analyst (RA), Portfolio Manager, or Broker-Dealer.</strong> Nothing on the Platform constitutes an offer, solicitation, recommendation, or financial advice to buy, sell, or hold any security, derivative contract, or unlisted equity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-accent" /> 4. Acceptable Use & Platform Security
              </h2>
              <p>You agree to use the Platform strictly for lawful purposes. You shall not:</p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>Deploy automated scrapers, spiders, or bots that overload our backend data pipelines or interfere with platform availability.</li>
                <li>Attempt to bypass, defeat, or manipulate API authentication headers, rate limits, or security controls.</li>
                <li>Probe, scan, or test the vulnerability of any system, network, or data endpoint without prior written authorization.</li>
                <li>Redistribute, sub-license, repackage, or resell raw exchange or proprietary model outputs as a commercial data feed without license.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                5. Intellectual Property
              </h2>
              <p>
                All proprietary algorithms, UI terminal design, software architecture, mathematical methodologies, brand marks, and typography on Arthdex are the exclusive property of Arthdex and its licensors.
              </p>
              <p>
                Third-party exchange quotes, financial filings, and indices remain the property of their respective providers (e.g. NSE India, BSE, SEBI, Yahoo Finance, MCA).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                6. Limitation of Liability & No Warranty
              </h2>
              <p>
                THE PLATFORM, ITS QUANTITATIVE MODELS, DATA FEEDS, AND ANALYTICS ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
              </p>
              <p>
                IN NO EVENT SHALL ARTHDEX, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM TRADING LOSSES, CAPITAL LOSS, MODEL ESTIMATION DRIFT, NETWORK OUTAGES, DELAYED DATA FEEDS, OR DECISIONS MADE IN RELIANCE ON INFORMATION DISPLAYED.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                7. Governing Law & Dispute Resolution
              </h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes or claims arising out of or relating to these Terms or use of the Platform shall be subject to the exclusive jurisdiction of the competent courts in Goa, India.
              </p>
            </section>

            <div className="border-t border-border pt-6 text-2xs">
              <p>
                Related policies:{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
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
