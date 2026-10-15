import React, { useState } from "react";
import {
  Download,
  Apple,
  Monitor,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  EyeOff,
  Zap,
  Mic,
  Cpu,
  Layers,
  HardDrive,
  Info,
  Terminal,
  Sparkles,
  FileCheck,
  Lock,
  ChevronRight,
  X
} from "lucide-react";

interface DownloadViewProps {
  showToast: (text: string, type: "info" | "success" | "error") => void;
  onSwitchToHUD?: () => void;
}

interface ReleaseAsset {
  id: string;
  os: "mac" | "win";
  name: string;
  fileName: string;
  arch: string;
  type: string;
  size: string;
  recommended?: boolean;
  sha256: string;
  description: string;
  tag: string;
}

const RELEASES: ReleaseAsset[] = [
  {
    id: "mac-arm64-dmg",
    os: "mac",
    name: "Apple Silicon (M1/M2/M3/M4)",
    fileName: "StealthAI-5.0.0-arm64.dmg",
    arch: "ARM64",
    type: "DMG Installer",
    size: "146 MB",
    recommended: true,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    description: "Recommended for all modern Macs. Hardware-accelerated Neural Engine speech recognition.",
    tag: "Native Apple Silicon"
  },
  {
    id: "mac-arm64-zip",
    os: "mac",
    name: "Apple Silicon Standalone",
    fileName: "StealthAI-5.0.0-arm64-mac.zip",
    arch: "ARM64",
    type: "ZIP Archive",
    size: "146 MB",
    sha256: "7d793037a0760186574b0282f2f435e70d73a40fc7f964293a0ef005b2741a48",
    description: "Portable archive. Unzip directly to run without mounting a disk image.",
    tag: "Portable Archive"
  },
  {
    id: "mac-intel-dmg",
    os: "mac",
    name: "macOS Intel (x86_64)",
    fileName: "StealthAI-5.0.0.dmg",
    arch: "Intel 64-bit",
    type: "DMG Installer",
    size: "150 MB",
    sha256: "b512faeb89c62c478a873130d2139ee5e119ff39e14529f796c91a32a67e1a90",
    description: "Built for Intel-based MacBooks, iMacs, and Mac Minis running macOS 12+.",
    tag: "Intel x86_64"
  },
  {
    id: "win-setup-exe",
    os: "win",
    name: "Windows Setup Installer",
    fileName: "StealthAI Setup 5.0.0.exe",
    arch: "x64",
    type: "NSIS Installer",
    size: "124 MB",
    recommended: true,
    sha256: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    description: "Full installer with automatic updates, Start Menu shortcuts, and desktop launcher.",
    tag: "Recommended for Windows"
  },
  {
    id: "win-portable-exe",
    os: "win",
    name: "Windows Portable Binary",
    fileName: "StealthAI 5.0.0.exe",
    arch: "x64",
    type: "Portable Executable",
    size: "124 MB",
    sha256: "3b92eb3217b9b1d9bf764f9bf51ae68e82a6bc26f30d0d57e6274070a2f9bb69",
    description: "Zero installation required. Run directly from flash drive or any folder without admin rights.",
    tag: "Zero Installation"
  }
];

function detectEnvironment(): { os: "mac" | "win" | "other"; arch: string } {
  if (typeof window === "undefined" || !window.navigator) {
    return { os: "mac", arch: "ARM64" };
  }
  const nav = window.navigator as any;
  const ua = nav.userAgent || "";
  const platform = nav.userAgentData?.platform || nav.platform || "";
  const isWin = /win/i.test(platform) || /windows/i.test(ua);
  const isMac = /mac/i.test(platform) || /macintosh/i.test(ua);

  if (isWin) {
    return { os: "win", arch: "x64" };
  } else if (isMac) {
    const isArm = nav.userAgentData?.architecture === "arm" || nav.maxTouchPoints > 0;
    return { os: "mac", arch: isArm ? "Apple Silicon (M-Series)" : "Intel / Universal" };
  }
  return { os: "other", arch: "Universal" };
}

export const DownloadView: React.FC<DownloadViewProps> = ({
  showToast,
  onSwitchToHUD
}) => {
  const [envInfo] = useState(() => detectEnvironment());
  const [activeOs, setActiveOs] = useState<"mac" | "win">(() => (envInfo.os === "win" ? "win" : "mac"));
  const detectedOs = envInfo.os;
  const detectedArch = envInfo.arch;
  const [activeTab, setActiveTab] = useState<"downloads" | "instructions" | "comparison" | "checksums">("downloads");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    showToast(`Copied ${label} to clipboard!`, "success");
    setTimeout(() => setCopiedItem(null), 2500);
  };

  const handleDownload = (asset: ReleaseAsset) => {
    setIsDownloading(asset.id);
    showToast(`Starting download: ${asset.fileName} (${asset.size})`, "info");

    const githubReleaseBase = "https://github.com/swaroop22/stealthAI/releases/download/v5.0.0";
    const downloadUrl = `${githubReleaseBase}/${encodeURIComponent(asset.fileName)}`;

    try {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = asset.fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(downloadUrl, "_blank");
    }

    setTimeout(() => {
      setIsDownloading(null);
      setActiveTab("instructions");
    }, 1200);
  };

  const macAssets = RELEASES.filter((r) => r.os === "mac");
  const winAssets = RELEASES.filter((r) => r.os === "win");
  const currentAssets = activeOs === "mac" ? macAssets : winAssets;

  return (
    <div className="download-view-container">
      {/* HERO BANNER */}
      <div className="download-hero-banner">
        <div className="hero-badge-pill">
          <Sparkles size={14} className="text-emerald" />
          <span>StealthAI Desktop App • v5.0.0 Pro Stable</span>
        </div>

        <h1 className="hero-main-title">
          Download StealthAI for <span className="gradient-text">macOS & Windows</span>
        </h1>

        <p className="hero-description">
          Experience undetectable screen-share invisibility, 0ms on-device Apple speech recognition,
          floating transparent HUD overlays, and encrypted local audio recording.
        </p>

        {/* OS SELECTOR SWITCH */}
        <div className="hero-os-selector-row">
          <div className="hero-os-toggle-group">
            <button
              className={`hero-os-pill ${activeOs === "mac" ? "active" : ""}`}
              onClick={() => setActiveOs("mac")}
              id="hero-tab-mac"
            >
              <Apple size={18} />
              <span>macOS</span>
              {detectedOs === "mac" && <span className="os-detected-badge">Detected ({detectedArch})</span>}
            </button>
            <button
              className={`hero-os-pill ${activeOs === "win" ? "active" : ""}`}
              onClick={() => setActiveOs("win")}
              id="hero-tab-win"
            >
              <Monitor size={18} />
              <span>Windows 10 / 11</span>
              {detectedOs === "win" && <span className="os-detected-badge">Detected (64-bit)</span>}
            </button>
          </div>

          {onSwitchToHUD && (
            <button
              className="btn-launch-web-hud"
              onClick={onSwitchToHUD}
              title="Try in-browser Floating HUD now"
            >
              <Layers size={15} />
              <span>Launch In-Browser HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="download-nav-tabs view-tabs">
        <button
          className={`download-tab-btn ${activeTab === "downloads" ? "active" : ""}`}
          onClick={() => setActiveTab("downloads")}
        >
          <Download size={15} />
          <span>Installers & Binaries</span>
          <span className="tab-count-pill">{currentAssets.length}</span>
        </button>
        <button
          className={`download-tab-btn ${activeTab === "instructions" ? "active" : ""}`}
          onClick={() => setActiveTab("instructions")}
        >
          <Terminal size={15} />
          <span>Installation Guide</span>
        </button>
        <button
          className={`download-tab-btn ${activeTab === "comparison" ? "active" : ""}`}
          onClick={() => setActiveTab("comparison")}
        >
          <Layers size={15} />
          <span>Desktop vs Web</span>
        </button>
        <button
          className={`download-tab-btn ${activeTab === "checksums" ? "active" : ""}`}
          onClick={() => setActiveTab("checksums")}
        >
          <FileCheck size={15} />
          <span>Integrity & SHA-256</span>
        </button>
      </div>

      {/* VIEW CONTENT */}
      <div className="download-view-content">
        {/* TAB 1: INSTALLERS */}
        {activeTab === "downloads" && (
          <div className="download-tab-content">
            <div className="download-cards-grid">
              {currentAssets.map((asset) => {
                const isCurrentDownloading = isDownloading === asset.id;
                return (
                  <div
                    key={asset.id}
                    className={`download-card ${asset.recommended ? "recommended-card" : ""}`}
                  >
                    {asset.recommended && (
                      <div className="recommended-ribbon">
                        <Sparkles size={12} />
                        <span>RECOMMENDED</span>
                      </div>
                    )}

                    <div className="download-card-header">
                      <div className="card-platform-icon">
                        {asset.os === "mac" ? <Apple size={26} /> : <Monitor size={26} />}
                      </div>
                      <div className="card-title-group">
                        <h4 className="card-asset-title">{asset.name}</h4>
                        <div className="card-meta-row">
                          <span className="card-tag">{asset.tag}</span>
                          <span className="card-arch-pill">{asset.arch}</span>
                          <span className="card-size-pill">{asset.size}</span>
                        </div>
                      </div>
                    </div>

                    <p className="card-description">{asset.description}</p>

                    <div className="download-card-actions">
                      <button
                        className={`btn-primary-download ${asset.recommended ? "btn-glow" : ""}`}
                        onClick={() => handleDownload(asset)}
                        disabled={isCurrentDownloading}
                      >
                        {isCurrentDownloading ? (
                          <>
                            <span className="spinner-sm" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download size={16} />
                            <span>Download {asset.type}</span>
                          </>
                        )}
                      </button>

                      <div className="download-secondary-actions">
                        <button
                          className="btn-copy-filename"
                          onClick={() => handleCopy(asset.fileName, "Filename")}
                          title="Copy installer file name"
                        >
                          <Copy size={13} />
                          <span>{asset.fileName}</span>
                        </button>
                        <button
                          className="btn-copy-hash"
                          onClick={() => handleCopy(asset.sha256, `${asset.fileName} SHA-256`)}
                          title="Copy SHA-256 checksum"
                        >
                          {copiedItem === `${asset.fileName} SHA-256` ? (
                            <Check size={13} className="text-emerald" />
                          ) : (
                            <FileCheck size={13} />
                          )}
                          <span>SHA-256</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* System Requirements Notice */}
            <div className="download-requirements-strip">
              <Info size={16} className="text-cyan shrink-0" />
              <div className="requirements-text">
                {activeOs === "mac" ? (
                  <span>
                    Requires <strong>macOS 12.0 (Monterey)</strong> or later. Tested on macOS Sonoma & Sequoia.
                    Includes native on-device Apple Speech framework integration.
                  </span>
                ) : (
                  <span>
                    Requires <strong>Windows 10 (64-bit 19041+)</strong> or <strong>Windows 11</strong>.
                    Requires standard microphone permissions. Portable version requires zero admin privileges.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSTRUCTIONS */}
        {activeTab === "instructions" && (
          <div className="download-tab-content">
            <div className="instructions-container">
              {activeOs === "mac" ? (
                <div className="os-guide-block">
                  <div className="guide-header-row">
                    <Apple size={20} className="text-emerald" />
                    <h4>macOS Installation & Stealth Setup Guide</h4>
                  </div>

                  <ol className="guide-steps-list">
                    <li className="guide-step-item">
                      <div className="step-badge">1</div>
                      <div className="step-content">
                        <h5 className="step-title">Download & Open the DMG Installer</h5>
                        <p className="step-desc">
                          Download <code>StealthAI-5.0.0-arm64.dmg</code> (for Apple Silicon M1-M4) and double-click to mount the virtual disk image.
                        </p>
                      </div>
                    </li>

                    <li className="guide-step-item">
                      <div className="step-badge">2</div>
                      <div className="step-content">
                        <h5 className="step-title">Drag to Applications Folder</h5>
                        <p className="step-desc">
                          Drag the <strong>StealthAI</strong> application icon directly into the <strong>Applications</strong> shortcut folder inside the DMG window.
                        </p>
                      </div>
                    </li>

                    <li className="guide-step-item">
                      <div className="step-badge">3</div>
                      <div className="step-content">
                        <h5 className="step-title">Grant macOS System Permissions</h5>
                        <p className="step-desc">
                          StealthAI requires two standard system privacy permissions:
                        </p>
                        <div className="permissions-checklist">
                          <div className="perm-item">
                            <Mic size={14} className="text-emerald" />
                            <span><strong>Microphone:</strong> Used for real-time speech captioning.</span>
                          </div>
                          <div className="perm-item">
                            <EyeOff size={14} className="text-emerald" />
                            <span><strong>Screen Recording:</strong> Used for LeetCode problem / architecture diagram OCR snapshots.</span>
                          </div>
                        </div>
                        <span className="perm-note">
                          Navigate to <strong>System Settings → Privacy & Security</strong> to ensure both are toggled ON.
                        </span>
                      </div>
                    </li>

                    <li className="guide-step-item highlight-step">
                      <div className="step-badge">4</div>
                      <div className="step-content">
                        <h5 className="step-title">macOS Gatekeeper / Unsigned Binary Tip</h5>
                        <p className="step-desc">
                          If macOS prompts: <em>"StealthAI cannot be opened because Apple cannot check it for malicious software"</em>, open Terminal and run this one-line command:
                        </p>
                        <div className="code-snippet-box">
                          <code>xattr -cr /Applications/StealthAI.app</code>
                          <button
                            className="btn-snippet-copy"
                            onClick={() => handleCopy("xattr -cr /Applications/StealthAI.app", "Gatekeeper command")}
                          >
                            {copiedItem === "Gatekeeper command" ? (
                              <>
                                <Check size={14} className="text-emerald" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="step-desc-hint">
                          This clears macOS quarantine metadata on locally built binaries so you can launch instantly.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="os-guide-block">
                  <div className="guide-header-row">
                    <Monitor size={20} className="text-emerald" />
                    <h4>Windows Installation & Stealth Setup Guide</h4>
                  </div>

                  <ol className="guide-steps-list">
                    <li className="guide-step-item">
                      <div className="step-badge">1</div>
                      <div className="step-content">
                        <h5 className="step-title">Launch Installer</h5>
                        <p className="step-desc">
                          Double click <code>StealthAI Setup 5.0.0.exe</code>. The NSIS installer will extract application assets into your user profile.
                        </p>
                      </div>
                    </li>

                    <li className="guide-step-item highlight-step">
                      <div className="step-badge">2</div>
                      <div className="step-content">
                        <h5 className="step-title">Windows Defender SmartScreen Notice</h5>
                        <p className="step-desc">
                          Because StealthAI is an open-source binary, Windows SmartScreen may show <em>"Windows protected your PC"</em>.
                        </p>
                        <div className="smartscreen-guidance">
                          <span className="guide-crumb">1. Click <strong>"More info"</strong></span>
                          <ChevronRight size={14} />
                          <span className="guide-crumb">2. Click <strong>"Run anyway"</strong></span>
                        </div>
                      </div>
                    </li>

                    <li className="guide-step-item">
                      <div className="step-badge">3</div>
                      <div className="step-content">
                        <h5 className="step-title">Microphone Privacy Setting</h5>
                        <p className="step-desc">
                          Ensure microphone permissions are enabled: Go to <strong>Settings → Privacy & Security → Microphone</strong> and verify <em>"Let desktop apps access your microphone"</em> is toggled <strong>ON</strong>.
                        </p>
                      </div>
                    </li>

                    <li className="guide-step-item">
                      <div className="step-badge">4</div>
                      <div className="step-content">
                        <h5 className="step-title">Global Hotkeys & Invisible HUD</h5>
                        <p className="step-desc">
                          Launch from the Desktop icon. Use system-wide shortcut <code>Ctrl+Shift+Space</code> or <code>Ctrl+Alt+H</code> to toggle HUD overlay visibility anywhere.
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COMPARISON */}
        {activeTab === "comparison" && (
          <div className="download-tab-content">
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th className="feature-col">Feature & Capability</th>
                    <th className="desktop-col highlight-header">
                      <div className="col-header-group">
                        <Sparkles size={16} className="text-emerald" />
                        <span>StealthAI Desktop</span>
                        <span className="badge-native">PRO</span>
                      </div>
                    </th>
                    <th className="web-col">
                      <span>Web Browser Version</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="feature-cell">
                      <strong>Screen Share Invisibility</strong>
                      <p className="feature-note">Hides AI overlay from Zoom, Google Meet, Teams, Discord</p>
                    </td>
                    <td className="desktop-cell">
                      <div className="feature-status success">
                        <ShieldCheck size={18} className="text-emerald" />
                        <span>100% Invisible via <code>setContentProtection</code></span>
                      </div>
                    </td>
                    <td className="web-cell">
                      <div className="feature-status failure">
                        <X size={16} className="text-red" />
                        <span>Visible in browser tab sharing</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-cell">
                      <strong>Native On-Device Speech Recognition</strong>
                      <p className="feature-note">Sub-millisecond latency word streaming</p>
                    </td>
                    <td className="desktop-cell">
                      <div className="feature-status success">
                        <Zap size={18} className="text-emerald" />
                        <span>0ms Neural Engine (macOS Speech Helper)</span>
                      </div>
                    </td>
                    <td className="web-cell">
                      <div className="feature-status warning">
                        <Info size={16} className="text-amber" />
                        <span>Web Speech API (Internet reliant)</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-cell">
                      <strong>Encrypted Local Audio Recording</strong>
                      <p className="feature-note">Direct streaming loopback write to disk</p>
                    </td>
                    <td className="desktop-cell">
                      <div className="feature-status success">
                        <HardDrive size={18} className="text-emerald" />
                        <span>Direct computer disk stream</span>
                      </div>
                    </td>
                    <td className="web-cell">
                      <div className="feature-status warning">
                        <Info size={16} className="text-amber" />
                        <span>Browser memory blob only</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-cell">
                      <strong>Global System Hotkeys</strong>
                      <p className="feature-note">Toggle HUD anywhere without losing IDE focus</p>
                    </td>
                    <td className="desktop-cell">
                      <div className="feature-status success">
                        <Cpu size={18} className="text-emerald" />
                        <span>System-wide global listeners</span>
                      </div>
                    </td>
                    <td className="web-cell">
                      <div className="feature-status failure">
                        <X size={16} className="text-red" />
                        <span>Only when browser tab has focus</span>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature-cell">
                      <strong>Floating Translucent HUD Window</strong>
                      <p className="feature-note">Stays on top of VS Code, LeetCode, HackerRank</p>
                    </td>
                    <td className="desktop-cell">
                      <div className="feature-status success">
                        <Layers size={18} className="text-emerald" />
                        <span>Always-on-top click-through overlay</span>
                      </div>
                    </td>
                    <td className="web-cell">
                      <div className="feature-status failure">
                        <X size={16} className="text-red" />
                        <span>Standard webpage container</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CHECKSUMS */}
        {activeTab === "checksums" && (
          <div className="download-tab-content">
            <div className="checksums-container">
              <div className="checksums-header">
                <Lock size={18} className="text-cyan" />
                <div>
                  <h4>Cryptographic SHA-256 Checksums</h4>
                  <p>Verify release binary integrity and authenticity against tampering.</p>
                </div>
              </div>

              <div className="checksum-list">
                {RELEASES.map((item) => (
                  <div key={item.id} className="checksum-card">
                    <div className="checksum-card-top">
                      <div className="file-info-group">
                        <span className="file-os-badge">{item.os.toUpperCase()}</span>
                        <strong className="file-name-text">{item.fileName}</strong>
                        <span className="file-size-tag">({item.size})</span>
                      </div>
                      <button
                        className="btn-checksum-copy"
                        onClick={() => handleCopy(item.sha256, `${item.fileName} Hash`)}
                      >
                        {copiedItem === `${item.fileName} Hash` ? (
                          <>
                            <Check size={14} className="text-emerald" />
                            <span>Copied Hash!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy SHA-256</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="hash-code-block">
                      <code>{item.sha256}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK FOOTER LINKS */}
      <div className="download-view-footer">
        <div className="footer-links-group">
          <a
            href="https://github.com/swaroop22/stealthAI"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <ExternalLink size={14} />
            <span>GitHub Repository</span>
          </a>
          <span className="footer-divider">•</span>
          <a
            href="https://github.com/swaroop22/stealthAI/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <FileCheck size={14} />
            <span>All GitHub Releases</span>
          </a>
          <span className="footer-divider">•</span>
          <button
            className="footer-link-btn"
            onClick={() => handleCopy("https://github.com/swaroop22/stealthAI/releases", "Releases URL")}
          >
            <Copy size={13} />
            <span>Copy Download Link</span>
          </button>
        </div>
      </div>
    </div>
  );
};
