import type { PresetScenario } from "../types";

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "resume-pitch",
    title: "Resume: Tell me about yourself",
    mode: "behavioral",
    speaker: "Interviewer",
    prompt: "Tell me about yourself, your background, and walk me through your resume."
  },
  {
    id: "resume-experience",
    title: "Resume: Walk me through your projects",
    mode: "behavioral",
    speaker: "Interviewer",
    prompt: "Can you walk me through your past projects, what you built, and your key achievements?"
  },
  {
    id: "algo-lru",
    title: "Coding: Design LRU Cache (O(1) get & put)",
    mode: "coding",
    speaker: "Interviewer",
    prompt: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) time complexity for both get and put operations."
  },
  {
    id: "algo-binarysearch",
    title: "Coding: Binary Search in Sorted Array",
    mode: "coding",
    speaker: "Interviewer",
    prompt: "Implement binary search to find a target value in a sorted array with logarithmic time complexity."
  },
  {
    id: "behav-conflict",
    title: "Behavioral: Disagreement with Tech Lead",
    mode: "behavioral",
    speaker: "Interviewer",
    prompt: "Tell me about a time you strongly disagreed with a senior engineer or product manager on an architectural decision. How did you handle it and what was the outcome?"
  },
  {
    id: "sys-ratelimit",
    title: "System Design: Distributed API Rate Limiter",
    mode: "system_design",
    speaker: "Interviewer",
    prompt: "Design a distributed rate limiter service that protects our public API gateway from abuse with sub-millisecond overhead."
  }
];
