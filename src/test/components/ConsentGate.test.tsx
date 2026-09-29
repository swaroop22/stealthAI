import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConsentGate } from "../../components/ConsentGate";
import type { ConsentAudit } from "../../types";

describe("<ConsentGate />", () => {
  const baseConsent: ConsentAudit = {
    granted: false,
    timestamp: null,
    participantNoticeAcknowledged: false,
    localOnlyMode: false
  };

  it("renders privacy headers and badges", () => {
    render(
      <ConsentGate
        consent={baseConsent}
        onUpdateConsent={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Participant Consent & Privacy Verification")).toBeInTheDocument();
    expect(screen.getByText("Visible Assistant Protocol")).toBeInTheDocument();
    expect(screen.getByText("☁️ Cloud-Assisted")).toBeInTheDocument();
  });

  it("shows local-only badge when localOnlyMode is enabled", () => {
    render(
      <ConsentGate
        consent={{ ...baseConsent, localOnlyMode: true }}
        onUpdateConsent={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("🔒 Local-Only (Offline)")).toBeInTheDocument();
  });

  it("disables 'Confirm & Begin Session' button when consent is not granted", () => {
    const onConfirm = vi.fn();
    render(
      <ConsentGate
        consent={baseConsent}
        onUpdateConsent={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const button = screen.getByRole("button", { name: /Confirm & Begin Session/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onUpdateConsent when certifying consent checkbox is clicked", () => {
    const onUpdateConsent = vi.fn();
    render(
      <ConsentGate
        consent={baseConsent}
        onUpdateConsent={onUpdateConsent}
        onConfirm={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const certificationCheckbox = checkboxes[0];

    fireEvent.click(certificationCheckbox);
    expect(onUpdateConsent).toHaveBeenCalledWith(
      expect.objectContaining({
        granted: true
      })
    );
  });

  it("enables 'Confirm & Begin Session' button and calls onConfirm when clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConsentGate
        consent={{ ...baseConsent, granted: true, timestamp: new Date().toISOString() }}
        onUpdateConsent={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const button = screen.getByRole("button", { name: /Confirm & Begin Session/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("toggles local-only mode when local-only checkbox is clicked", () => {
    const onUpdateConsent = vi.fn();
    render(
      <ConsentGate
        consent={baseConsent}
        onUpdateConsent={onUpdateConsent}
        onConfirm={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const localCheckbox = checkboxes[1];

    fireEvent.click(localCheckbox);
    expect(onUpdateConsent).toHaveBeenCalledWith({ localOnlyMode: true });
  });
});
