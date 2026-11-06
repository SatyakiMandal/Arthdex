import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { SiteFooter } from "./site-footer";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} alt={props.alt || ""} />;
  },
}));

describe("components/layout/site-footer", () => {
  it("renders all four legal policy links with correct destinations", () => {
    render(<SiteFooter />);

    const privacyLink = screen.getByRole("link", { name: "Privacy Policy" });
    expect(privacyLink.getAttribute("href")).toBe("/privacy");

    const termsLink = screen.getByRole("link", { name: "Terms of Service" });
    expect(termsLink.getAttribute("href")).toBe("/terms");

    const disclaimerLink = screen.getByRole("link", { name: "Regulatory Disclaimer" });
    expect(disclaimerLink.getAttribute("href")).toBe("/disclaimer");

    const copyrightLink = screen.getByRole("link", { name: "DMCA & Copyright" });
    expect(copyrightLink.getAttribute("href")).toBe("/copyright");
  });

  it("renders the important research disclaimer and methodology links", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/Not investment advice/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /Methodology/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /Data status/i })).toBeDefined();
  });
});
