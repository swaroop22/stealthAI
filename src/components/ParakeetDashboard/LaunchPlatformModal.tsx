import React, { useState, useEffect } from "react";
import {
  X,
  Monitor,
  Globe,
  ShieldCheck,
  Sparkles,
  Download,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Zap,
  Radio,
  EyeOff
} from "lucide-react";
import type { CallSession } from "../../types";

export type LaunchPlatform = "desktop" | "browser";

interface LaunchPlatformModalProps {
  isOpen: boolean;
  session: CallSession | null;
  onClose: () => void;
  onLaunchBrowser: (session: CallSession) => void;
  onLaunchDesktop: (session: CallSession) => void;
  onOpenDownloadModal?: () => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
}

export const LaunchPlatformModal: React.FC<LaunchPlatformModalProps> = ({
  isOpen,
  session,
  onClose,
  onLaunchBrowser,
  onLaunchDesktop,
  onOpenDownloadModal,
  showToast
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<LaunchPlatform>("desktop");
  const [rememberChoice, setRememberChoice] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("stealthai_preferred_platform");
      if (saved === "browser" || saved === "desktop") {
        setSelectedPlatform(saved);
        setRememberChoice(true);
      } else {
        setSelectedPlatform("desktop");
        setRememberChoice(false);
      }
    }
  }, [isOpen]);

  if (!isOpen || !session) return null;

  const handleToggleRemember = (checked: boolean) => {
    setRememberChoice(checked);
    if (checked) {
      localStorage.setItem("stealthai_preferred_platform", selectedPlatform);
      showToast(
        `Default set to ${selectedPlatform === "desktop" ? "Desktop App" : "Browser"}. Future sessions will launch automatically.`,
        "info"
      );
    } else {
      localStorage.removeItem("stealthai_preferred_platform");
      showToast("Remembered launch preference cleared.", "info");
    }
  };

  const handleSelectPlatform = (platform: LaunchPlatform) => {
    setSelectedPlatform(platform);
    if (rememberChoice) {
      localStorage.setItem("stealthai_preferred_platform", platform);
    }
  };

  const handleConfirmLaunch = () => {
    if (rememberChoice) {
      localStorage.setItem("stealthai_preferred_platform", selectedPlatform);
    } else {
      localStorage.removeItem("stealthai_preferred_platform");
    }

    if (selectedPlatform === "desktop") {
      onLaunchDesktop(session);
    } else {
      onLaunchBrowser(session);
    }
    onClose();
  };

  const isElectronActive = Boolean((window as any).electronAPI);

  return (
    <div className="parakeet-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="launch-platform-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="launch-modal-header">
          <div className="launch-header-text">
            <div className="launch-badge-pill">
              <Sparkles size={13} className="text-blue-500" />
              <span>Session Launch Setup</span>
            </div>
            <h2 className="launch-modal-title">How would you like to start your session?</h2>
            <p className="launch-modal-subtitle">
              Choose your live interview environment for{" "}
              <strong>{session.company}</strong> ({session.role || "Technical Call"}).
            </p>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close launch modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Platform Selection Cards Grid */}
        <div className="launch-cards-grid">
          {/* 1. Desktop App Card */}
          <div
            className={`platform-choice-card ${selectedPlatform === "desktop" ? "active" : ""}`}
            onClick={() => handleSelectPlatform("desktop")}
          >
            <div className="platform-card-top">
              <div className="platform-icon-wrap desktop-icon">
                <Monitor size={24} />
              </div>
              <div className="platform-badges">
                <span className="badge-recommended">
                  <ShieldCheck size={12} />
                  <span>Recommended</span>
                </span>
                {isElectronActive && (
                  <span className="badge-detected">Desktop Active</span>
                )}
              </div>
            </div>

            <div className="platform-title-row">
              <div className="platform-name">StealthAI Desktop App</div>
              <div className="platform-radio">
                {selectedPlatform === "desktop" ? (
                  <div className="radio-circle-checked" />
                ) : (
                  <div className="radio-circle-unchecked" />
                )}
              </div>
            </div>

            <p className="platform-desc">
              Dedicated stealth client with hardware-accelerated audio and anti-detection capabilities.
            </p>

            <ul className="platform-feature-list">
              <li>
                <EyeOff size={14} className="feature-icon text-indigo-500" />
                <span><strong>100% Invisible to Screen Share</strong> (Zoom, Teams, Meet)</span>
              </li>
              <li>
                <Zap size={14} className="feature-icon text-amber-500" />
                <span><strong>Zero-Latency Audio Recognition</strong> via Native Apple/Win Engine</span>
              </li>
              <li>
                <ShieldCheck size={14} className="feature-icon text-emerald-500" />
                <span><strong>Floating Transparent HUD</strong> pin-to-top above interview window</span>
              </li>
              <li>
                <Radio size={14} className="feature-icon text-blue-500" />
                <span><strong>Global Stealth Hotkeys</strong> to hide &amp; unhide in &lt;100ms</span>
              </li>
            </ul>

            <div className="platform-card-footer">
              <button
                type="button"
                className="btn-action-primary desktop-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlatform("desktop");
                  if (rememberChoice) {
                    localStorage.setItem("stealthai_preferred_platform", "desktop");
                  }
                  onLaunchDesktop(session);
                  onClose();
                }}
              >
                <span>Launch Desktop App</span>
                <ArrowRight size={14} />
              </button>

              <button
                type="button"
                className="btn-download-helper-link"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenDownloadModal) {
                    onClose();
                    onOpenDownloadModal();
                  } else {
                    showToast("Download StealthAI desktop from top right button", "info");
                  }
                }}
              >
                <Download size={13} />
                <span>Don't have Desktop installed? Download App</span>
              </button>
            </div>
          </div>

          {/* 2. Web Browser Card */}
          <div
            className={`platform-choice-card ${selectedPlatform === "browser" ? "active" : ""}`}
            onClick={() => handleSelectPlatform("browser")}
          >
            <div className="platform-card-top">
              <div className="platform-icon-wrap browser-icon">
                <Globe size={24} />
              </div>
              <div className="platform-badges">
                <span className="badge-instant">
                  <Zap size={12} />
                  <span>Instant Run</span>
                </span>
              </div>
            </div>

            <div className="platform-title-row">
              <div className="platform-name">Browser Studio Mode</div>
              <div className="platform-radio">
                {selectedPlatform === "browser" ? (
                  <div className="radio-circle-checked" />
                ) : (
                  <div className="radio-circle-unchecked" />
                )}
              </div>
            </div>

            <p className="platform-desc">
              Run directly in your current web browser tab without downloading or installing any software.
            </p>

            <ul className="platform-feature-list">
              <li>
                <CheckCircle2 size={14} className="feature-icon text-emerald-500" />
                <span><strong>No Installation Required</strong> — starts in this browser tab</span>
              </li>
              <li>
                <CheckCircle2 size={14} className="feature-icon text-emerald-500" />
                <span><strong>Web Speech Recognition</strong> with continuous microphone audio</span>
              </li>
              <li>
                <CheckCircle2 size={14} className="feature-icon text-emerald-500" />
                <span><strong>Browser Screen Capture</strong> for live OCR question detection</span>
              </li>
              <li>
                <CheckCircle2 size={14} className="feature-icon text-emerald-500" />
                <span><strong>Live Parakeet AI Studio</strong> split-screen with response history</span>
              </li>
            </ul>

            <div className="platform-card-footer">
              <button
                type="button"
                className="btn-action-primary browser-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlatform("browser");
                  if (rememberChoice) {
                    localStorage.setItem("stealthai_preferred_platform", "browser");
                  }
                  onLaunchBrowser(session);
                  onClose();
                }}
              >
                <span>Launch in Browser</span>
                <ArrowRight size={14} />
              </button>

              <div className="browser-hint-text">
                Runs instantly in Chrome, Brave, Edge &amp; Safari
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="launch-modal-bottom-bar">
          <label className="remember-choice-checkbox">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => handleToggleRemember(e.target.checked)}
            />
            <span>Remember my choice for future sessions</span>
          </label>

          <div className="bottom-bar-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-confirm-launch"
              onClick={handleConfirmLaunch}
              id="btn-confirm-session-launch"
            >
              <span>Continue with {selectedPlatform === "desktop" ? "Desktop App" : "Browser"}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
