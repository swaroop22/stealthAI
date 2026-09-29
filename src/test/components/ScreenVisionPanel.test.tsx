import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScreenVisionPanel } from "../../components/ScreenVisionPanel";
import { ScreenCaptureService } from "../../services/screenService";
import type { ScreenSnippet } from "../../types";

describe("<ScreenVisionPanel />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleSnippet: ScreenSnippet = {
    id: "snippet-1",
    dataUrl: "data:image/png;base64,sampleSnippetPng",
    timestamp: "10:30:00 AM",
    note: "Coding problem snapshot"
  };

  it("renders dropzone and capture button when no snippet is active", () => {
    render(
      <ScreenVisionPanel
        activeSnippet={null}
        onSnippetCaptured={vi.fn()}
        onAnalyzeSnippet={vi.fn()}
      />
    );

    expect(screen.getByText(/Screen & Code Problem Ingestion/i)).toBeInTheDocument();
    expect(screen.getByText(/Click to capture window or paste screenshot here/i)).toBeInTheDocument();
  });

  it("captures screen and triggers onSnippetCaptured", async () => {
    vi.spyOn(ScreenCaptureService, "captureScreen").mockResolvedValue(sampleSnippet);
    const onSnippetCaptured = vi.fn();

    render(
      <ScreenVisionPanel
        activeSnippet={null}
        onSnippetCaptured={onSnippetCaptured}
        onAnalyzeSnippet={vi.fn()}
      />
    );

    const captureBtn = screen.getByRole("button", { name: /Capture Screen \/ Tab/i });
    await fireEvent.click(captureBtn);

    expect(onSnippetCaptured).toHaveBeenCalledWith(sampleSnippet);
  });

  it("renders snippet preview and triggers onAnalyzeSnippet when analyze button is clicked", () => {
    const onAnalyzeSnippet = vi.fn();
    render(
      <ScreenVisionPanel
        activeSnippet={sampleSnippet}
        onSnippetCaptured={vi.fn()}
        onAnalyzeSnippet={onAnalyzeSnippet}
      />
    );

    expect(screen.getByText(/Captured at 10:30:00 AM/i)).toBeInTheDocument();
    const analyzeBtn = screen.getByRole("button", { name: /Analyze with Vision AI/i });
    fireEvent.click(analyzeBtn);

    expect(onAnalyzeSnippet).toHaveBeenCalledWith(sampleSnippet);
  });

  it("removes snippet when close button is clicked", () => {
    const onSnippetCaptured = vi.fn();
    render(
      <ScreenVisionPanel
        activeSnippet={sampleSnippet}
        onSnippetCaptured={onSnippetCaptured}
        onAnalyzeSnippet={vi.fn()}
      />
    );

    const removeBtn = screen.getByTitle("Remove snippet");
    fireEvent.click(removeBtn);

    expect(onSnippetCaptured).toHaveBeenCalledWith(null);
  });
});
