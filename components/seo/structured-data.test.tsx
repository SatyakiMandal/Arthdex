import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { StructuredData } from "./structured-data";

describe("StructuredData (Schema.org JSON-LD)", () => {
  it("renders a script tag with type application/ld+json", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector("script[type='application/ld+json']");
    expect(script).not.toBeNull();
  });

  it("contains valid JSON matching Schema.org specifications", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector("script[type='application/ld+json']");
    expect(script?.textContent).toBeTruthy();

    const data = JSON.parse(script!.textContent!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(Array.isArray(data["@graph"])).toBe(true);

    const types = data["@graph"].map((node: { "@type": string }) => node["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("FinancialService");
    expect(types).toContain("SoftwareApplication");
    expect(types).toContain("WebSite");
  });

  it("configures Google SearchAction sitelinks in WebSite schema", () => {
    const { container } = render(<StructuredData />);
    const script = container.querySelector("script[type='application/ld+json']");
    const data = JSON.parse(script!.textContent!);

    const websiteNode = data["@graph"].find((n: { "@type": string }) => n["@type"] === "WebSite");
    expect(websiteNode).toBeDefined();
    expect(websiteNode.potentialAction["@type"]).toBe("SearchAction");
    expect(websiteNode.potentialAction.target).toContain("{search_term_string}");
  });
});
