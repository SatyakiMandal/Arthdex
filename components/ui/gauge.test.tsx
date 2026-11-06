import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Gauge, ScoreBar } from "./gauge";

describe("components/ui/gauge", () => {
  it("renders Gauge value and label clamped between 0 and 100", () => {
    render(<Gauge value={75.5} label="Quality Score" />);
    expect(screen.getByText("75.5")).toBeDefined();
    expect(screen.getByText("Quality Score")).toBeDefined();

    const svg = screen.getByRole("img");
    expect(svg.getAttribute("aria-label")).toContain("Quality Score 75.5 out of 100");
  });

  it("clamps values over 100 to 100", () => {
    render(<Gauge value={120} label="Risk Index" />);
    expect(screen.getByText("100.0")).toBeDefined();
  });

  it("clamps negative values to 0", () => {
    render(<Gauge value={-15} label="Momentum" />);
    expect(screen.getByText("0.0")).toBeDefined();
  });

  describe("ScoreBar", () => {
    it("renders diverging score bar for positive value", () => {
      const { container } = render(<ScoreBar score={50} />);
      expect(container.firstChild).toBeDefined();
    });

    it("renders fallback em-dash when score is null", () => {
      render(<ScoreBar score={null} />);
      expect(screen.getByText("—")).toBeDefined();
    });
  });
});
