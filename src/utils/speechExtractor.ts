import type { TranscriptItem } from "../types";

export interface ExtractedQuestionResult {
  question: string;
  sourceSpeaker?: string;
  timestamp?: string;
  fullTranscriptText: string;
}

// Common interview question prefixes / starters
const QUESTION_STARTER_REGEX =
  /\b(what\s+is|what\s+are|what\s+would|what\s+does|what\s+do|what\s+happens|whats|what's|what|how\s+would|how\s+do|how\s+does|how\s+to|how\s+can|how\s+did|how\s+is|how|why\s+do|why\s+does|why\s+is|why\s+are|why\s+would|why|can\s+you|could\s+you|would\s+you|will\s+you|tell\s+me|tell\s+us|explain|describe|walk\s+me\s+through|walk\s+us\s+through|design|implement|write\s+a|write\s+code|solve|difference\s+between|compare|distinguish\s+between|which\s+one|when\s+should|is\s+it|are\s+there|do\s+you|have\s+you|give\s+an\s+example|give\s+me)\b/i;

// Conversational filler phrases that commonly trail after a question
const TRAILING_FILLERS = [
  /([,.\s]+|^)(take\s+your\s+time(\s+and\s+think)?)[\s.!?]*$/i,
  /([,.\s]+|^)(please\s+go\s+ahead|go\s+ahead)[\s.!?]*$/i,
  /([,.\s]+|^)(whenever\s+you('re|'re\s+ready|are\s+ready))[\s.!?]*$/i,
  /([,.\s]+|^)(let\s+me\s+know(\s+what\s+you\s+think)?)[\s.!?]*$/i,
  /([,.\s]+|^)(feel\s+free\s+to\s+start)[\s.!?]*$/i,
  /([,.\s]+|^)(yeah|yes|okay|ok|alright|sure|cool|great|thanks|thank\s+you)[\s.!?]*$/i,
];

// Standalone conversational filler turns that should be skipped
const STANDALONE_FILLERS = new Set([
  "yeah", "yes", "yep", "yup", "ok", "okay", "alright", "all right",
  "sure", "cool", "great", "awesome", "perfect", "got it", "i see",
  "makes sense", "thank you", "thanks", "sounds good", "right", "uh-huh",
  "hmm", "hello", "hi", "hey"
]);

function cleanTrailingFillers(text: string): string {
  let cleaned = text.trim();
  let modified = true;
  while (modified) {
    modified = false;
    for (const pattern of TRAILING_FILLERS) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, "").trim();
        modified = true;
      }
    }
  }
  return cleaned;
}

function isStandaloneFiller(text: string): boolean {
  const norm = text.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (STANDALONE_FILLERS.has(norm)) return true;
  if (norm.split(/\s+/).length <= 2 && STANDALONE_FILLERS.has(norm.split(/\s+/)[0])) {
    return true;
  }
  return false;
}

function formatAsQuestion(q: string): string {
  let cleaned = cleanTrailingFillers(q.trim());
  if (!cleaned) return "";

  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // If ends with a period or comma, replace with question mark if question starter
  if (cleaned.endsWith(".") || cleaned.endsWith(",")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  if (!cleaned.endsWith("?") && !cleaned.endsWith("!")) {
    cleaned = cleaned + "?";
  }

  return cleaned;
}

/**
 * Extracts the last question asked from the speech transcript (from the end backwards).
 * Specifically examines the end of speech, skipping pleasantries and trailing fillers,
 * to guarantee that clicking 'Answer' grabs the most recent question spoken.
 */
export function extractLastQuestionFromSpeech(
  transcript: TranscriptItem[],
  liveInterim?: string
): ExtractedQuestionResult {
  const validItems = transcript.filter((t) => t.text && !t.text.trim().startsWith("["));
  const fullTranscriptText = validItems.map((t) => `${t.speaker}: ${t.text}`).join("\n");

  // Build the tail sequence starting from the very latest speech
  const tailTurns: { text: string; speaker: string; timestamp: string }[] = [];

  if (
    liveInterim &&
    liveInterim.trim() &&
    !liveInterim.startsWith("🎤") &&
    !liveInterim.startsWith("⚡") &&
    !liveInterim.startsWith("⚠️")
  ) {
    tailTurns.push({
      text: liveInterim.trim(),
      speaker: "Live Voice",
      timestamp: "Just now"
    });
  }

  // Add the last 6 turns in reverse chronological order (latest first)
  const maxRecent = Math.min(validItems.length, 6);
  for (let i = validItems.length - 1; i >= validItems.length - maxRecent; i--) {
    tailTurns.push({
      text: validItems[i].text.trim(),
      speaker: validItems[i].speaker,
      timestamp: validItems[i].timestamp
    });
  }

  if (tailTurns.length === 0) {
    return { question: "", fullTranscriptText };
  }

  // 1. First pass: Examine turns from the END backwards for explicit questions
  for (const turn of tailTurns) {
    const raw = turn.text.trim();
    if (!raw || isStandaloneFiller(raw)) continue;

    // Split turn into individual sentences/clauses
    const sentences = raw.match(/[^.!?\n]+[.!?\n]*/g) || [raw];

    // Scan sentences in this turn from the end backwards
    for (let sIdx = sentences.length - 1; sIdx >= 0; sIdx--) {
      let sentence = sentences[sIdx].trim();
      if (!sentence || isStandaloneFiller(sentence)) continue;

      // Check if sentence ends with '?'
      if (sentence.includes("?")) {
        // If there are multiple clauses, extract from the question starter or question clause
        const match = sentence.search(QUESTION_STARTER_REGEX);
        const questionPart = match !== -1 ? sentence.slice(match) : sentence;
        return {
          question: formatAsQuestion(questionPart),
          sourceSpeaker: turn.speaker,
          timestamp: turn.timestamp,
          fullTranscriptText
        };
      }

      // Check if sentence starts with or contains a question starter pattern
      const match = sentence.search(QUESTION_STARTER_REGEX);
      if (match !== -1) {
        // Extract from question starter to end of sentence
        const questionPart = sentence.slice(match);
        return {
          question: formatAsQuestion(questionPart),
          sourceSpeaker: turn.speaker,
          timestamp: turn.timestamp,
          fullTranscriptText
        };
      }
    }
  }

  // 2. Second pass: Fallback to the latest substantive spoken phrase from the end
  for (const turn of tailTurns) {
    const raw = turn.text.trim();
    if (!raw || isStandaloneFiller(raw)) continue;

    const sentences = raw.match(/[^.!?\n]+[.!?\n]*/g) || [raw];
    for (let sIdx = sentences.length - 1; sIdx >= 0; sIdx--) {
      const sentence = sentences[sIdx].trim();
      if (!sentence || isStandaloneFiller(sentence)) continue;

      const words = sentence.split(/\s+/).filter(Boolean);
      // If it has at least 3 words and isn't just filler
      if (words.length >= 3) {
        return {
          question: cleanTrailingFillers(sentence),
          sourceSpeaker: turn.speaker,
          timestamp: turn.timestamp,
          fullTranscriptText
        };
      }
    }
  }

  // 3. Absolute fallback: the latest turn text
  const lastTurn = tailTurns[0];
  return {
    question: cleanTrailingFillers(lastTurn?.text || ""),
    sourceSpeaker: lastTurn?.speaker,
    timestamp: lastTurn?.timestamp,
    fullTranscriptText
  };
}
