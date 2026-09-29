import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssistantPanel } from "../../components/AssistantPanel";
import type { AIResponse, CandidateProfile } from "../../types";

describe("<AssistantPanel />", () => {
  const mockProfile: CandidateProfile = {
    name: "Alex Morgan",
    targetRole: "Staff Data Engineer",
    yearsExp: "8+ years",
    primaryLanguages: ["Python", "SQL"],
    frameworks: ["Spark", "Kafka"],
    keyProjects: "Built real-time analytics engine",
    customGuidelines: "",
    resumeParsedAt: new Date().toISOString()
  };

  const sampleResponse: AIResponse = {
    id: "resp-1",
    timestamp: "10:02:00 AM",
    prompt: "How does Kafka achieve exactly-once semantics?",
    content: "Kafka achieves EOS using idempotent producers and transactional commits.",
    mode: "coding",
    isStreaming: false,
    tokensGenerated: 120
  };

  const defaultProps = {
    activeMode: "coding" as const,
    profile: mockProfile,
    activeResponse: sampleResponse,
    responseHistory: [sampleResponse],
    onSelectResponse: vi.fn(),
    onSetMode: vi.fn(),
    onGenerate: vi.fn(),
    onStop: vi.fn()
  };

  it("renders copilot header and candidate profile chip", () => {
    render(<AssistantPanel {...defaultProps} />);

    expect(screen.getByText("Real-Time Copilot")).toBeInTheDocument();
    expect(screen.getByText(/Alex Morgan • Staff Data Engineer/i)).toBeInTheDocument();
  });

  it("calls onSetMode when mode button is clicked", () => {
    const onSetMode = vi.fn();
    render(<AssistantPanel {...defaultProps} onSetMode={onSetMode} />);

    const starBtn = screen.getByRole("button", { name: /STAR Behavioral/i });
    fireEvent.click(starBtn);

    expect(onSetMode).toHaveBeenCalledWith("behavioral");
  });

  it("displays the prompt and AI generated response content", () => {
    render(<AssistantPanel {...defaultProps} />);

    expect(screen.getByText(/How does Kafka achieve exactly-once semantics/i)).toBeInTheDocument();
    expect(screen.getByText(/Kafka achieves EOS using idempotent producers/i)).toBeInTheDocument();
  });

  it("copies content to clipboard when copy button is clicked", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");
    render(<AssistantPanel {...defaultProps} />);

    const copyBtn = screen.getByRole("button", { name: /Copy Solution/i });
    fireEvent.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(sampleResponse.content);
  });

  it("renders multiple question tabs and handles selecting a previous response", () => {
    const secondResponse: AIResponse = {
      id: "resp-2",
      timestamp: "10:05:00 AM",
      prompt: "Explain CAP theorem trade-offs",
      content: "CAP theorem states consistency vs availability in partitioned networks.",
      mode: "system_design",
      isStreaming: false,
      tokensGenerated: 95
    };

    const onSelectResponse = vi.fn();
    render(
      <AssistantPanel
        {...defaultProps}
        responseHistory={[sampleResponse, secondResponse]}
        onSelectResponse={onSelectResponse}
      />
    );

    expect(screen.getByText(/Questions \(2\):/i)).toBeInTheDocument();
    const q2Tab = screen.getByRole("button", { name: /Q2/i });
    fireEvent.click(q2Tab);

    expect(onSelectResponse).toHaveBeenCalledWith("resp-2");
  });

  it("submits custom prompt when typing into prompt box and clicking submit", () => {
    const onGenerate = vi.fn();
    render(<AssistantPanel {...defaultProps} onGenerate={onGenerate} />);

    const textarea = screen.getByPlaceholderText(/Ask a technical follow-up/i);
    fireEvent.change(textarea, { target: { value: "Provide a code example in Python" } });

    const submitBtn = screen.getByRole("button", { name: /Ask/i });
    fireEvent.click(submitBtn);

    expect(onGenerate).toHaveBeenCalledWith("Provide a code example in Python");
  });

  it("displays stop button when AI response is currently streaming", () => {
    const onStop = vi.fn();
    render(
      <AssistantPanel
        {...defaultProps}
        activeResponse={{ ...sampleResponse, isStreaming: true }}
        onStop={onStop}
      />
    );

    const stopBtn = screen.getByRole("button", { name: /Stop/i });
    expect(stopBtn).toBeInTheDocument();

    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });
});
