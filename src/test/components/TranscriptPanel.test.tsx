import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscriptPanel } from "../../components/TranscriptPanel";
import type { TranscriptItem } from "../../types";

describe("<TranscriptPanel />", () => {
  const sampleTranscript: TranscriptItem[] = [
    {
      id: "turn-1",
      speaker: "Interviewer",
      text: "How do you handle data skew in Apache Spark?",
      timestamp: "10:00:15 AM"
    },
    {
      id: "turn-2",
      speaker: "Candidate",
      text: "I typically use salting or broadcast joins depending on table sizes.",
      timestamp: "10:00:45 AM"
    }
  ];

  const defaultProps = {
    transcript: sampleTranscript,
    interimText: "",
    isCapturing: true,
    activeSpeaker: "Interviewer" as const,
    consentGranted: true,
    autoAnswer: true,
    onToggleAutoAnswer: vi.fn(),
    onToggleCapture: vi.fn(),
    onSetSpeaker: vi.fn(),
    onAddManualTranscript: vi.fn(),
    onClearTranscript: vi.fn(),
    onExport: vi.fn(),
    onSelectPreset: vi.fn(),
    onSendToAssistant: vi.fn()
  };

  it("renders dialogue entries and speaker labels", () => {
    render(<TranscriptPanel {...defaultProps} />);

    expect(screen.getByText("How do you handle data skew in Apache Spark?")).toBeInTheDocument();
    expect(screen.getByText("I typically use salting or broadcast joins depending on table sizes.")).toBeInTheDocument();
    expect(screen.getByText(/2 dialogue entries/i)).toBeInTheDocument();
  });

  it("renders interim live text when speech is in progress", () => {
    render(
      <TranscriptPanel
        {...defaultProps}
        interimText="Explain the difference between TCP and UDP"
      />
    );

    expect(screen.getByText("Explain the difference between TCP and UDP")).toBeInTheDocument();
  });

  it("filters transcript items based on search input", () => {
    render(<TranscriptPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Search spoken dialogue/i);
    fireEvent.change(searchInput, { target: { value: "skew" } });

    expect(screen.getByText("How do you handle data skew in Apache Spark?")).toBeInTheDocument();
    expect(screen.queryByText("I typically use salting or broadcast joins depending on table sizes.")).not.toBeInTheDocument();
  });

  it("toggles auto-answer when clicking auto-answer button", () => {
    const onToggleAutoAnswer = vi.fn();
    render(<TranscriptPanel {...defaultProps} onToggleAutoAnswer={onToggleAutoAnswer} />);

    const autoAnswerBtn = screen.getByText(/Auto-Answer: ON/i);
    fireEvent.click(autoAnswerBtn);

    expect(onToggleAutoAnswer).toHaveBeenCalled();
  });

  it("toggles caption recording when clicking capture button", () => {
    const onToggleCapture = vi.fn();
    render(<TranscriptPanel {...defaultProps} onToggleCapture={onToggleCapture} />);

    const pauseBtn = screen.getByText("Pause Captions");
    fireEvent.click(pauseBtn);

    expect(onToggleCapture).toHaveBeenCalled();
  });

  it("submits manual transcript entry", () => {
    const onAddManualTranscript = vi.fn();
    render(<TranscriptPanel {...defaultProps} onAddManualTranscript={onAddManualTranscript} />);

    const input = screen.getByPlaceholderText(/Type or paste question manually/i);
    fireEvent.change(input, { target: { value: "Tell me about your experience with Kafka" } });

    const submitBtn = screen.getByTitle("Add to transcript");
    fireEvent.click(submitBtn);

    expect(onAddManualTranscript).toHaveBeenCalledWith(
      "Tell me about your experience with Kafka",
      "Interviewer"
    );
  });

  it("triggers AI solution when clicking 'Get AI Solution' on a transcript turn", () => {
    const onSendToAssistant = vi.fn();
    render(<TranscriptPanel {...defaultProps} onSendToAssistant={onSendToAssistant} />);

    const getSolutionBtns = screen.getAllByText(/Get AI Solution/i);
    fireEvent.click(getSolutionBtns[0]);

    expect(onSendToAssistant).toHaveBeenCalledWith(
      "How do you handle data skew in Apache Spark?"
    );
  });
});
