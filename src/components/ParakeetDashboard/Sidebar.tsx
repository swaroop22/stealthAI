import React from "react";
import {
  PhoneCall,
  FileText,
  Folder,
  BookOpen,
  Bot,
  FileEdit,
  Camera,
  Plus,
  Sparkles,
  ExternalLink,
  MoreVertical,
  CheckCircle2,
  Sliders,
  Settings,
  Download
} from "lucide-react";

interface SidebarProps {
  activeNav: string;
  onSelectNav: (nav: string) => void;
  onCreateSessionClick: () => void;
  onOpenResumeModal: () => void;
  onOpenSettings: () => void;
  onOpenDownloadModal?: () => void;
  sessionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onSelectNav,
  onCreateSessionClick,
  onOpenResumeModal,
  onOpenSettings,
  onOpenDownloadModal,
  sessionsCount
}) => {
  return (
    <aside className="parakeet-sidebar">
      {/* Top Header Logo */}
      <div className="parakeet-sidebar-header">
        <div className="parakeet-logo-group">
          <div className="parakeet-logo-icon">
            {/* Stealth AI Logo Icon */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

      {/* Big Green Create Session Button */}
      <div className="sidebar-action-wrap">
        <button
          className="btn-parakeet-create"
          onClick={onCreateSessionClick}
          id="btn-sidebar-create-session"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>Create Session</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav-scroll">
        <div className="nav-section-group">
          <span className="nav-section-title">Call Assistant</span>
          <ul className="nav-items-list">
            <li>
              <button
                className={`nav-item-btn ${activeNav === "callSessions" ? "active" : ""}`}
                onClick={() => onSelectNav("callSessions")}
              >
                <PhoneCall size={18} />
                <span className="nav-label">Call Sessions</span>
                {sessionsCount > 0 && <span className="nav-count-pill">{sessionsCount}</span>}
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "resumes" ? "active" : ""}`}
                onClick={() => {
                  onSelectNav("resumes");
                  onOpenResumeModal();
                }}
              >
                <FileText size={18} />
                <span className="nav-label">Resumes</span>
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "documents" ? "active" : ""}`}
                onClick={() => onSelectNav("documents")}
              >
                <Folder size={18} />
                <span className="nav-label">Documents</span>
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "download" ? "active" : ""}`}
                onClick={() => {
                  onSelectNav("download");
                  onOpenDownloadModal?.();
                }}
                id="sidebar-nav-download"
                title="Download StealthAI Native Desktop App for macOS or Windows"
              >
                <Download size={18} />
                <span className="nav-label">Desktop App</span>
                <span className="nav-count-pill badge-green">Mac/Win</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="nav-section-group">
          <span className="nav-section-title">Prepare</span>
          <ul className="nav-items-list">
            <li>
              <button
                className={`nav-item-btn ${activeNav === "questionBank" ? "active" : ""}`}
                onClick={() => onSelectNav("questionBank")}
              >
                <BookOpen size={18} />
                <span className="nav-label">Question Bank</span>
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "mockInterview" ? "active" : ""}`}
                onClick={() => {
                  onSelectNav("mockInterview");
                  onCreateSessionClick();
                }}
              >
                <Bot size={18} />
                <span className="nav-label">Mock Interview</span>
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "resumeMaker" ? "active" : ""}`}
                onClick={() => {
                  onSelectNav("resumeMaker");
                  onOpenResumeModal();
                }}
              >
                <FileEdit size={18} />
                <span className="nav-label">Resume Maker</span>
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${activeNav === "headshots" ? "active" : ""}`}
                onClick={() => onSelectNav("headshots")}
              >
                <Camera size={18} />
                <span className="nav-label">Headshots</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Sidebar Footer / Settings */}
      <div className="sidebar-footer">
        <button
          className="sidebar-settings-btn"
          onClick={onOpenSettings}
          title="Settings & Profile"
          id="btn-sidebar-settings"
        >
          <div className="settings-btn-icon">
            <Settings size={17} />
          </div>
          <div className="settings-btn-text">
            <span className="settings-btn-title">Settings & Profile</span>
            <span className="settings-btn-desc">Configure AI, model & keys</span>
          </div>
        </button>
      </div>
    </aside>
  );
};
