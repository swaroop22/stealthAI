import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScreenCaptureService } from "../../services/screenService";

describe("ScreenCaptureService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws error when getDisplayMedia is not supported", async () => {
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {},
      configurable: true,
      writable: true
    });

    await expect(ScreenCaptureService.captureScreen("test note")).rejects.toThrow(
      "Screen Capture API (getDisplayMedia) is not supported"
    );

    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
  });

  it("captures screen and returns ScreenSnippet data structure", async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack]
    };

    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream)
      },
      configurable: true,
      writable: true
    });

    // Mock HTMLMediaElement.prototype.play
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});

    // Mock HTMLCanvasElement.prototype.getContext
    const mockContext = {
      drawImage: vi.fn()
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,mockPngData");

    const snippet = await ScreenCaptureService.captureScreen("Coding Challenge Problem");

    expect(snippet).toBeDefined();
    expect(snippet.id).toBeTruthy();
    expect(snippet.dataUrl).toBe("data:image/png;base64,mockPngData");
    expect(snippet.note).toBe("Coding Challenge Problem");
    expect(snippet.timestamp).toBeTruthy();
    expect(mockTrack.stop).toHaveBeenCalled();

    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
  });
});
