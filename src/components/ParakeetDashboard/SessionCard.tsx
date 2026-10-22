import React, { useState } from "react";
import {
  MoreVertical,
  FileText,
  Briefcase,
  Play,
  Trash2,
  Share2,
  Clock,
  Sparkles,
  Phone,
  Monitor
} from "lucide-react";
import type { CallSession } from "../../types";

interface SessionCardProps {
  session: CallSession;
  onViewTranscript: (session: CallSession) => void;
  onStartSession: (session: CallSession, forceModal?: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onExportSession: (session: CallSession) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onViewTranscript,
  onStartSession,
  onDeleteSession,
  onExportSession
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Derive initial logo background color based on company name
  const getCompanyColor = (name: string) => {
    const n = (name || "").toLowerCase();
    if (n.includes("lumen")) return { bg: "#fef08a", color: "#854d0e", border: "#fde047" };
    if (n.includes("beacon")) return { bg: "#e0e7ff", color: "#3730a3", border: "#c7d2fe" };
    if (n.includes("vendor")) return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
    if (n.includes("google")) return { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" };
    if (n.includes("pnc")) return { bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" };
    return { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" };
  };

  const colors = getCompanyColor(session.company);
  const companyInitial = (session.company || "C").charAt(0).toUpperCase();

  return (
    <div className={`parakeet-session-card ${session.status === "Live" ? "is-live" : ""}`}>
      {/* Card Header: Date & Menu */}
      <div className="card-top-row">
        <span className="card-date-label">{session.date || "SEP 9, 2026"}</span>

        <div className="card-menu-wrap">
          <button
            className="btn-card-menu"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            title="Options"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div className="card-dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onStartSession(session);
                }}
              >
                <Play size={14} />
                <span>{session.status === "Live" ? "Join Active Call" : "Launch / Resume Session"}</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onStartSession(session, true);
                }}
              >
                <Monitor size={14} />
                <span>Choose Platform (Desktop / Browser)</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onViewTranscript(session);
                }}
              >
                <FileText size={14} />
                <span>View Transcript & AI Answers</span>
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onExportSession(session);
                }}
              >
                <Share2 size={14} />
                <span>Export Session JSON</span>
              </button>
              <div className="dropdown-divider"></div>
              <button
                className="dropdown-item text-danger"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDeleteSession(session.id);
                }}
              >
                <Trash2 size={14} />
                <span>Delete Session</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Company & Role Details */}
      <div className="card-company-section">
        <div
          className="company-logo-avatar"
          style={{
            backgroundColor: colors.bg,
            color: colors.color,
            borderColor: colors.border
          }}
        >
          {companyInitial}
        </div>
        <div className="company-text-info">
          <h3 className="company-name" title={session.company}>
            {session.company}
          </h3>
          <p className="company-role" title={session.role}>
            {session.role}
          </p>
        </div>
      </div>

      {/* Badges Row */}
      <div className="card-badges-row">
        <span className="badge-tag session-type">
          {session.sessionType === "Interview" && <Briefcase size={12} />}
          {session.sessionType === "Regular" && <Phone size={12} />}
          {session.sessionType === "Mock" && <Sparkles size={12} />}
          <span>{session.sessionType || "Interview"}</span>
        </span>

        {session.transcript && session.transcript.length > 0 && (
          <span className="badge-tag has-transcript">
            <FileText size={12} />
            <span>Transcript</span>
          </span>
        )}
      </div>

      {/* Footer: Status / Duration & View Action */}
      <div className="card-footer-row">
        <div className="status-duration-wrap">
          {session.status === "Live" ? (
            <span className="status-live">
              <span className="live-dot pulse"></span>
              <span className="status-name">Live</span>
              <span className="duration-text">{session.duration || "0m 00s"}</span>
            </span>
          ) : (
            <span className="status-ended">
              <span className="ended-dot"></span>
              <span className="status-name">Ended</span>
              <span className="duration-text">{session.duration || "0m 00s"}</span>
            </span>
          )}
        </div>

        <button
          className="btn-view-transcript"
          onClick={() => onViewTranscript(session)}
        >
          View Transcript
        </button>
      </div>
    </div>
  );
};
