import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Layers,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Sliders,
  Settings,
  HelpCircle,
  FileText,
  Download
} from "lucide-react";
import type { CallSession, SessionType, CreateSessionInput } from "../../types";
import { Sidebar } from "./Sidebar";
import { SessionCard } from "./SessionCard";
import { CreateSessionModal } from "./CreateSessionModal";
import { SessionDetailModal } from "./SessionDetailModal";
import { DownloadView } from "../DownloadView";

interface CallSessionsDashboardProps {
  sessions: CallSession[];
  activeSession: CallSession | null;
  onCreateSession: (input: CreateSessionInput, launchDirectly: boolean) => void;
  onStartSession: (session: CallSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession: (session: CallSession) => void;
  onSwitchToHUD: () => void;
  onOpenSettings: () => void;
  onOpenResumeModal: () => void;
  onOpenDownloadModal?: () => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
}

export const CallSessionsDashboard: React.FC<CallSessionsDashboardProps> = ({
  sessions,
  activeSession,
  onCreateSession,
  onStartSession,
  onDeleteSession,
  onExportSession,
  onSwitchToHUD,
  onOpenSettings,
  onOpenResumeModal,
  onOpenDownloadModal,
  showToast
}) => {
  const [activeNav, setActiveNav] = useState("callSessions");
  const [filterType, setFilterType] = useState<"All" | SessionType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDetailSession, setSelectedDetailSession] = useState<CallSession | null>(null);

  // Filter sessions by tab and search
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesType = filterType === "All" || s.sessionType === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.company.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.jobDescription && s.jobDescription.toLowerCase().includes(q)) ||
        (s.date && s.date.toLowerCase().includes(q));

      return matchesType && matchesSearch;
    });
  }, [sessions, filterType, searchQuery]);

  return (
    <div className="parakeet-app-layout">
      {/* Top Bar matching screenshot */}
      <header className="parakeet-top-header">
        <div className="top-header-left">
          <div className="parakeet-logo-group">
            <div className="parakeet-logo-icon">
              {/* Stealth AI Shield Logo Icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L3 6V12C3 17.52 6.84 22.74 12 24C17.16 22.74 21 17.52 21 12V6L12 2Z"
                  fill="#16a34a"
                />
                <path
                  d="M12 6L6 9V13.5C6 17.2 8.56 20.68 12 21.6C15.44 20.68 18 17.2 18 13.5V9L12 6Z"
                  fill="#22c55e"
                  opacity="0.35"
                />
                <path
                  d="M9.5 12.5L11.2 14.2L15 10.5"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="parakeet-brand-text">
              <span className="brand-name">Stealth</span>
              <span className="brand-badge">AI</span>
            </div>
          </div>
        </div>

        <div className="top-header-right">
          {activeSession && (
            <button
              className="btn-active-session-pill"
              onClick={() => onStartSession(activeSession)}
              title="Return to currently active session"
            >
              <span className="live-dot pulse"></span>
              <span>Active: {activeSession.company} ({activeSession.role})</span>
            </button>
          )}

          <button
            className="btn-switch-hud"
            onClick={onSwitchToHUD}
            title="Launch Floating Transparent HUD for Screen Share Invisibility"
          >
            <Layers size={15} />
            <span>Floating HUD Mode</span>
          </button>

          <button
            className="btn-top-download"
            onClick={() => {
              if (onOpenDownloadModal) {
                onOpenDownloadModal();
              } else {
                setActiveNav("download");
              }
            }}
            title="Download StealthAI Native Desktop App for macOS or Windows"
            id="btn-top-download-app"
          >
            <Download size={15} />
            <span>Download Desktop</span>
            <span className="btn-download-pill">Mac / Win</span>
          </button>

          <button
            className="btn-header-settings"
            onClick={onOpenSettings}
            title="Settings & AI Model"
            id="btn-header-settings"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>

          <button
            className="btn-top-create-session"
            onClick={() => setIsCreateModalOpen(true)}
            id="btn-top-create-session"
          >
            <span>Create Session</span>
            <ChevronDown size={15} />
          </button>
        </div>
      </header>

      {/* Main Split: Left Sidebar + Right Content */}
      <div className="parakeet-body-wrapper">
        <Sidebar
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          onCreateSessionClick={() => setIsCreateModalOpen(true)}
          onOpenResumeModal={onOpenResumeModal}
          onOpenSettings={onOpenSettings}
          onOpenDownloadModal={onOpenDownloadModal}
          sessionsCount={sessions.length}
        />

        <main className="parakeet-main-content">
          {activeNav === "download" ? (
            <DownloadView showToast={showToast} onSwitchToHUD={onSwitchToHUD} />
          ) : (
            <>
              {/* Dashboard Header */}
          <div className="dashboard-content-header">
            <div>
              <h1 className="dashboard-page-title">Call Sessions</h1>
              <p className="dashboard-page-subtitle">
                Prepare for calls and review past sessions.
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sessions-filter-toolbar">
            <div className="filter-tabs-row">
              {(["All", "Interview", "Regular", "Mock"] as const).map((tab) => {
                const count =
                  tab === "All"
                    ? sessions.length
                    : sessions.filter((s) => s.sessionType === tab).length;

                return (
                  <button
                    key={tab}
                    className={`filter-tab-pill ${filterType === tab ? "active" : ""}`}
                    onClick={() => setFilterType(tab)}
                  >
                    <span>{tab}</span>
                    <span className="filter-count">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="search-sessions-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search by company or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Grid of Sessions Cards */}
          {filteredSessions.length === 0 ? (
            <div className="empty-sessions-card">
              <div className="empty-icon-circle">
                <FileText size={28} className="text-muted" />
              </div>
              <h3>{searchQuery ? "No Matching Sessions Found" : "No Call Sessions Yet"}</h3>
              <p>
                {searchQuery
                  ? "No sessions match your search keyword. Try a different term or clear the filter."
                  : "You don't have any recorded sessions yet. Click '+ Create Session' to configure your job details and start or save a session."}
              </p>
              <button
                className="btn-parakeet-create mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus size={16} />
                <span>Create New Session</span>
              </button>
            </div>
          ) : (
            <div className="parakeet-sessions-grid">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onViewTranscript={(s) => setSelectedDetailSession(s)}
                  onStartSession={onStartSession}
                  onDeleteSession={onDeleteSession}
                  onExportSession={onExportSession}
                />
              ))}
            </div>
          )}
            </>
          )}
        </main>
      </div>

      {/* Create Session Modal */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateSession={(input, launchDirectly) => {
          setIsCreateModalOpen(false);
          onCreateSession(input, launchDirectly);
        }}
        onOpenResumeModal={onOpenResumeModal}
        showToast={showToast}
      />

      {/* Session Details / Transcript Review Modal */}
      <SessionDetailModal
        session={selectedDetailSession}
        isOpen={Boolean(selectedDetailSession)}
        onClose={() => setSelectedDetailSession(null)}
        onResumeSession={onStartSession}
        onExportSession={onExportSession}
        showToast={showToast}
      />
    </div>
  );
};
