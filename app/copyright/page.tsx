import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Copyright, Mail, AlertTriangle, ShieldCheck, FileCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "DMCA & Copyright Policy · Arthdex",
  description:
    "Designated DMCA agent information, copyright infringement takedown procedures, and repeat infringer policy for Arthdex.",
};

export default function CopyrightPolicyPage() {
  const lastUpdated = "November 6, 2026";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="border border-border bg-surface p-6 sm:p-10">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-muted-foreground">
            <Copyright className="h-4 w-4 text-up" />
            <span>Intellectual Property Protection · DMCA &amp; Indian Copyright Act 1957</span>
          </div>
          <h1 className="mt-2 font-sans text-2xl font-bold tracking-tight sm:text-3xl">
            Copyright &amp; DMCA Takedown Policy
          </h1>
          <p className="mt-1 text-2xs text-muted-foreground">Last updated: {lastUpdated}</p>

          <div className="mt-8 space-y-8 text-xs leading-relaxed text-muted-foreground">
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" /> 1. Commitment to Intellectual Property Rights
              </h2>
              <p>
                Arthdex respects the intellectual property rights of creators, content publishers, and data distributors. In accordance with the Digital Millennium Copyright Act of 1998 (17 U.S.C. § 512, &quot;DMCA&quot;) and the Indian Copyright Act, 1957, we maintain expedited procedures for receiving statutory notices of claimed infringement and addressing unauthorized content.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail className="h-4 w-4 text-accent" /> 2. Designated Copyright Agent
              </h2>
              <p>
                All notices of copyright infringement concerning content available on or through the Platform must be sent to our Designated Copyright Agent:
              </p>
              <div className="rounded-none border border-border bg-surface-muted p-4 text-foreground">
                <p className="font-semibold">Designated Copyright Agent · Arthdex Legal</p>
                <p className="mt-1 text-2xs text-muted-foreground">Attn: DMCA &amp; Copyright Compliance Officer</p>
                <p className="text-2xs text-muted-foreground">Email: copyright@arthdex.com</p>
                <p className="text-2xs text-muted-foreground">Mailing Address: Arthdex Quantitative Intelligence, Vasco da Gama, Goa 403802, India</p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileCheck className="h-4 w-4 text-accent" /> 3. Submitting a Valid DMCA Notice
              </h2>
              <p>
                To be effective under 17 U.S.C. § 512(c)(3), your written notice must include all of the following statutory elements:
              </p>
              <ol className="list-inside list-decimal space-y-1.5 pl-2">
                <li>A physical or electronic signature of a person authorized to act on behalf of the owner of the copyright that is allegedly infringed.</li>
                <li>Identification of the copyrighted work claimed to have been infringed (or a representative list if multiple works).</li>
                <li>Identification of the specific material claimed to be infringing, with precise URLs or locations on Arthdex sufficient to allow us to locate it.</li>
                <li>Contact information of the complaining party (name, address, telephone number, and email address).</li>
                <li>A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
                <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-flat" /> 4. Repeat Infringer Policy (Three-Strike Rule)
              </h2>
              <p>
                In compliance with 17 U.S.C. § 512(i)(1)(A), Arthdex maintains a strict repeat infringer policy. We will terminate, restrict, or suspend access and API privileges of any user, account, or source that has received three (3) verified, non-frivolous copyright infringement notices.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                5. Counter-Notification Procedure
              </h2>
              <p>
                If you believe material you submitted was removed or disabled by mistake or misidentification, you may send a written counter-notification to our Designated Agent containing:
              </p>
              <ul className="list-inside list-disc space-y-1.5 pl-2">
                <li>Your physical or electronic signature.</li>
                <li>Identification of the material that has been removed and its prior location.</li>
                <li>A statement under penalty of perjury that you have a good faith belief that the material was removed or disabled as a result of mistake or misidentification.</li>
                <li>Your name, address, telephone number, and consent to jurisdiction of the courts of Goa, India (or the federal judicial district for US residents).</li>
              </ul>
            </section>

            <div className="border-t border-border pt-6 text-2xs">
              <p>
                See also:{" "}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>{" "}
                ·{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                ·{" "}
                <Link href="/disclaimer" className="underline hover:text-foreground">
                  SEBI Regulatory Disclaimer
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
