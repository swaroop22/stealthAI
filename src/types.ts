export type SpeakerType = "Interviewer" | "Candidate" | "System";

export interface TranscriptItem {
  id: string;
  timestamp: string;
  speaker: SpeakerType;
  text: string;
  isInterim?: boolean;
}

export type AssistantMode = "coding" | "behavioral" | "system_design" | "meeting_notes";

export interface CandidateProfile {
  name: string;
  targetRole: string;
  yearsExp: string;
  primaryLanguages: string[];
  frameworks: string[];
  keyProjects: string;
  customGuidelines: string;
  resumeText?: string;
  resumeFileName?: string;
  resumeParsedAt?: string;
  keyMetrics?: string[];
  pastCompanies?: string[];
}

export interface ScreenSnippet {
  id: string;
  dataUrl: string;
  timestamp: string;
  detectedText?: string;
  note?: string;
}

export interface AIResponse {
  id: string;
  mode: AssistantMode;
  timestamp: string;
  prompt: string;
  content: string;
  isStreaming: boolean;
  tokensGenerated: number;
}

export interface ConsentAudit {
  granted: boolean;
  timestamp: string | null;
  participantNoticeAcknowledged: boolean;
  localOnlyMode: boolean;
}

export interface PresetScenario {
  id: string;
  title: string;
  mode: AssistantMode;
  speaker: SpeakerType;
  prompt: string;
  sampleCodeSnippet?: string;
}
