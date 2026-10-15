import React, { useState } from "react";
import {
  X,
  FileText,
  Play,
  Share2,
  Calendar,
  Clock,
  Briefcase,
  User,
  Bot,
  Copy,
  Check,
  Search
} from "lucide-react";
import type { CallSession } from "../../types";

interface SessionDetailModalProps {
  session: CallSession | null;
  isOpen: boolean;
  onClose: () => void;
  onResumeSession: (session: CallSession) => void;
  onExportSession: (session: CallSession) => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  isOpen,
  onClose,
  onResumeSession,
  onExportSession,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<"transcript" | "responses" | "context">("transcript");
  const [searchFilter, setSearchFilter] = useState("");
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen || !session) return null;

  const handleCopyTranscript = () => {
    const text = session.transcript
      .map((t) => `[${t.timestamp}] ${t.speaker}:\n${t.text}\n`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    showToast("Transcript copied to clipboard!", "success");
    setTimeout(() => setHasCopied(false), 2000);
  };

  const filteredTranscript = session.transcript.filter(
    (t) =>
      t.text.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.speaker.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="parakeet-modal-backdrop" onClick={onClose}>
      <div
        className="session-detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="detail-modal-header">
          <div className="detail-header-left">
            <div className="company-badge-circle">
              {session.company.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="detail-title-row">
                <h2 className="detail-company-title">{session.company}</h2>
                <span className="badge-tag session-type">{session.sessionType}</span>
                <span className="badge-status-pill">{session.status}</span>
              </div>
              <p className="detail-role-subtitle">{session.role}</p>
            </div>
          </div>

          <div className="detail-header-right">
            <div className="metadata-pills">
              <span className="meta-pill">
                <Calendar size={13} />
                <span>{session.date}</span>
              </span>
              <span className="meta-pill">
                <Clock size={13} />
                <span>{session.duration}</span>
              </span>
            </div>

            <button className="btn-modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="detail-tab-bar">
          <button
            className={`detail-tab-btn ${activeTab === "transcript" ? "active" : ""}`}
            onClick={() => setActiveTab("transcript")}
          >
            <FileText size={15} />
            <span>Transcript ({session.transcript.length})</span>
          </button>

          <button
            className={`detail-tab-btn ${activeTab === "responses" ? "active" : ""}`}
            onClick={() => setActiveTab("responses")}
          >
            <Bot size={15} />
            <span>AI Solutions ({session.responses.length})</span>
          </button>

          <button
            className={`detail-tab-btn ${activeTab === "context" ? "active" : ""}`}
            onClick={() => setActiveTab("context")}
          >
            <Briefcase size={15} />
            <span>Job &amp; Context</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="detail-modal-body">
          {activeTab === "transcript" && (
            <div className="tab-pane-transcript">
              <div className="transcript-toolbar">
                <div className="transcript-search-box">
                  <Search size={14} className="text-muted" />
                  <input
                    type="text"
                    placeholder="Search dialogue words..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                {session.transcript.length > 0 && (
                  <button className="btn-copy-transcript" onClick={handleCopyTranscript}>
                    {hasCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{hasCopied ? "Copied" : "Copy Transcript"}</span>
                  </button>
                )}
              </div>

              {session.transcript.length === 0 ? (
                <div className="empty-state-notice">
                  <p>No audio transcribed for this session yet.</p>
                </div>
              ) : (
                <div className="transcript-turns-list">
                  {filteredTranscript.map((turn) => (
                    <div
                      key={turn.id}
                      className={`dialogue-bubble ${
                        turn.speaker === "Interviewer" ? "speaker-interviewer" : "speaker-candidate"
                      }`}
                    >
                      <div className="turn-meta-header">
                        <span className="speaker-pill">
                          {turn.speaker === "Interviewer" ? <User size={12} /> : <Bot size={12} />}
                          <span>{turn.speaker}</span>
                        </span>
                        <span className="turn-timestamp">{turn.timestamp}</span>
                      </div>
                      <p className="turn-text-content">{turn.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "responses" && (
            <div className="tab-pane-responses">
              {session.responses.length === 0 ? (
                <div className="empty-state-notice">
                  <p>No AI solutions recorded during this call.</p>
                </div>
              ) : (
                <div className="solutions-list">
                  {session.responses.map((resp) => (
                    <div key={resp.id} className="solution-record-card">
                      <div className="solution-header">
                        <span className="prompt-badge">Question Asked</span>
                        <span className="solution-time">{resp.timestamp}</span>
                      </div>
                      <h4 className="solution-prompt-title">"{resp.prompt}"</h4>
                      <div className="solution-markdown-body">
                        <pre className="solution-pre-code">{resp.content}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "context" && (
            <div className="tab-pane-context">
              <div className="context-detail-card">
                <h4 className="context-card-title">Attached Resume</h4>
                <p className="context-card-value">
                  {session.resumeFileName ? `📄 ${session.resumeFileName}` : "No resume attached"}
                </p>
                {session.resumeText && (
                  <div className="resume-snippet-preview">
                    <pre>{session.resumeText.slice(0, 1000)}...</pre>
                  </div>
                )}
              </div>

              <div className="context-detail-card">
                <h4 className="context-card-title">Job Description &amp; Requirements</h4>
                <div className="jd-preview-box">
                  <p>{session.jobDescription || "No job description provided."}</p>
                </div>
              </div>

              {session.preferences?.customInstructions && (
                <div className="context-detail-card">
                  <h4 className="context-card-title">Specific Directives</h4>
                  <p className="context-card-value">{session.preferences.customInstructions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="detail-modal-footer">
          <button
            className="btn-export-detail"
            onClick={() => onExportSession(session)}
          >
            <Share2 size={15} />
            <span>Export Session JSON</span>
          </button>

          <div className="footer-right-buttons">
            <button className="btn-modal-cancel" onClick={onClose}>
              Close
            </button>
            <button
              className="btn-modal-start"
              onClick={() => {
                onClose();
                onResumeSession(session);
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>Launch / Resume Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
