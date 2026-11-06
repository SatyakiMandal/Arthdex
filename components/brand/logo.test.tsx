import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Wordmark, Logo } from "./logo";

// Mock next/image for Vitest / JSDOM
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} alt={props.alt || ""} />;
  },
}));

describe("components/brand/logo", () => {
  it("renders Wordmark with ArTh and Dex parts", () => {
    const { container } = render(<Wordmark />);
    expect(container.textContent).toContain("ArThDex");
    const dexSpan = container.querySelector("span span");
    expect(dexSpan?.textContent).toBe("Dex");
  });

  it("renders Logo with tagline by default", () => {
    render(<Logo />);
    expect(screen.getByText("LEARN")).toBeDefined();
    expect(screen.getByText("ANALYZE")).toBeDefined();
    expect(screen.getByText("INVEST")).toBeDefined();
    expect(screen.getByText("GROW")).toBeDefined();
  });

  it("omits tagline when tagline=false", () => {
    render(<Logo tagline={false} />);
    expect(screen.queryByText("LEARN")).toBeNull();
  });
});
