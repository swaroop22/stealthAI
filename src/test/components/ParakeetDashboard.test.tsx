import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CallSessionsDashboard } from "../../components/ParakeetDashboard/CallSessionsDashboard";
import { CreateSessionModal } from "../../components/ParakeetDashboard/CreateSessionModal";
import { SessionCard } from "../../components/ParakeetDashboard/SessionCard";
import { SEED_SESSIONS } from "../../services/sessionService";
import type { CallSession } from "../../types";

const TEST_MOCK_SESSION: CallSession = {
  id: "session-test-lumen",
  sessionType: "Interview",
  company: "Lumen",
  role: "Senior Database Engineer",
  jobDescription: "Architect, optimize, and maintain PostgreSQL databases.",
  resumeFileName: "Samatha_D.pdf",
  date: "SEP 9, 2026",
  createdAt: "2026-09-09T14:15:00Z",
  endedAt: "2026-09-09T15:23:38Z",
  status: "Ended",
  duration: "1h 8m 38s",
  durationSeconds: 4118,
  transcript: [
    {
      id: "tr-test-1",
      timestamp: "02:15 PM",
      speaker: "Interviewer",
      text: "Diagnose PostgreSQL latency"
    }
  ],
  responses: [],
  preferences: {
    mode: "system_design",
    autoAnswer: true
  }
};

const TEST_BEACON_SESSION: CallSession = {
  id: "session-test-beacon",
  sessionType: "Interview",
  company: "Beacon",
  role: "ETL Data Engineer",
  jobDescription: "Pipelines with Kafka and Snowflake",
  resumeFileName: "Samatha_D.pdf",
  date: "SEP 9, 2026",
  createdAt: "2026-09-09T09:30:00Z",
  endedAt: "2026-09-09T09:39:04Z",
  status: "Ended",
  duration: "9m 4s",
  durationSeconds: 544,
  transcript: [],
  responses: [],
  preferences: {
    mode: "coding",
    autoAnswer: true
  }
};

describe("Stealth AI Call Sessions Components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("<SessionCard />", () => {
    it("renders company, role, badges, and duration", () => {
      const onViewTranscript = vi.fn();
      const onStartSession = vi.fn();
      const onDeleteSession = vi.fn();
      const onExportSession = vi.fn();

      render(
        <SessionCard
          session={TEST_MOCK_SESSION}
          onViewTranscript={onViewTranscript}
          onStartSession={onStartSession}
          onDeleteSession={onDeleteSession}
          onExportSession={onExportSession}
        />
      );

      expect(screen.getByText("Lumen")).toBeInTheDocument();
      expect(screen.getByText("Senior Database Engineer")).toBeInTheDocument();
      expect(screen.getByText("1h 8m 38s")).toBeInTheDocument();
      expect(screen.getByText("View Transcript")).toBeInTheDocument();

      fireEvent.click(screen.getByText("View Transcript"));
      expect(onViewTranscript).toHaveBeenCalledWith(TEST_MOCK_SESSION);
    });
  });

  describe("<CreateSessionModal />", () => {
    it("renders modal header, session type buttons, and form inputs", () => {
      const onClose = vi.fn();
      const onCreate = vi.fn();
      const onOpenResume = vi.fn();
      const showToast = vi.fn();

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={onClose}
          onCreateSession={onCreate}
          onOpenResumeModal={onOpenResume}
          showToast={showToast}
        />
      );

      expect(screen.getByText("Create Interview Session")).toBeInTheDocument();
      expect(screen.getByText("Interview")).toBeInTheDocument();
      expect(screen.getByText("Regular")).toBeInTheDocument();
      expect(screen.getByText("Mock")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter company name")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter job description")).toBeInTheDocument();
    });

    it("displays validation tooltip when Next is clicked with empty inputs", () => {
      const onClose = vi.fn();
      const onCreate = vi.fn();
      const onOpenResume = vi.fn();
      const showToast = vi.fn();

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={onClose}
          onCreateSession={onCreate}
          onOpenResumeModal={onOpenResume}
          showToast={showToast}
        />
      );

      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Please fill out this field.")).toBeInTheDocument();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it("advances to Preferences step when valid details are provided", () => {
      const onClose = vi.fn();
      const onCreate = vi.fn();
      const onOpenResume = vi.fn();
      const showToast = vi.fn();

      render(
        <CreateSessionModal
          isOpen={true}
          onClose={onClose}
          onCreateSession={onCreate}
          onOpenResumeModal={onOpenResume}
          showToast={showToast}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("Enter company name"), {
        target: { value: "Amazon" }
      });
      fireEvent.change(screen.getByPlaceholderText("Enter job description"), {
        target: { value: "AWS Lambda and serverless event processing" }
      });

      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Session Preferences")).toBeInTheDocument();
      expect(screen.getByText("Coding & Algorithms")).toBeInTheDocument();
      expect(screen.getByText("Start Session")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Start Session"));
      expect(onCreate).toHaveBeenCalled();
    });

    it("displays 'No resume uploaded' option and allows uploading new resume", () => {
      render(
        <CreateSessionModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateSession={vi.fn()}
          onOpenResumeModal={vi.fn()}
          showToast={vi.fn()}
        />
      );

      expect(screen.getByText("No resume uploaded")).toBeInTheDocument();
      expect(screen.getByText("+ Upload New Resume...")).toBeInTheDocument();
      expect(screen.queryByText("Samatha_D.pdf")).not.toBeInTheDocument();
      expect(screen.queryByText("Alex_Morgan_Systems.pdf")).not.toBeInTheDocument();
    });
  });

  describe("<CallSessionsDashboard />", () => {
    const testSessions = [TEST_MOCK_SESSION, TEST_BEACON_SESSION];

    it("renders top bar with Stealth AI brand and Call Sessions header", () => {
      const onCreate = vi.fn();
      const onStart = vi.fn();
      const onDelete = vi.fn();
      const onExport = vi.fn();
      const onSwitchToHUD = vi.fn();
      const onOpenSettings = vi.fn();
      const onOpenResume = vi.fn();
      const showToast = vi.fn();

      render(
        <CallSessionsDashboard
          sessions={testSessions}
          activeSession={null}
          onCreateSession={onCreate}
          onStartSession={onStart}
          onDeleteSession={onDelete}
          onExportSession={onExport}
          onSwitchToHUD={onSwitchToHUD}
          onOpenSettings={onOpenSettings}
          onOpenResumeModal={onOpenResume}
          showToast={showToast}
        />
      );

      expect(screen.getAllByText("Stealth").length).toBeGreaterThan(0);
      expect(screen.getByRole("heading", { name: "Call Sessions" })).toBeInTheDocument();
      expect(screen.getByText("Prepare for calls and review past sessions.")).toBeInTheDocument();
      expect(screen.getByText("Lumen")).toBeInTheDocument();
      expect(screen.getByText("Beacon")).toBeInTheDocument();
    });

    it("renders clean empty state with 'No Call Sessions Yet' when sessions list is empty", () => {
      render(
        <CallSessionsDashboard
          sessions={[]}
          activeSession={null}
          onCreateSession={vi.fn()}
          onStartSession={vi.fn()}
          onDeleteSession={vi.fn()}
          onExportSession={vi.fn()}
          onSwitchToHUD={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenResumeModal={vi.fn()}
          showToast={vi.fn()}
        />
      );

      expect(screen.getByText("No Call Sessions Yet")).toBeInTheDocument();
      expect(screen.getByText("Create New Session")).toBeInTheDocument();
      expect(screen.queryByText("Lumen")).not.toBeInTheDocument();
    });

    it("filters sessions by search keyword", () => {
      render(
        <CallSessionsDashboard
          sessions={testSessions}
          activeSession={null}
          onCreateSession={vi.fn()}
          onStartSession={vi.fn()}
          onDeleteSession={vi.fn()}
          onExportSession={vi.fn()}
          onSwitchToHUD={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenResumeModal={vi.fn()}
          showToast={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText("Search by company or role...");
      fireEvent.change(searchInput, { target: { value: "Beacon" } });

      expect(screen.getByText("Beacon")).toBeInTheDocument();
      expect(screen.queryByText("Lumen")).not.toBeInTheDocument();
    });

    it("triggers onOpenDownloadModal when Download Desktop button is clicked", () => {
      const onOpenDownloadModal = vi.fn();
      render(
        <CallSessionsDashboard
          sessions={testSessions}
          activeSession={null}
          onCreateSession={vi.fn()}
          onStartSession={vi.fn()}
          onDeleteSession={vi.fn()}
          onExportSession={vi.fn()}
          onSwitchToHUD={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenResumeModal={vi.fn()}
          onOpenDownloadModal={onOpenDownloadModal}
          showToast={vi.fn()}
        />
      );

      const downloadBtn = screen.getByRole("button", { name: /Download Desktop/i });
      fireEvent.click(downloadBtn);

      expect(onOpenDownloadModal).toHaveBeenCalledTimes(1);
    });
  });
});
