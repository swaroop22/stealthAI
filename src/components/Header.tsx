import React from "react";
import { ShieldCheck, Settings, Download, Activity, FileText } from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import type { ConsentAudit, CandidateProfile } from "../types";

interface Props {
  isCapturing: boolean;
  consent: ConsentAudit;
  profile: CandidateProfile;
  onOpenResumeModal: () => void;
  onOpenSettings: () => void;
  onExport: () => void;
}

export const Header: React.FC<Props> = ({
  isCapturing,
  profile,
  onOpenResumeModal,
  onOpenSettings,
  onExport
}) => {
  const hasResume = Boolean(profile.resumeText && profile.resumeText.length > 20);

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-badge">
          <Activity size={22} className="logo-icon" />
        </div>
        <div>
          <div className="brand-title-row">
            <h1>StealthAI</h1>
            <span className="version-pill">v1.3 Grounded Edition</span>
          </div>
          <p className="brand-tagline">
            Consented Real-Time Meeting, Coding & Resume-Grounded Technical Companion
          </p>
        </div>
      </div>

      <div className="header-center">
        <div className={`status-indicator-badge ${isCapturing ? "active" : "idle"}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isCapturing ? "CAPTURING AUDIO (VISIBLE)" : "ASSISTANT STANDBY"}
          </span>
        </div>
        <AudioVisualizer isActive={isCapturing} />
      </div>

      <div className="header-right">
        {/* Resume Button with Live Ingestion Status */}
        <button
          className={`btn-resume-header ${hasResume ? "ingested" : "empty"}`}
          onClick={onOpenResumeModal}
          title={hasResume ? "Click to view or update your ingested resume" : "Upload your resume so the AI knows your background and metrics"}
        >
          <FileText size={15} />
          <span>
            {hasResume
              ? `Resume: ${profile.name || "Candidate"} (${profile.targetRole || "Engineer"})`
              : "📄 Upload Resume & Remember Me"}
          </span>
        </button>

        <div className="compliance-tag" title="Visible session with participant notice">
          <ShieldCheck size={15} />
          <span>Consent Verified</span>
        </div>

        <button className="btn-header-action" onClick={onExport} title="Export notes">
          <Download size={16} />
        </button>

        <button className="btn-header-action" onClick={onOpenSettings} title="Settings & Candidate Profile">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
