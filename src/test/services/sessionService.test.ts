import { describe, it, expect, beforeEach } from "vitest";
import { SessionService, SEED_SESSIONS } from "../../services/sessionService";

describe("SessionService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array initially with zero dummy sessions", () => {
    const sessions = SessionService.getAllSessions();
    expect(sessions).toEqual([]);
    expect(SEED_SESSIONS).toEqual([]);
  });

  it("automatically scrubs legacy dummy sessions from localStorage", () => {
    localStorage.setItem(
      "stealthai_call_sessions",
      JSON.stringify([
        { id: "session-lumen-db", company: "Lumen", role: "Senior Database Engineer" },
        { id: "session-beacon-etl", company: "Beacon", role: "ETL Data Engineer" },
        { id: "session-real-1", company: "Real Company", role: "Software Engineer" }
      ])
    );

    const sessions = SessionService.getAllSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].company).toBe("Real Company");
    expect(sessions.find((s) => s.company === "Lumen")).toBeUndefined();
    expect(sessions.find((s) => s.company === "Beacon")).toBeUndefined();
  });

  it("creates a new session and persists to localStorage", () => {
    const created = SessionService.createSession({
      sessionType: "Interview",
      company: "Google",
      role: "Staff Infrastructure Engineer",
      jobDescription: "Distributed consensus, Spanner, high throughput systems",
      resumeFileName: "Candidate_Profile.pdf",
      preferences: {
        mode: "system_design",
        autoAnswer: true
      }
    });

    expect(created.id).toBeDefined();
    expect(created.company).toBe("Google");
    expect(created.resumeFileName).toBe("Candidate_Profile.pdf");
    expect(created.status).toBe("Ready");
    expect(created.preferences.mode).toBe("system_design");

    const fetched = SessionService.getSession(created.id);
    expect(fetched).toBeDefined();
    expect(fetched?.company).toBe("Google");
  });

  it("updates an existing session", () => {
    const created = SessionService.createSession({
      sessionType: "Regular",
      company: "Stripe",
      role: "Payments Architect",
      jobDescription: "Idempotent payment rails"
    });

    const updated = SessionService.updateSession(created.id, {
      status: "Live",
      duration: "02:15"
    });

    expect(updated.status).toBe("Live");
    expect(updated.duration).toBe("02:15");
  });

  it("ends session and calculates duration correctly", () => {
    const created = SessionService.createSession({
      sessionType: "Interview",
      company: "Netflix",
      jobDescription: "Video delivery microservices"
    });

    const ended = SessionService.endSession(
      created.id,
      4118,
      [{ id: "t1", speaker: "Interviewer", text: "Welcome", timestamp: "10:00" }],
      [{ id: "r1", mode: "coding", timestamp: "10:01", prompt: "Explain yourself", content: "I am ready", isStreaming: false, tokensGenerated: 10 }]
    );

    expect(ended.status).toBe("Ended");
    expect(ended.duration).toBe("1h 8m 38s");
    expect(ended.transcript.length).toBe(1);
    expect(ended.responses.length).toBe(1);
  });

  it("deletes a session", () => {
    const created = SessionService.createSession({
      sessionType: "Mock",
      company: "Meta",
      jobDescription: "React compiler internals"
    });

    const success = SessionService.deleteSession(created.id);
    expect(success).toBe(true);

    const fetched = SessionService.getSession(created.id);
    expect(fetched).toBeUndefined();
  });

  it("formats durations accurately", () => {
    expect(SessionService.formatDuration(0)).toBe("0m 00s");
    expect(SessionService.formatDuration(29)).toBe("0m 29s");
    expect(SessionService.formatDuration(544)).toBe("9m 04s");
    expect(SessionService.formatDuration(4118)).toBe("1h 8m 38s");
  });

  it("provides empty available resumes by default and allows adding new resume", () => {
    const resumes = SessionService.getAvailableResumes();
    expect(resumes).toEqual([]);

    const added = SessionService.addResume({
      name: "Custom_Resume.pdf",
      size: "200 KB",
      text: "Custom candidate details"
    });

    expect(added.id).toBeDefined();
    const updated = SessionService.getAvailableResumes();
    expect(updated.length).toBe(1);
    expect(updated.find((r) => r.name === "Custom_Resume.pdf")).toBeDefined();
  });

  it("automatically scrubs legacy dummy resumes from localStorage", () => {
    localStorage.setItem(
      "stealthai_available_resumes",
      JSON.stringify([
        { id: "resume-samatha", name: "Samatha_D.pdf" },
        { id: "resume-alex", name: "Alex_Morgan_Systems.pdf" },
        { id: "resume-user-1", name: "MyRealResume.pdf" }
      ])
    );
    const resumes = SessionService.getAvailableResumes();
    expect(resumes.length).toBe(1);
    expect(resumes[0].name).toBe("MyRealResume.pdf");
    expect(resumes.find((r) => r.name === "Samatha_D.pdf")).toBeUndefined();
  });
});
