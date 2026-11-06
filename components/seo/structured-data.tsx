import React from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://arthdex.com";

/**
 * Injects Schema.org JSON-LD structured data into the head of the application.
 * Defines Organization, FinancialService, and SoftwareApplication schemas for Google Search Rich Results.
 */
export function StructuredData() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "Arthdex",
        url: SITE,
        logo: {
          "@type": "ImageObject",
          url: `${SITE}/brand/arthdex-mark.png`,
          caption: "Arthdex Quantitative Intelligence",
        },
        description:
          "Quantitative financial research, valuation modeling, and market intelligence platform for Indian equities, derivatives, and unlisted markets.",
      },
      {
        "@type": "FinancialService",
        "@id": `${SITE}/#service`,
        name: "Arthdex Market Intelligence",
        url: SITE,
        description:
          "Research platform delivering real-time mathematical models, NSE price verification, options Greeks, reverse DCF, and unlisted intelligence.",
        provider: {
          "@id": `${SITE}/#organization`,
        },
        areaServed: "IN",
        serviceType: "Financial Market Analytics and Research Intelligence",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE}/#software`,
        name: "Arthdex Terminal",
        operatingSystem: "Web",
        applicationCategory: "FinanceApplication",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "Arthdex",
        publisher: {
          "@id": `${SITE}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE}/company/{search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
