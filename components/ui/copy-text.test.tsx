import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { CopyText } from "./copy-text";

describe("components/ui/copy-text", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Copy and Print buttons", () => {
    render(<CopyText text="TCS CMP ₹3500" label="Copy Summary" />);
    expect(screen.getByText("Copy Summary")).toBeDefined();
    expect(screen.getByText("Print or save PDF")).toBeDefined();
  });

  it("copies text to navigator.clipboard on click", async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    render(<CopyText text="RELIANCE Analysis Report" />);
    const copyBtn = screen.getByText("Copy as text");

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextSpy).toHaveBeenCalledWith("RELIANCE Analysis Report");
    expect(await screen.findByText("Copied")).toBeDefined();
  });

  it("triggers window.print when print button is clicked", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<CopyText text="Test Document" />);

    const printBtn = screen.getByText("Print or save PDF");
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
  });
});
