import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { DataCard, StatusPill } from "./data-card";

describe("components/ui/data-card", () => {
  it("renders title, subtitle, children, and footnote", () => {
    render(
      <DataCard
        title="Volatility Matrix"
        subtitle="30-day realized volatility"
        footnote="Based on NSE closing prices"
      >
        <div data-testid="card-content">24.5%</div>
      </DataCard>,
    );

    expect(screen.getByText("Volatility Matrix")).toBeDefined();
    expect(screen.getByText("30-day realized volatility")).toBeDefined();
    expect(screen.getByTestId("card-content").textContent).toBe("24.5%");
    expect(screen.getByText("Based on NSE closing prices")).toBeDefined();
  });

  it("renders StatusPill with correct tone and label", () => {
    const { rerender } = render(<StatusPill label="BULLISH" tone="up" />);
    expect(screen.getByText("BULLISH")).toBeDefined();

    rerender(<StatusPill label="BEARISH" tone="down" />);
    expect(screen.getByText("BEARISH")).toBeDefined();

    rerender(<StatusPill label="NEUTRAL" tone="neutral" />);
    expect(screen.getByText("NEUTRAL")).toBeDefined();
  });
});
