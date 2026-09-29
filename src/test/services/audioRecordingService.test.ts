import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioRecordingService } from "../../services/audioRecordingService";

describe("AudioRecordingService", () => {
  beforeEach(() => {
    // Reset state before each test
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await AudioRecordingService.stopRecording();
  });

  it("formats seconds into mm:ss string correctly", () => {
    expect(AudioRecordingService.formatSeconds(0)).toBe("0:00");
    expect(AudioRecordingService.formatSeconds(9)).toBe("0:09");
    expect(AudioRecordingService.formatSeconds(45)).toBe("0:45");
    expect(AudioRecordingService.formatSeconds(60)).toBe("1:00");
    expect(AudioRecordingService.formatSeconds(65)).toBe("1:05");
    expect(AudioRecordingService.formatSeconds(600)).toBe("10:00");
    expect(AudioRecordingService.formatSeconds(3665)).toBe("61:05");
  });

  it("registers listeners and receives initial state updates", () => {
    const states: any[] = [];
    const unsubscribe = AudioRecordingService.addListener((state) => {
      states.push(state);
    });

    expect(states.length).toBeGreaterThan(0);
    expect(states[0]).toHaveProperty("isRecording");
    expect(states[0]).toHaveProperty("seconds");

    unsubscribe();
  });

  it("returns initial state when not recording", () => {
    const state = AudioRecordingService.getState();
    expect(state.isRecording).toBe(false);
    expect(AudioRecordingService.getIsRecording()).toBe(false);
  });

  it("handles startRecording gracefully when getUserMedia is unavailable", async () => {
    const originalMediaDevices = navigator.mediaDevices;
    // Simulate unsupported getUserMedia
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
      writable: true
    });

    const success = await AudioRecordingService.startRecording();
    expect(success).toBe(false);

    // Restore
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
  });

  it("handles startRecording and interacts with electronAPI if present", async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack]
    };

    const mockStartSession = vi.fn().mockResolvedValue({ filePath: "/tmp/stealth_recording.webm" });
    const mockFinishSession = vi.fn().mockResolvedValue({ filePath: "/tmp/stealth_recording.webm" });
    const mockAppendChunk = vi.fn();

    (window as any).electronAPI = {
      startSessionRecording: mockStartSession,
      finishSessionRecording: mockFinishSession,
      appendRecordingChunk: mockAppendChunk
    };

    // Mock getUserMedia
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      configurable: true,
      writable: true
    });

    // Mock MediaRecorder
    class MockMediaRecorder {
      state = "inactive";
      ondataavailable: ((e: any) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported = vi.fn().mockReturnValue(true);
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        if (this.onstop) this.onstop();
      }
    }
    (window as any).MediaRecorder = MockMediaRecorder as any;

    const started = await AudioRecordingService.startRecording();
    expect(started).toBe(true);
    expect(AudioRecordingService.getIsRecording()).toBe(true);
    expect(mockStartSession).toHaveBeenCalled();

    const finalPath = await AudioRecordingService.stopRecording();
    expect(AudioRecordingService.getIsRecording()).toBe(false);
    expect(mockFinishSession).toHaveBeenCalled();
    expect(finalPath).toBe("/tmp/stealth_recording.webm");

    // Clean up
    delete (window as any).electronAPI;
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
  });

  it("triggers electronAPI.openRecordingsFolder when openFolder is called", async () => {
    const mockOpenRecordingsFolder = vi.fn().mockResolvedValue(undefined);
    (window as any).electronAPI = {
      openRecordingsFolder: mockOpenRecordingsFolder
    };

    await AudioRecordingService.openFolder();
    expect(mockOpenRecordingsFolder).toHaveBeenCalled();

    delete (window as any).electronAPI;
  });
});
