import type { CallSession, CreateSessionInput, TranscriptItem, AIResponse, SessionType } from "../types";

const STORAGE_KEY = "stealthai_call_sessions";
const RESUMES_STORAGE_KEY = "stealthai_available_resumes";
const DOCUMENTS_STORAGE_KEY = "stealthai_available_documents";

export interface ResumeOption {
  id: string;
  name: string;
  size: string;
  text?: string;
  uploadedAt: string;
}

export interface DocumentOption {
  id: string;
  name: string;
  size: string;
  description?: string;
  uploadedAt: string;
}

export const DEFAULT_RESUMES: ResumeOption[] = [];
export const DEFAULT_DOCUMENTS: DocumentOption[] = [];

// No dummy/mock sessions - only real user-created sessions are displayed
export const SEED_SESSIONS: CallSession[] = [];

const DUMMY_SESSION_IDS = new Set([
  "session-lumen-db",
  "session-vendor-team-lead",
  "session-beacon-etl",
  "session-vendor-sr-eng",
  "session-vendor-arch",
  "session-vendor-lead"
]);

function isDummySession(session: CallSession): boolean {
  if (!session || !session.id) return false;
  if (DUMMY_SESSION_IDS.has(session.id)) return true;
  if (
    session.id.startsWith("session-lumen") ||
    session.id.startsWith("session-beacon") ||
    session.id.startsWith("session-vendor") ||
    session.id.startsWith("session-va-") ||
    session.id.startsWith("session-seed-")
  ) {
    return true;
  }
  return false;
}

export class SessionService {
  public static getAllSessions(): CallSession[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out any legacy dummy/seed sessions so users only see real sessions
          const cleanSessions = parsed.filter((s: CallSession) => !isDummySession(s));
          if (cleanSessions.length !== parsed.length) {
            this.saveAllSessions(cleanSessions);
          }
          return cleanSessions;
        }
      }
    } catch (e) {
      console.warn("Failed to load sessions from storage:", e);
    }

    return [];
  }

  public static getSession(id: string): CallSession | undefined {
    const list = this.getAllSessions();
    return list.find((s) => s.id === id);
  }

  public static saveAllSessions(sessions: CallSession[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to persist sessions:", e);
    }
  }

  public static clearAllSessions(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error("Failed to clear sessions:", e);
    }
  }

  public static createSession(input: CreateSessionInput): CallSession {
    const list = this.getAllSessions();
    const now = new Date();
    const formattedDate = this.formatDate(now);

    const newSession: CallSession = {
      id: "session-" + crypto.randomUUID(),
      sessionType: input.sessionType || "Interview",
      company: input.company.trim(),
      role: input.role?.trim() || "Technical Candidate",
      jobDescription: input.jobDescription.trim(),
      resumeFileName: input.resumeFileName,
      resumeText: input.resumeText,
      documentName: input.documentName,
      date: formattedDate,
      createdAt: now.toISOString(),
      status: "Ready",
      duration: "0m 00s",
      durationSeconds: 0,
      transcript: [],
      responses: [],
      preferences: {
        mode: input.preferences?.mode || "coding",
        autoAnswer: input.preferences?.autoAnswer ?? true,
        aiProvider: input.preferences?.aiProvider || "gemini",
        model: input.preferences?.model || "gemini-3.8-flash",
        customInstructions: input.preferences?.customInstructions || ""
      }
    };

    const updated = [newSession, ...list];
    this.saveAllSessions(updated);
    return newSession;
  }

  public static updateSession(id: string, updates: Partial<CallSession>): CallSession {
    const list = this.getAllSessions();
    let updatedSession: CallSession | undefined;

    const updatedList = list.map((s) => {
      if (s.id === id) {
        updatedSession = { ...s, ...updates };
        return updatedSession;
      }
      return s;
    });

    if (!updatedSession) {
      throw new Error(`Session with id ${id} not found`);
    }

    this.saveAllSessions(updatedList);
    return updatedSession;
  }

  public static endSession(
    id: string,
    durationSeconds: number,
    transcript: TranscriptItem[],
    responses: AIResponse[]
  ): CallSession {
    const duration = this.formatDuration(durationSeconds);
    return this.updateSession(id, {
      status: "Ended",
      endedAt: new Date().toISOString(),
      durationSeconds,
      duration,
      transcript,
      responses
    });
  }

  public static deleteSession(id: string): boolean {
    const list = this.getAllSessions();
    const filtered = list.filter((s) => s.id !== id);
    if (filtered.length !== list.length) {
      this.saveAllSessions(filtered);
      return true;
    }
    return false;
  }

  public static getAvailableResumes(): ResumeOption[] {
    try {
      const stored = localStorage.getItem(RESUMES_STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Scrub any legacy dummy mock resumes
          const clean = parsed.filter(
            (r: ResumeOption) =>
              r &&
              r.id !== "resume-samatha" &&
              r.id !== "resume-alex" &&
              r.name !== "Samatha_D.pdf" &&
              r.name !== "Alex_Morgan_Systems.pdf"
          );
          if (clean.length !== parsed.length) {
            localStorage.setItem(RESUMES_STORAGE_KEY, JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn("Failed to load resumes:", e);
    }
    return [];
  }

  public static addResume(resume: Omit<ResumeOption, "id" | "uploadedAt">): ResumeOption {
    const list = this.getAvailableResumes();
    const newResume: ResumeOption = {
      ...resume,
      id: "resume-" + crypto.randomUUID(),
      uploadedAt: new Date().toISOString()
    };
    const updated = [newResume, ...list];
    localStorage.setItem(RESUMES_STORAGE_KEY, JSON.stringify(updated));
    return newResume;
  }

  public static clearAllResumes(): void {
    try {
      localStorage.setItem(RESUMES_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error("Failed to clear resumes:", e);
    }
  }

  public static getAvailableDocuments(): DocumentOption[] {
    try {
      const stored = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Scrub any legacy dummy mock documents
          const clean = parsed.filter(
            (d: DocumentOption) =>
              d &&
              d.id !== "doc-pnc" &&
              d.id !== "doc-interview-prep" &&
              d.name !== "PNC_Lakehouse_Architecture_Notes.pdf" &&
              d.name !== "System_Design_Cheatsheet.pdf"
          );
          if (clean.length !== parsed.length) {
            localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn("Failed to load documents:", e);
    }
    return [];
  }

  public static addDocument(doc: Omit<DocumentOption, "id" | "uploadedAt">): DocumentOption {
    const list = this.getAvailableDocuments();
    const newDoc: DocumentOption = {
      ...doc,
      id: "doc-" + crypto.randomUUID(),
      uploadedAt: new Date().toISOString()
    };
    const updated = [newDoc, ...list];
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(updated));
    return newDoc;
  }

  public static clearAllDocuments(): void {
    try {
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error("Failed to clear documents:", e);
    }
  }

  public static formatDuration(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds < 0) return "0m 00s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds < 10 ? "0" : ""}${seconds}s`;
  }

  public static formatDate(date: Date): string {
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }
}
