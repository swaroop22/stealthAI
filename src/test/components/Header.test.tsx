import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "../../components/Header";
import type { CandidateProfile, ConsentAudit } from "../../types";

describe("<Header />", () => {
  const mockProfile: CandidateProfile = {
    name: "Alex Morgan",
    targetRole: "Staff Data Engineer",
    yearsExp: "8+ years",
    primaryLanguages: ["Python", "SQL"],
    frameworks: ["Spark", "Kafka"],
    keyProjects: "Distributed real-time platform",
    customGuidelines: "Be concise",
    resumeText: "Experienced Senior Engineer with 8+ years experience"
  };

  const mockConsent: ConsentAudit = {
    granted: true,
    timestamp: new Date().toISOString(),
    participantNoticeAcknowledged: true,
    localOnlyMode: false
  };

  const defaultProps = {
    isCapturing: true,
    consent: mockConsent,
    profile: mockProfile,
    onOpenResumeModal: vi.fn(),
    onOpenSettings: vi.fn(),
    onExport: vi.fn()
  };

  it("renders branding title, version pill, and status badge", () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByText("StealthAI")).toBeInTheDocument();
    expect(screen.getByText("v5.0.0 Pro Edition")).toBeInTheDocument();
    expect(screen.getByText("CAPTURING AUDIO (VISIBLE)")).toBeInTheDocument();
  });

  it("shows assistant standby status when isCapturing is false", () => {
    render(<Header {...defaultProps} isCapturing={false} />);

    expect(screen.getByText("ASSISTANT STANDBY")).toBeInTheDocument();
  });

  it("displays ingested resume details when resumeText is present", () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByText(/Resume: Alex Morgan/i)).toBeInTheDocument();
  });

  it("displays upload prompt when no resume text is present", () => {
    render(
      <Header
        {...defaultProps}
        profile={{ ...mockProfile, resumeText: "" }}
      />
    );

    expect(screen.getByText("📄 Upload Resume & Remember Me")).toBeInTheDocument();
  });

  it("triggers onOpenResumeModal when resume button is clicked", () => {
    const onOpenResumeModal = vi.fn();
    render(<Header {...defaultProps} onOpenResumeModal={onOpenResumeModal} />);

    const resumeBtn = screen.getByRole("button", { name: /Resume:/i });
    fireEvent.click(resumeBtn);

    expect(onOpenResumeModal).toHaveBeenCalledTimes(1);
  });

  it("triggers onOpenSettings and onExport when action buttons are clicked", () => {
    const onOpenSettings = vi.fn();
    const onExport = vi.fn();
    render(
      <Header
        {...defaultProps}
        onOpenSettings={onOpenSettings}
        onExport={onExport}
      />
    );

    const exportBtn = screen.getByTitle("Export notes");
    fireEvent.click(exportBtn);
    expect(onExport).toHaveBeenCalledTimes(1);

    const settingsBtn = screen.getByTitle("Settings & Candidate Profile");
    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
