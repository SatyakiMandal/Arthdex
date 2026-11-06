import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CellBar } from "./cell-bar";

describe("components/ui/cell-bar", () => {
  it("renders children content inside cell bar", () => {
    render(
      <CellBar value={500} max={1000} tone="up">
        ₹500 Cr
      </CellBar>,
    );
    expect(screen.getByText("₹500 Cr")).toBeDefined();
  });

  it("handles zero, null, and non-finite values safely", () => {
    render(
      <CellBar value={null} max={1000}>
        N/A
      </CellBar>,
    );
    expect(screen.getByText("N/A")).toBeDefined();

    render(
      <CellBar value={NaN} max={1000}>
        NaN Val
      </CellBar>,
    );
    expect(screen.getByText("NaN Val")).toBeDefined();
  });

  it("renders reference markers if provided", () => {
    const { container } = render(
      <CellBar value={250} max={500} markers={[100, 250, 400]}>
        250
      </CellBar>,
    );
    const markers = container.querySelectorAll("span[aria-hidden]");
    expect(markers.length).toBeGreaterThan(1);
  });
});
