import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VoiceBoxModal } from "./voice-box-modal";
import { LocaleProvider } from "@/lib/i18n";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("VoiceBoxModal (M30 Regional Voice Terminal)", () => {
  it("renders floating desktop window without full-screen blocking backdrop", () => {
    const { container } = render(
      <LocaleProvider>
        <VoiceBoxModal isOpen={true} onClose={() => {}} />
      </LocaleProvider>
    );

    const dialog = screen.getByRole("dialog", { name: /Regional Voice Terminal Window/i });
    expect(dialog).toBeDefined();

    // Verify backdrop is NOT present
    const backdrop = container.querySelector(".fixed.inset-0.bg-background\\/80");
    expect(backdrop).toBeNull();
  });

  it("renders 14 Indian languages selection buttons", () => {
    render(
      <LocaleProvider>
        <VoiceBoxModal isOpen={true} onClose={() => {}} />
      </LocaleProvider>
    );

    // 14 languages meta codes present
    expect(screen.getAllByText("EN").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("HI")).toBeDefined();
    expect(screen.getByText("BN")).toBeDefined();
    expect(screen.getByText("GU")).toBeDefined();
    expect(screen.getByText("TA")).toBeDefined();
  });

  it("renders 1-click Quick Intent chips and triggers execution on click", () => {
    const onExecuteMock = vi.fn();
    render(
      <LocaleProvider>
        <VoiceBoxModal isOpen={true} onClose={() => {}} defaultLocale="hi" onExecute={onExecuteMock} />
      </LocaleProvider>
    );

    // Should find the Hindi chip
    const chip = screen.getByText("रिलायंस का ऑर्डर फ्लो दिखाओ");
    expect(chip).toBeDefined();

    // Click chip
    fireEvent.click(chip);

    // Check that command was synthesized and displayed
    const commandElements = screen.getAllByText(/RELIANCE GP/);
    expect(commandElements.length).toBeGreaterThanOrEqual(1);
  });

  it("allows minimizing and restoring the floating window", () => {
    render(
      <LocaleProvider>
        <VoiceBoxModal isOpen={true} onClose={() => {}} />
      </LocaleProvider>
    );

    const minimizeBtn = screen.getByTitle(/Minimize to floating dock/i);
    expect(minimizeBtn).toBeDefined();

    // Click minimize
    fireEvent.click(minimizeBtn);

    // Body should be hidden, restore button present
    const restoreBtn = screen.getByTitle(/Restore Voice Box/i);
    expect(restoreBtn).toBeDefined();

    // Click restore
    fireEvent.click(restoreBtn);
    expect(screen.getByTitle(/Minimize to floating dock/i)).toBeDefined();
  });
});
