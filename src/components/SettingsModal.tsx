import React, { useState } from "react";
import { X, User, Key, Shield, Check } from "lucide-react";
import { CandidateProfile, ConsentAudit } from "../types";

interface Props {
  isOpen: boolean;
  profile: CandidateProfile;
  apiKey: string;
  consent: ConsentAudit;
  onSaveProfile: (profile: CandidateProfile) => void;
  onSaveApiKey: (key: string) => void;
  onSaveConsent: (consent: ConsentAudit) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  profile,
  apiKey,
  consent,
  onSaveProfile,
  onSaveApiKey,
  onSaveConsent,
  onClose
}) => {
  if (!isOpen) return null;

  const [localProfile, setLocalProfile] = useState<CandidateProfile>(profile);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localConsent, setLocalConsent] = useState<ConsentAudit>(consent);
  const [savedAlert, setSavedAlert] = useState(false);

  const handleSave = () => {
    onSaveProfile(localProfile);
    onSaveApiKey(localApiKey);
    onSaveConsent(localConsent);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Settings & Candidate Profile</h3>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Section 1: Candidate Profile Context */}
          <div className="settings-section">
            <div className="section-title">
              <User size={16} className="text-accent" />
              <h4>Candidate Profile (Prompt Context)</h4>
            </div>
            <p className="section-desc">
              This context is automatically injected into prompts to personalize technical answers, STAR metrics, and architecture trade-offs.
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={localProfile.name}
                  onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Target Role</label>
                <input
                  type="text"
                  value={localProfile.targetRole}
                  onChange={(e) => setLocalProfile({ ...localProfile, targetRole: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="text"
                  value={localProfile.yearsExp}
                  onChange={(e) => setLocalProfile({ ...localProfile, yearsExp: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Primary Languages (comma separated)</label>
                <input
                  type="text"
                  value={localProfile.primaryLanguages.join(", ")}
                  onChange={(e) =>
                    setLocalProfile({
                      ...localProfile,
                      primaryLanguages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    })
                  }
                />
              </div>

              <div className="form-group full-width">
                <label>Frameworks & Cloud Stack</label>
                <input
                  type="text"
                  value={localProfile.frameworks.join(", ")}
                  onChange={(e) =>
                    setLocalProfile({
                      ...localProfile,
                      frameworks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    })
                  }
                />
              </div>

              <div className="form-group full-width">
                <label>Key Architectural Projects & Achievements</label>
                <textarea
                  rows={2}
                  value={localProfile.keyProjects}
                  onChange={(e) => setLocalProfile({ ...localProfile, keyProjects: e.target.value })}
                  placeholder="e.g., Designed Kafka payment outbox pipeline handling 20k TPS; reduced database read contention using Redis cluster."
                />
              </div>
            </div>
          </div>

          {/* Section 2: AI Engine & API Key */}
          <div className="settings-section">
            <div className="section-title">
              <Key size={16} className="text-accent" />
              <h4>LLM Backend Configuration</h4>
            </div>
            <p className="section-desc">
              By default, StealthAI uses a built-in offline intelligence engine with zero external data transmission.
              You can optionally connect a Google Gemini API Key for live multimodal reasoning.
            </p>

            <div className="form-group full-width">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ margin: 0 }}>Google Gemini API Key (Required for Live Voice-to-Text)</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "11px", color: "#38bdf8", textDecoration: "none", fontWeight: 500 }}
                >
                  Get Free Key (Google AI Studio) ↗
                </a>
              </div>
              <input
                type="text"
                placeholder="AIzaSy... or AQ...."
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value.trim())}
                style={{
                  borderColor:
                    localApiKey && localApiKey.length < 20
                      ? "#f59e0b"
                      : localApiKey && localApiKey.length >= 20
                      ? "#10b981"
                      : undefined
                }}
              />
              {localApiKey && localApiKey.length < 20 && (
                <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>⚠️</span>
                  <span>
                    API key is too short ({localApiKey.length} chars). Gemini keys are typically 39+ characters.
                  </span>
                </div>
              )}
              {localApiKey && localApiKey.length >= 20 && (
                <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✓</span>
                  <span>Active Gemini API key detected ({localApiKey.slice(0, 4)}...).</span>
                </div>
              )}
              <span className="field-hint" style={{ marginTop: "4px", display: "block" }}>
                Enables automated Speech-to-Text and live reasoning in macOS desktop app. Stored locally.
              </span>
            </div>
          </div>

          {/* Section 3: Privacy & Compliance */}
          <div className="settings-section">
            <div className="section-title">
              <Shield size={16} className="text-accent" />
              <h4>Compliance & Disclosure</h4>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConsent.localOnlyMode}
                onChange={(e) => setLocalConsent({ ...localConsent, localOnlyMode: e.target.checked })}
              />
              <span className="checkbox-custom"></span>
              <span className="label-text">
                Enforce Local-Only Mode (Never transmit speech or prompts to any external cloud API)
              </span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          {savedAlert && <span className="save-indicator text-success"><Check size={14} /> Settings Saved!</span>}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};
