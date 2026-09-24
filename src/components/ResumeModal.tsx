import React, { useState } from "react";
import { X, Upload, FileText, CheckCircle2, Sparkles, Code2, Layers, Award, Trash2, ArrowRight } from "lucide-react";
import type { CandidateProfile } from "../types";
import { ResumeParser } from "../services/resumeParser";

interface Props {
  isOpen: boolean;
  profile: CandidateProfile;
  onSaveProfile: (profile: CandidateProfile) => void;
  onClose: () => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
  onTriggerTestQuestion?: (question: string) => void;
}

export const ResumeModal: React.FC<Props> = ({
  isOpen,
  profile,
  onSaveProfile,
  onClose,
  showToast,
  onTriggerTestQuestion
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [pasteText, setPasteText] = useState(profile.resumeText || "");
  const [parsing, setParsing] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<CandidateProfile>(profile);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const { profile: extracted, rawText } = await ResumeParser.parseFile(file);
      const updated = { ...extracted, resumeFileName: file.name, resumeText: rawText };
      setPreviewProfile(updated);
      setPasteText(rawText);

      // AUTO-COMMIT: Automatically save to persistent storage so it is never lost!
      onSaveProfile(updated);
      showToast(`Parsed and saved ${file.name}! AI has memorized your experience.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to parse file.", "error");
    } finally {
      setParsing(false);
    }
  };

  const handleAnalyzePaste = () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const extracted = ResumeParser.analyzeResumeText(pasteText.trim(), "Pasted Resume Text");
      setPreviewProfile(extracted);

      // AUTO-COMMIT: Automatically save to persistent storage!
      onSaveProfile(extracted);
      showToast("Resume parsed and saved! AI has memorized your background.", "success");
    } finally {
      setParsing(false);
    }
  };

  const handleSaveAndRemember = () => {
    onSaveProfile(previewProfile);
    showToast(`Saved! AI will now personalize all interview answers for ${previewProfile.name}.`, "success");
    onClose();
  };

  const handleClearResume = () => {
    const cleared: CandidateProfile = {
      name: "Candidate",
      targetRole: "Senior Software Engineer",
      yearsExp: "5+ years",
      primaryLanguages: ["TypeScript", "Python", "Java"],
      frameworks: ["React", "Node.js", "Docker", "PostgreSQL"],
      keyProjects: "Distributed web applications and cloud microservices",
      customGuidelines: "Be concise. Prioritize trade-offs and real-world system resilience."
    };
    setPreviewProfile(cleared);
    setPasteText("");
    onSaveProfile(cleared);
    showToast("Resume data cleared.", "info");
  };

  const handleTestIntro = (questionText: string) => {
    onSaveProfile(previewProfile);
    onClose();
    if (onTriggerTestQuestion) {
      onTriggerTestQuestion(questionText);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card resume-modal-card">
        <div className="modal-header">
          <div className="flex-center gap-2">
            <FileText size={20} className="text-accent" />
            <div>
              <h3>Resume & Background Ingestion</h3>
              <p className="modal-subtitle">Upload your resume once, and StealthAI will remember your identity, companies, and metrics in every answer.</p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Method Selector */}
          <div className="resume-tab-selector">
            <button
              className={`resume-tab-btn ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              <Upload size={14} /> Upload Resume File (.pdf, .txt, .md)
            </button>
            <button
              className={`resume-tab-btn ${activeTab === "paste" ? "active" : ""}`}
              onClick={() => setActiveTab("paste")}
            >
              <FileText size={14} /> Paste Resume Text
            </button>
          </div>

          {activeTab === "upload" ? (
            <div className="resume-dropzone-wrapper">
              <label className="resume-dropzone">
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.json,.doc,.docx"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <Upload size={32} className="text-accent mb-2" />
                <span className="dropzone-title">
                  {parsing ? "Parsing Resume Pages with PDF Engine..." : "Click or Drag & Drop Resume Here"}
                </span>
                <span className="dropzone-subtitle">Supported formats: PDF, Plain Text (.txt), Markdown (.md), or JSON</span>
                {previewProfile.resumeFileName && (
                  <span className="current-file-badge">
                    <CheckCircle2 size={13} className="text-success" /> Memorized: {previewProfile.resumeFileName} ({previewProfile.resumeText?.length || 0} characters)
                  </span>
                )}
              </label>
            </div>
          ) : (
            <div className="resume-paste-wrapper">
              <textarea
                rows={6}
                placeholder="Paste your full resume, work experience, or LinkedIn summary here..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button
                className="btn-analyze-paste"
                disabled={!pasteText.trim() || parsing}
                onClick={handleAnalyzePaste}
              >
                <Sparkles size={14} />
                <span>{parsing ? "Analyzing..." : "Parse & Memorize My Experience"}</span>
              </button>
            </div>
          )}

          {/* Quick Test Bar */}
          {previewProfile.resumeText && (
            <div className="resume-test-actions">
              <span className="test-label">Instant Test With Your Resume:</span>
              <button
                className="btn-test-pitch"
                onClick={() => handleTestIntro("Tell me about yourself and your background.")}
              >
                ⚡ Test: "Tell me about yourself" <ArrowRight size={12} />
              </button>
              <button
                className="btn-test-pitch"
                onClick={() => handleTestIntro("Walk me through your resume and key achievements.")}
              >
                ⚡ Test: "Walk me through your resume" <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Extracted Profile Preview */}
          <div className="extracted-profile-card">
            <div className="extracted-header">
              <Sparkles size={16} className="text-accent" />
              <h4>Extracted Candidate Persona (What AI Remembers About You)</h4>
            </div>

            <div className="extracted-grid">
              <div className="extracted-field">
                <label>Candidate Name:</label>
                <input
                  type="text"
                  value={previewProfile.name}
                  onChange={(e) => setPreviewProfile({ ...previewProfile, name: e.target.value })}
                />
              </div>

              <div className="extracted-field">
                <label>Target Role:</label>
                <input
                  type="text"
                  value={previewProfile.targetRole}
                  onChange={(e) => setPreviewProfile({ ...previewProfile, targetRole: e.target.value })}
                />
              </div>

              <div className="extracted-field">
                <label>Years of Experience:</label>
                <input
                  type="text"
                  value={previewProfile.yearsExp}
                  onChange={(e) => setPreviewProfile({ ...previewProfile, yearsExp: e.target.value })}
                />
              </div>
            </div>

            {/* Languages & Frameworks Chips */}
            <div className="skills-block">
              <div className="skills-label">
                <Code2 size={13} />
                <span>Primary Languages Detected:</span>
              </div>
              <div className="chips-row">
                {previewProfile.primaryLanguages.map((lang, idx) => (
                  <span key={idx} className="skill-chip language">{lang}</span>
                ))}
              </div>
            </div>

            <div className="skills-block">
              <div className="skills-label">
                <Layers size={13} />
                <span>Frameworks, Cloud & Databases Detected:</span>
              </div>
              <div className="chips-row">
                {previewProfile.frameworks.map((fw, idx) => (
                  <span key={idx} className="skill-chip framework">{fw}</span>
                ))}
              </div>
            </div>

            {/* Key Achievements & Metrics */}
            <div className="metrics-block">
              <div className="skills-label">
                <Award size={13} />
                <span>Key Quantified Achievements Used in Answers:</span>
              </div>
              <textarea
                rows={3}
                value={previewProfile.keyProjects}
                onChange={(e) => setPreviewProfile({ ...previewProfile, keyProjects: e.target.value })}
                placeholder="Key quantified achievements (e.g., Reduced p99 latency by 45%, managed 20k TPS Kafka pipeline)..."
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {previewProfile.resumeText && (
            <button className="btn-danger-outline" onClick={handleClearResume} title="Clear saved resume">
              <Trash2 size={14} /> Clear Resume
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSaveAndRemember}>
            <CheckCircle2 size={15} /> Save & Remember Me
          </button>
        </div>
      </div>
    </div>
  );
};
