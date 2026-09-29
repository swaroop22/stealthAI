import { describe, it, expect } from "vitest";
import { PRESET_SCENARIOS } from "../../services/presetScenarios";
import type { AssistantMode } from "../../types";

describe("presetScenarios service", () => {
  const validModes: AssistantMode[] = [
    "coding",
    "behavioral",
    "system_design",
    "meeting_notes"
  ];

  it("exports a non-empty list of preset interview scenarios", () => {
    expect(PRESET_SCENARIOS).toBeDefined();
    expect(Array.isArray(PRESET_SCENARIOS)).toBe(true);
    expect(PRESET_SCENARIOS.length).toBeGreaterThan(0);
  });

  it("ensures every scenario has unique IDs", () => {
    const ids = PRESET_SCENARIOS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("ensures each scenario adheres to the PresetScenario schema", () => {
    for (const scenario of PRESET_SCENARIOS) {
      expect(scenario.id).toBeTruthy();
      expect(scenario.title).toBeTruthy();
      expect(scenario.prompt).toBeTruthy();
      expect(scenario.prompt.length).toBeGreaterThan(15);
      expect(validModes).toContain(scenario.mode);
      expect(["Interviewer", "Candidate", "System"]).toContain(scenario.speaker);
    }
  });

  it("includes representative scenarios across coding, behavioral, and system design", () => {
    const modesInPresets = new Set(PRESET_SCENARIOS.map((s) => s.mode));
    expect(modesInPresets.has("coding")).toBe(true);
    expect(modesInPresets.has("behavioral")).toBe(true);
    expect(modesInPresets.has("system_design")).toBe(true);
  });

  it("contains specific high-frequency interview prompts", () => {
    const titles = PRESET_SCENARIOS.map((s) => s.title);
    expect(titles.some((t) => t.includes("LRU Cache"))).toBe(true);
    expect(titles.some((t) => t.includes("Tell me about yourself"))).toBe(true);
    expect(titles.some((t) => t.includes("Distributed API Rate Limiter"))).toBe(true);
    expect(titles.some((t) => t.includes("Binary Search"))).toBe(true);
  });
});
