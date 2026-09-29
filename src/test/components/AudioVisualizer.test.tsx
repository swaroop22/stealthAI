import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { AudioVisualizer } from "../../components/AudioVisualizer";
import { SpeechService } from "../../services/speechService";

describe("<AudioVisualizer />", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    const mockGradient = {
      addColorStop: vi.fn()
    };

    const mockContext = {
      clearRect: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue(mockGradient),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn()
    };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext as any);
  });

  it("renders audio canvas container when idle", () => {
    const { container } = render(<AudioVisualizer isActive={false} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders and calls SpeechService.getAudioLevel when active", () => {
    const audioLevelSpy = vi.spyOn(SpeechService, "getAudioLevel").mockReturnValue(0.75);

    const { container } = render(<AudioVisualizer isActive={true} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    expect(audioLevelSpy).toHaveBeenCalled();
  });
});
