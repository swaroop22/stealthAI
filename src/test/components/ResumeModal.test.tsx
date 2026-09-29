import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResumeModal } from "../../components/ResumeModal";
import type { CandidateProfile } from "../../types";

describe("<ResumeModal />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: CandidateProfile = {
    name: "Alex Morgan",
    targetRole: "Staff Data Engineer",
    yearsExp: "8+ years",
    primaryLanguages: ["Python", "SQL"],
    frameworks: ["Spark", "Kafka"],
    keyProjects: "Distributed streaming engine",
    customGuidelines: "Be concise",
    resumeText: "Experienced Senior Engineer with 8+ years experience"
  };

  const defaultProps = {
    isOpen: true,
    profile: mockProfile,
    onSaveProfile: vi.fn(),
    onClose: vi.fn(),
    showToast: vi.fn(),
    onTriggerTestQuestion: vi.fn()
  };

  it("does not render when isOpen is false", () => {
    const { container } = render(<ResumeModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header and tab options when open", () => {
    render(<ResumeModal {...defaultProps} />);

    expect(screen.getByText(/Resume & Background Ingestion/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload Resume File/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paste Resume Text/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ResumeModal {...defaultProps} onClose={onClose} />);

    const closeBtn = container.querySelector(".btn-close-modal") as HTMLButtonElement;
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switches to paste tab and parses raw text into profile", () => {
    const onSaveProfile = vi.fn();
    const showToast = vi.fn();

    render(
      <ResumeModal
        {...defaultProps}
        onSaveProfile={onSaveProfile}
        showToast={showToast}
      />
    );

    // Switch to paste tab
    const pasteTabBtn = screen.getByRole("button", { name: /Paste Resume Text/i });
    fireEvent.click(pasteTabBtn);

    const textarea = screen.getByPlaceholderText(/Paste your full resume/i);
    const resumeContent = `
Jane Doe
Principal Software Engineer with 10+ years of experience
Languages: Python, Go
Frameworks: Kubernetes, Kafka
`;
    fireEvent.change(textarea, { target: { value: resumeContent } });

    const analyzeBtn = screen.getByRole("button", { name: /Parse & Memorize/i });
    fireEvent.click(analyzeBtn);

    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jane Doe",
        targetRole: "Software Engineer",
        yearsExp: "10+ years"
      })
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Resume parsed and saved"),
      "success"
    );
  });
});
