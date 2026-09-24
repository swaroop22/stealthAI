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
              <label>Google Gemini API Key (Optional)</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
              />
              <span className="field-hint">
                Leaves machine only for direct Google Gemini streaming calls. Stored in memory / local state.
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
