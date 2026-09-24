import React from "react";
import { ShieldCheck, AlertCircle, Lock, Shield } from "lucide-react";
import { ConsentAudit } from "../types";

interface Props {
  consent: ConsentAudit;
  onUpdateConsent: (updated: Partial<ConsentAudit>) => void;
  onConfirm: () => void;
}

export const ConsentGate: React.FC<Props> = ({ consent, onUpdateConsent, onConfirm }) => {
  return (
    <div className="consent-banner">
      <div className="consent-icon-box">
        <ShieldCheck className="shield-icon" size={28} />
      </div>

      <div className="consent-content">
        <div className="consent-header-row">
          <span className="badge-visible">Visible Assistant Protocol</span>
          <span className="badge-privacy">
            {consent.localOnlyMode ? "🔒 Local-Only (Offline)" : "☁️ Cloud-Assisted"}
          </span>
        </div>
        <h3>Participant Consent & Privacy Verification</h3>
        <p>
          This assistant is designed strictly for visible, collaborative meeting support and consented practice.
          In accordance with wiretapping and consent regulations, confirm that all participants are informed
          and agree to live speech transcription and technical assistance.
        </p>

        <div className="consent-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent.granted}
              onChange={(e) => {
                onUpdateConsent({
                  granted: e.target.checked,
                  timestamp: e.target.checked ? new Date().toISOString() : null
                });
              }}
            />
            <span className="checkbox-custom"></span>
            <span className="label-text">
              I certify that all session participants have been notified and granted permission.
            </span>
          </label>

          <label className="checkbox-label local-toggle">
            <input
              type="checkbox"
              checked={consent.localOnlyMode}
              onChange={(e) => onUpdateConsent({ localOnlyMode: e.target.checked })}
            />
            <span className="checkbox-custom"></span>
            <span className="label-text">
              <Lock size={14} style={{ display: "inline", marginRight: "4px" }} />
              Local-only mode (No external API calls; uses offline inference)
            </span>
          </label>
        </div>
      </div>

      <div className="consent-action-box">
        <button
          className="btn-confirm-consent"
          disabled={!consent.granted}
          onClick={onConfirm}
        >
          Confirm & Begin Session
        </button>
      </div>
    </div>
  );
};
