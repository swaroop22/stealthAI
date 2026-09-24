import type { TranscriptItem } from "../types";

export interface ExtractedQuestionResult {
  question: string;
  sourceSpeaker?: string;
  timestamp?: string;
  fullTranscriptText: string;
}

const QUESTION_PREFIXES = [
  "what",
  "how",
  "why",
  "can you",
  "could you",
  "tell me",
  "explain",
  "describe",
  "walk me through",
  "design",
  "difference between",
  "compare",
  "is it",
  "would you",
  "have you",
  "which",
  "when should",
  "does",
  "do you",
  "give an example",
  "implement",
  "solve"
];

export function extractLastQuestionFromSpeech(
  transcript: TranscriptItem[],
  liveInterim?: string
): ExtractedQuestionResult {
  const validItems = transcript.filter((t) => t.text && !t.text.trim().startsWith("["));
  const fullTranscriptText = validItems.map((t) => `${t.speaker}: ${t.text}`).join("\n");

  const candidates: { text: string; speaker: string; timestamp: string }[] = [];

  if (
    liveInterim &&
    liveInterim.trim() &&
    !liveInterim.startsWith("🎤") &&
    !liveInterim.startsWith("⚡") &&
    !liveInterim.startsWith("⚠️")
  ) {
    candidates.push({ text: liveInterim.trim(), speaker: "Interviewer", timestamp: "Just now" });
  }

  for (let i = validItems.length - 1; i >= 0; i--) {
    candidates.push({
      text: validItems[i].text.trim(),
      speaker: validItems[i].speaker,
      timestamp: validItems[i].timestamp
    });
  }

  if (candidates.length === 0) {
    return { question: "", fullTranscriptText };
  }

  // 1. Scan for sentences ending with '?'
  for (const c of candidates) {
    const sentences = c.text.match(/[^.!?]+[.!?]*/g) || [c.text];
    for (let j = sentences.length - 1; j >= 0; j--) {
      const s = sentences[j].trim();
      if (s.endsWith("?")) {
        return {
          question: s,
          sourceSpeaker: c.speaker,
          timestamp: c.timestamp,
          fullTranscriptText
        };
      }
    }
  }

  // 2. Scan for sentences starting with question keywords
  for (const c of candidates) {
    const sentences = c.text.match(/[^.!?]+[.!?]*/g) || [c.text];
    for (let j = sentences.length - 1; j >= 0; j--) {
      const s = sentences[j].trim();
      const sLower = s.toLowerCase();
      if (QUESTION_PREFIXES.some((prefix) => sLower.startsWith(prefix))) {
        const formatted = s.endsWith("?") ? s : s + "?";
        return {
          question: formatted,
          sourceSpeaker: c.speaker,
          timestamp: c.timestamp,
          fullTranscriptText
        };
      }
    }
  }

  // 3. Fallback: Take the last non-empty utterance
  for (const c of candidates) {
    const clean = c.text.trim();
    if (clean.length > 5) {
      return {
        question: clean,
        sourceSpeaker: c.speaker,
        timestamp: c.timestamp,
        fullTranscriptText
      };
    }
  }

  return { question: candidates[0]?.text || "", fullTranscriptText };
}
