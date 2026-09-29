import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsModal } from "../../components/SettingsModal";
import type { CandidateProfile, ConsentAudit } from "../../types";

describe("<SettingsModal />", () => {
  const mockProfile: CandidateProfile = {
    name: "Alex Morgan",
    targetRole: "Staff Data Engineer",
    yearsExp: "8+ years",
    primaryLanguages: ["Python", "SQL"],
    frameworks: ["Spark", "Kafka"],
    keyProjects: "Distributed real-time engine",
    customGuidelines: "Be concise",
    resumeParsedAt: new Date().toISOString()
  };

  const mockConsent: ConsentAudit = {
    granted: true,
    timestamp: new Date().toISOString(),
    participantNoticeAcknowledged: true,
    localOnlyMode: false
  };

  const defaultProps = {
    isOpen: true,
    profile: mockProfile,
    apiKey: "AIzaSyTestKey123",
    aiConfig: { provider: "gemini" as const, apiKey: "AIzaSyTestKey123", model: "gemini-3.8-flash" },
    consent: mockConsent,
    isAutoRecordEnabled: true,
    onToggleAutoRecord: vi.fn(),
    onOpenRecordingsFolder: vi.fn(),
    onSaveProfile: vi.fn(),
    onSaveApiKey: vi.fn(),
    onSaveAIConfig: vi.fn(),
    onSaveConsent: vi.fn(),
    onClose: vi.fn()
  };

  it("does not render when isOpen is false", () => {
    const { container } = render(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header and tab navigation when isOpen is true", () => {
    render(<SettingsModal {...defaultProps} />);

    expect(screen.getByText("StealthAI Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI Model & Provider/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Candidate Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Privacy & Local/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<SettingsModal {...defaultProps} onClose={onClose} />);

    const closeBtn = container.querySelector(".btn-close-modal") as HTMLButtonElement;
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it("switches AI provider when provider card is clicked", () => {
    render(<SettingsModal {...defaultProps} />);

    // Click Anthropic Claude provider
    const claudeCard = screen.getByText("Anthropic Claude");
    fireEvent.click(claudeCard);

    // Verify Claude models are now shown
    expect(screen.getByText(/Claude 3.7 Sonnet/i)).toBeInTheDocument();
  });

  it("updates API key input and saves AI configuration", () => {
    const onSaveAIConfig = vi.fn();
    const onSaveApiKey = vi.fn();

    render(
      <SettingsModal
        {...defaultProps}
        onSaveAIConfig={onSaveAIConfig}
        onSaveApiKey={onSaveApiKey}
      />
    );

    // Update API Key
    const keyInput = screen.getByPlaceholderText("AIzaSy...");
    fireEvent.change(keyInput, { target: { value: "AIzaSyNewSecretKey999" } });

    // Click Save Changes button
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(onSaveAIConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "AIzaSyNewSecretKey999"
      })
    );
    expect(onSaveApiKey).toHaveBeenCalledWith("AIzaSyNewSecretKey999");
  });

  it("navigates to Candidate Profile tab and allows updating candidate name and role", () => {
    const onSaveProfile = vi.fn();
    render(<SettingsModal {...defaultProps} onSaveProfile={onSaveProfile} />);

    // Switch to profile tab
    const profileTabBtn = screen.getByRole("button", { name: /Candidate Profile/i });
    fireEvent.click(profileTabBtn);

    // Update name
    const nameInput = screen.getByDisplayValue("Alex Morgan");
    fireEvent.change(nameInput, { target: { value: "Samantha Reed" } });

    // Save
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Samantha Reed"
      })
    );
  });

  it("navigates to Privacy & Local tab and displays privacy controls", () => {
    render(<SettingsModal {...defaultProps} />);

    // Switch to privacy tab
    const privacyTabBtn = screen.getByRole("button", { name: /Privacy & Local/i });
    fireEvent.click(privacyTabBtn);

    expect(screen.getByText(/Privacy & Data Governance/i)).toBeInTheDocument();
    expect(screen.getByText(/Session Audio Recording/i)).toBeInTheDocument();
  });
});
