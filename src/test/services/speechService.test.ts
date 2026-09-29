import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpeechService } from "../../services/speechService";
import type { SpeakerType } from "../../types";

describe("SpeechService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("checks platform speech support", () => {
    const supported = SpeechService.isSupported();
    expect(typeof supported).toBe("boolean");
  });

  it("updates and retrieves active speaker", () => {
    SpeechService.setSpeaker("Interviewer");
    expect(SpeechService.getSpeaker()).toBe("Interviewer");

    SpeechService.setSpeaker("Candidate");
    expect(SpeechService.getSpeaker()).toBe("Candidate");

    SpeechService.setSpeaker("System");
    expect(SpeechService.getSpeaker()).toBe("System");
  });

  it("configures API key and AI config without throwing", () => {
    expect(() => {
      SpeechService.setApiKey("test-api-key");
      SpeechService.setAIConfig({ provider: "gemini", apiKey: "test-api-key" });
    }).not.toThrow();
  });

  it("returns 0 audio level when idle or without active analyser", () => {
    const level = SpeechService.getAudioLevel();
    expect(level).toBe(0);
  });

  it("handles stopListening safely when not actively listening", async () => {
    expect(() => {
      SpeechService.stopListening();
    }).not.toThrow();
  });
});
