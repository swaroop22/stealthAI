import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodingAssistant } from "../../components/CodingAssistant";
import type { AIResponse, CandidateProfile, ConsentAudit } from "../../types";

describe("<CodingAssistant />", () => {
  const mockProfile: CandidateProfile = {
    name: "Alex Morgan",
    targetRole: "Senior Data Engineer",
    yearsExp: "8+ years",
    primaryLanguages: ["Python", "SQL"],
    frameworks: ["Spark", "Kafka"],
    keyProjects: "Distributed pipelines",
    customGuidelines: "",
    resumeParsedAt: new Date().toISOString()
  };

  const mockConsent: ConsentAudit = {
    granted: true,
    timestamp: new Date().toISOString(),
    participantNoticeAcknowledged: true,
    localOnlyMode: false
  };

  const sampleResponse: AIResponse = {
    id: "resp-1",
    timestamp: "10:15:00 AM",
    prompt: "How does Spark Catalyst Optimizer perform predicate pushdown?",
    content: "Catalyst Optimizer analyzes AST logical plans and pushes WHERE filter predicates directly into data source scan operators (Parquet/Delta).",
    mode: "coding",
    isStreaming: false,
    tokensGenerated: 140
  };

  const defaultProps = {
    isCapturing: true,
    activeSpeaker: "Interviewer" as const,
    interimText: "",
    transcript: [],
    activeResponse: sampleResponse,
    responseHistory: [sampleResponse],
    activeSnippet: null,
    consent: mockConsent,
    profile: mockProfile,
    apiKey: "dummy-key",
    aiConfig: { provider: "gemini" as const, apiKey: "dummy-key", model: "gemini-3.8-flash" },
    autoAnswer: true,
    onToggleAutoAnswer: vi.fn(),
    onToggleCapture: vi.fn(),
    onCaptureScreenshot: vi.fn(),
    onTriggerAnswer: vi.fn(),
    onSelectResponse: vi.fn(),
    onClearCurrentAnswer: vi.fn(),
    onClearTranscript: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenResumeModal: vi.fn(),
    onExportSession: vi.fn(),
    onSwitchToDashboard: vi.fn(),
    showToast: vi.fn()
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders HUD top bar and action pills (Answer, Screenshot, Chat)", () => {
    render(<CodingAssistant {...defaultProps} />);

    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByText("Screenshot")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("triggers onTriggerAnswer when clicking Answer pill", () => {
    const onTriggerAnswer = vi.fn();
    render(<CodingAssistant {...defaultProps} onTriggerAnswer={onTriggerAnswer} />);

    const answerBtn = screen.getByTitle(/Answer instantly now/i);
    fireEvent.click(answerBtn);

    expect(onTriggerAnswer).toHaveBeenCalled();
  });

  it("triggers onCaptureScreenshot when clicking Screenshot pill", () => {
    const onCaptureScreenshot = vi.fn();
    render(<CodingAssistant {...defaultProps} onCaptureScreenshot={onCaptureScreenshot} />);

    const screenshotBtn = screen.getByTitle(/Take screenshot & solve/i);
    fireEvent.click(screenshotBtn);

    expect(onCaptureScreenshot).toHaveBeenCalled();
  });

  it("triggers onToggleAutoAnswer when clicking Auto toggle pill", () => {
    const onToggleAutoAnswer = vi.fn();
    render(<CodingAssistant {...defaultProps} onToggleAutoAnswer={onToggleAutoAnswer} />);

    const autoBtn = screen.getByRole("button", { name: /Auto/i });
    fireEvent.click(autoBtn);

    expect(onToggleAutoAnswer).toHaveBeenCalled();
  });

  it("opens settings when clicking the AI model badge pill", () => {
    const onOpenSettings = vi.fn();
    render(<CodingAssistant {...defaultProps} onOpenSettings={onOpenSettings} />);

    const modelBadgeBtn = screen.getByTitle(/Active AI:/i);
    fireEvent.click(modelBadgeBtn);

    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("renders the question and solution answer cards", () => {
    render(<CodingAssistant {...defaultProps} />);

    expect(screen.getByText(/How does Spark Catalyst Optimizer perform predicate pushdown\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Catalyst Optimizer analyzes AST logical plans/i)).toBeInTheDocument();
  });

  it("opens custom prompt chat drawer and submits follow-up question", () => {
    const onTriggerAnswer = vi.fn();
    render(<CodingAssistant {...defaultProps} onTriggerAnswer={onTriggerAnswer} />);

    // Click chat pill to open drawer
    const chatBtn = screen.getByTitle(/Toggle Custom Prompt/i);
    fireEvent.click(chatBtn);

    const input = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.change(input, { target: { value: "Show me a code snippet in PySpark" } });

    // Submit
    const sendBtn = screen.getByTitle("Submit");
    fireEvent.click(sendBtn);

    expect(onTriggerAnswer).toHaveBeenCalledWith("Show me a code snippet in PySpark");
  });

  it("handles multi-question pagination when multiple responses exist", () => {
    const secondResponse: AIResponse = {
      id: "resp-2",
      timestamp: "10:18:00 AM",
      prompt: "What is the difference between broadcast join and shuffle hash join?",
      content: "Broadcast join sends the entire small table to all executors avoiding a shuffle.",
      mode: "coding",
      isStreaming: false,
      tokensGenerated: 110
    };

    const onSelectResponse = vi.fn();
    render(
      <CodingAssistant
        {...defaultProps}
        activeResponse={secondResponse}
        responseHistory={[secondResponse, sampleResponse]}
        onSelectResponse={onSelectResponse}
      />
    );

    // Click previous answer button (navigates back to sampleResponse)
    const prevBtn = screen.getByTitle(/Previous Answer/i);
    fireEvent.click(prevBtn);

    expect(onSelectResponse).toHaveBeenCalledWith("resp-1");
  });
});
