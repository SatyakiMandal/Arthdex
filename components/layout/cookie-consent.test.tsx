import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { CookieConsent } from "./cookie-consent";

describe("components/layout/cookie-consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders when no consent has been previously given", async () => {
    await act(async () => {
      render(<CookieConsent />);
    });
    expect(await screen.findByText("Privacy & Local Storage")).toBeDefined();
    expect(await screen.findByText("Accept All")).toBeDefined();
    expect(await screen.findByText("Essential Only")).toBeDefined();
  });

  it("does not render when consent was already saved as 'all'", async () => {
    localStorage.setItem("arthdex:privacy_consent:v1", "all");
    let renderedContainer: HTMLElement;
    await act(async () => {
      const { container } = render(<CookieConsent />);
      renderedContainer = container;
    });
    expect(renderedContainer!.firstChild).toBeNull();
  });

  it("does not render when consent was already saved as 'essential'", async () => {
    localStorage.setItem("arthdex:privacy_consent:v1", "essential");
    let renderedContainer: HTMLElement;
    await act(async () => {
      const { container } = render(<CookieConsent />);
      renderedContainer = container;
    });
    expect(renderedContainer!.firstChild).toBeNull();
  });

  it("saves 'all' to localStorage and closes when clicking Accept All", async () => {
    await act(async () => {
      render(<CookieConsent />);
    });
    const acceptBtn = await screen.findByText("Accept All");
    await act(async () => {
      fireEvent.click(acceptBtn);
    });

    expect(localStorage.getItem("arthdex:privacy_consent:v1")).toBe("all");
    expect(screen.queryByText("Privacy & Local Storage")).toBeNull();
  });

  it("saves 'essential' to localStorage and closes when clicking Essential Only", async () => {
    await act(async () => {
      render(<CookieConsent />);
    });
    const essentialBtn = await screen.findByText("Essential Only");
    await act(async () => {
      fireEvent.click(essentialBtn);
    });

    expect(localStorage.getItem("arthdex:privacy_consent:v1")).toBe("essential");
    expect(screen.queryByText("Privacy & Local Storage")).toBeNull();
  });
});
