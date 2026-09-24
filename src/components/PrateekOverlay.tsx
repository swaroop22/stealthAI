import React, { useState, useEffect, useRef } from "react";
import {
  Monitor,
  Mic,
  Move,
  Minimize2,
  Maximize2,
  MoreVertical,
  Copy,
  Check,
  Globe,
  ChevronDown,
  Settings,
  FileText,
  Download,
  Send,
  X,
  LayoutGrid,
  EyeOff
} from "lucide-react";
import type { AIResponse, CandidateProfile, ConsentAudit, ScreenSnippet, SpeakerType, TranscriptItem } from "../types";

interface Props {
  isCapturing: boolean;
  activeSpeaker: SpeakerType;
  interimText: string;
  transcript: TranscriptItem[];
  activeResponse: AIResponse | null;
  responseHistory: AIResponse[];
  activeSnippet: ScreenSnippet | null;
  consent: ConsentAudit;
  profile: CandidateProfile;
  apiKey?: string;
  onToggleCapture: () => void;
  onCaptureScreenshot: () => void;
  onTriggerAnswer: (promptOverride?: string) => void;
  onSelectResponse: (id: string) => void;
  onClearCurrentAnswer: () => void;
  onClearTranscript: () => void;
  onOpenSettings: () => void;
  onOpenResumeModal: () => void;
  onExportSession: () => void;
  onSwitchToDashboard: () => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
}



export const PrateekOverlay: React.FC<Props> = ({
  isCapturing,
  interimText,
  transcript,
  activeResponse,
  responseHistory,
  activeSnippet,
  onToggleCapture,
  onCaptureScreenshot,
  onTriggerAnswer,
  onSelectResponse,
  onClearCurrentAnswer,
  onClearTranscript,
  onOpenSettings,
  onOpenResumeModal,
  onExportSession,
  onSwitchToDashboard,
  showToast
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
  const [copiedQuestion, setCopiedQuestion] = useState(false);

  // Language selector state
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const languages = ["English", "Spanish", "French", "German", "Mandarin", "Hindi", "Japanese"];

  // Meeting session timer (e.g. 5:57)
  const [sessionSeconds, setSessionSeconds] = useState(357);
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const speechStreamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    speechStreamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length, interimText]);

  // Window resize on collapse/expand
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.resizeWindow) {
      if (isCardCollapsed) {
        electron.resizeWindow(780, 75);
      } else {
        electron.resizeWindow(920, 520);
      }
    }
  }, [isCardCollapsed]);

  // Position index in history
  const currentIndex = activeResponse
    ? responseHistory.findIndex((r) => r.id === activeResponse.id)
    : -1;

  const canGoPrev = currentIndex < responseHistory.length - 1 && responseHistory.length > 1;
  const canGoNext = currentIndex > 0;

  const handlePrev = () => {
    if (canGoPrev && responseHistory[currentIndex + 1]) {
      onSelectResponse(responseHistory[currentIndex + 1].id);
    }
  };

  const handleNext = () => {
    if (canGoNext && responseHistory[currentIndex - 1]) {
      onSelectResponse(responseHistory[currentIndex - 1].id);
    }
  };

  // Copy question helper
  const handleCopyQuestion = () => {
    const textToCopy = activeResponse?.prompt || "Explain yourself";
    navigator.clipboard.writeText(textToCopy);
    setCopiedQuestion(true);
    setTimeout(() => setCopiedQuestion(false), 1800);
    showToast("Question copied", "info");
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onTriggerAnswer(chatInput.trim());
    setChatInput("");
    setIsChatOpen(false);
  };

  const handleEndApp = () => {
    const electron = (window as any).electronAPI;
    if (electron?.closeWindow) {
      electron.closeWindow();
    } else {
      if (isCapturing) onToggleCapture();
      showToast("Session ended", "info");
    }
  };

  // Render formatted answer with bold keywords
  const renderFormattedAnswer = (content?: string) => {
    const raw = content?.trim() || "";
    if (!raw) {
      return (
        <p className="answer-p-line text-slate-400 italic">
          No answer active. Turn on the mic and speak, then press <strong className="text-white">Ctrl + Enter</strong> to answer.
        </p>
      );
    }

    // Clean leading answer prefixes
    const clean = raw.replace(/^[⭐\s*]*(answer:)?/i, "").trim();
    const paragraphs = clean.split("\n\n").filter(Boolean);

    return (
      <div className="answer-text-flow">
        {paragraphs.map((para, pIdx) => {
          const lines = para.split("\n");
          return (
            <div key={pIdx} className="answer-p-group">
              {lines.map((line, lIdx) => {
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={lIdx} className="answer-p-line">
                    {parts.map((part, idx) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                          <strong key={idx} className="answer-bold-highlight">
                            {part.slice(2, -2)}
                          </strong>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="prateek-overlay-wrapper">
      {/* FLOATING HUD & ANSWER CARD OVERLAY CONTAINER */}
      <div className="prateek-floating-hud-container">
        
        {/* TOP HUD BAR */}
        <div className="prateek-hud-top">
          {/* Left Indicator Buttons: Screen and Mic */}
          <div className="prateek-indicators-group no-drag">
            <button
              className={`prateek-status-icon-btn ${activeSnippet ? "recording" : ""}`}
              onClick={onCaptureScreenshot}
              title={activeSnippet ? "Screen Captured (Click to update)" : "Capture Screen"}
            >
              <Monitor size={17} />
              <span className="prateek-red-badge-dot" />
            </button>

            <button
              className={`prateek-status-icon-btn ${isCapturing ? "recording" : ""}`}
              onClick={onToggleCapture}
              title={isCapturing ? "Microphone Active (Click to mute)" : "Start Listening"}
            >
              <Mic size={17} />
              <span className="prateek-red-badge-dot" />
            </button>
          </div>

          {/* Action Pills */}
          <div className="prateek-actions-group no-drag">
            <button
              className="prateek-pill-btn prateek-pill-answer"
              onClick={() => onTriggerAnswer()}
              title="Answer current question (Ctrl + Enter)"
            >
              <span className="pill-text">Answer</span>
              <span className="prateek-kbd">Ctrl ↵</span>
            </button>

            <button
              className="prateek-pill-btn"
              onClick={onCaptureScreenshot}
              title="Take screenshot & solve (Ctrl + Shift + Enter)"
            >
              <span className="pill-text">Screenshot</span>
              <span className="prateek-kbd">Ctrl ⇧ ↵</span>
            </button>

            <button
              className={`prateek-pill-btn prateek-pill-dashed ${isChatOpen ? "active" : ""}`}
              onClick={() => setIsChatOpen(!isChatOpen)}
              title="Toggle Custom Prompt (Ctrl + Shift + Backspace)"
            >
              <span className="pill-text">Chat</span>
              <span className="prateek-kbd">Ctrl ⇧ ...</span>
            </button>
          </div>

          {/* Right Controls */}
          <div className="prateek-controls-group no-drag">
            <button className="prateek-tool-icon-btn drag-handle" title="Click & Drag to move HUD">
              <Move size={15} />
            </button>

            <button
              className="prateek-tool-icon-btn"
              onClick={() => setIsCardCollapsed(!isCardCollapsed)}
              title={isCardCollapsed ? "Expand Cards" : "Collapse Cards"}
            >
              {isCardCollapsed ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
            </button>

            <button
              className="prateek-tool-icon-btn"
              onClick={() => {
                const electron = (window as any).electronAPI;
                if (electron?.hideWindow) {
                  electron.hideWindow();
                } else {
                  setIsCardCollapsed(true);
                }
              }}
              title="Stealth Hide: Hide from laptop screen (Ctrl+\ to toggle back)"
            >
              <EyeOff size={15} />
            </button>

            <div className="prateek-menu-relative">
              <button
                className="prateek-tool-icon-btn"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="Options"
              >
                <MoreVertical size={16} />
              </button>

              {isMoreMenuOpen && (
                <div className="prateek-dropdown-menu">
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      const electron = (window as any).electronAPI;
                      if (electron?.hideWindow) electron.hideWindow();
                    }}
                    title="Hide overlay from screen. Press Ctrl+\ anytime to bring it back."
                  >
                    <EyeOff size={15} />
                    <span>Hide Window (Ctrl \)</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenResumeModal();
                    }}
                  >
                    <FileText size={15} />
                    <span>Profile & Resume</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <Settings size={15} />
                    <span>Settings & API Key</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onExportSession();
                    }}
                  >
                    <Download size={15} />
                    <span>Export Session JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onSwitchToDashboard();
                    }}
                  >
                    <LayoutGrid size={15} />
                    <span>Full Dashboard View</span>
                  </button>
                </div>
              )}
            </div>

            {/* Red Session Timer Button (e.g. 5:57) */}
            <button
              className="prateek-timer-btn"
              onClick={handleEndApp}
              title="Live Session Timer (Click to End)"
            >
              {formatTimer(sessionSeconds)}
            </button>
          </div>
        </div>

        {/* INLINE QUICK CHAT DRAWER */}
        {isChatOpen && (
          <form className="prateek-chat-drawer no-drag" onSubmit={handleChatSubmit}>
            <input
              type="text"
              className="prateek-chat-input"
              placeholder="Ask anything (e.g. Explain yourself)..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="prateek-chat-send-btn" title="Submit">
              <Send size={15} />
            </button>
            <button
              type="button"
              className="prateek-chat-close-btn"
              onClick={() => setIsChatOpen(false)}
            >
              <X size={15} />
            </button>
          </form>
        )}

        {/* TWO SEPARATE FLOATING CARDS (Side-by-Side: Speech Transcript & AI Solution) */}
        {!isCardCollapsed && (
          <div className="prateek-two-cards-row no-drag">
            
            {/* LEFT CARD: SPEECH TRANSCRIPT */}
            <div className="prateek-floating-card prateek-speech-card">
              {/* Card Mini Toolbar */}
              <div className="prateek-card-toolbar">
                <div className="card-toolbar-left">
                  {/* Green animated soundwave/equalizer bars */}
                  <div className="prateek-equalizer-bars" title="Microphone Equalizer">
                    <span className={`eq-bar bar-1 ${isCapturing ? "bouncing" : ""}`} />
                    <span className={`eq-bar bar-2 ${isCapturing ? "bouncing" : ""}`} />
                    <span className={`eq-bar bar-3 ${isCapturing ? "bouncing" : ""}`} />
                    <span className={`eq-bar bar-4 ${isCapturing ? "bouncing" : ""}`} />
                  </div>

                  {/* Language Selector Dropdown */}
                  <div className="prateek-lang-relative">
                    <button
                      className="prateek-lang-btn"
                      onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                      title="Select Speech Language"
                    >
                      <Globe size={13} className="text-slate-300" />
                      <span className="lang-text">{selectedLanguage}</span>
                      <ChevronDown size={11} className="text-slate-400" />
                    </button>

                    {isLangMenuOpen && (
                      <div className="prateek-lang-dropdown">
                        {languages.map((lang) => (
                          <button
                            key={lang}
                            className={`lang-option ${selectedLanguage === lang ? "active" : ""}`}
                            onClick={() => {
                              setSelectedLanguage(lang);
                              setIsLangMenuOpen(false);
                            }}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-toolbar-right">
                  <button
                    className="prateek-mini-clear-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearTranscript();
                    }}
                    title="Clear Speech Transcript (Ctrl + Shift + Backspace)"
                  >
                    <span>Clear</span>
                    <span className="mini-kbd">Ctrl ⇧ ⌫</span>
                  </button>

                  <button
                    className="prateek-mini-expand-btn"
                    title="Expand View"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>

              {/* Speech Chat Body: Right-aligned messages */}
              <div className="prateek-speech-chat-body">
                {transcript.length === 0 && !isCapturing && (
                  <div className="prateek-empty-speech-state">
                    <p className="empty-speech-desc">Transcript cleared. Turn on the mic to start listening.</p>
                  </div>
                )}

                {transcript.map((item) => (
                  <div key={item.id} className="prateek-chat-message-row">
                    <div className="chat-message-text">{item.text}</div>
                    <div className="chat-message-meta">
                      {item.speaker === "Candidate" ? "You" : item.speaker} · {item.timestamp}
                    </div>
                  </div>
                ))}

                {/* LIVE INTERIM STREAM (while someone is speaking right now) */}
                {isCapturing && interimText.trim() && (
                  <div className="prateek-chat-message-row live">
                    <div className="chat-message-text live">
                      {interimText.trim()}
                    </div>
                    <div className="chat-message-meta live">
                      <span className="live-dot-green" />
                      <span>You · 03:57 PM</span>
                    </div>
                  </div>
                )}
                <div ref={speechStreamEndRef} />
              </div>
            </div>

            {/* RIGHT CARD: AI SOLUTION / ANSWER */}
            <div className="prateek-floating-card prateek-answer-card">
              {/* Card Mini Toolbar */}
              <div className="prateek-card-toolbar">
                <div className="card-toolbar-left">
                  <button
                    className="prateek-mini-nav-btn"
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    title="Previous Answer (Ctrl + ←)"
                  >
                    <span>Ctrl ←</span>
                  </button>
                  <button
                    className="prateek-mini-nav-btn"
                    onClick={handleNext}
                    disabled={!canGoNext}
                    title="Next Answer (Ctrl + →)"
                  >
                    <span>Ctrl →</span>
                  </button>
                </div>

                <div className="card-toolbar-right">
                  <button
                    className="prateek-mini-clear-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearCurrentAnswer();
                    }}
                    title="Clear Answer (Ctrl + Backspace)"
                  >
                    <span>Clear</span>
                    <span className="mini-kbd">Ctrl ⌫</span>
                  </button>

                  <button
                    className="prateek-mini-expand-btn"
                    title="Expand View"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>

              {/* Answer Content Body */}
              <div className="prateek-answer-content-body">
                {activeResponse ? (
                  <>
                    {/* Question Row */}
                    <div className="answer-question-row">
                      <div className="question-left">
                        <span className="question-speech-icon">💬</span>
                        <span className="question-label">Question:</span>
                        <span className="question-text">
                          {activeResponse.prompt}
                        </span>
                      </div>
                      <button
                        className="question-copy-btn"
                        onClick={handleCopyQuestion}
                        title="Copy Question"
                      >
                        {copiedQuestion ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Answer Main Content */}
                    <div className="answer-main-content">
                      <div className="answer-star-row">
                        <span className="star-icon">⭐</span>
                        <strong className="answer-bold-label">Answer:</strong>
                      </div>
                      {renderFormattedAnswer(activeResponse.content)}

                      {activeResponse.isStreaming && (
                        <div className="answer-streaming-pulse">
                          <span className="live-pulse-dot" />
                          <span>Generating answer...</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="answer-empty-state">
                    <div className="answer-question-row">
                      <div className="question-left">
                        <span className="question-speech-icon">💬</span>
                        <span className="question-label">Question:</span>
                        <span className="question-text text-slate-500 font-normal italic">
                          No question active
                        </span>
                      </div>
                    </div>
                    <div className="answer-main-content">
                      <p className="answer-p-line text-slate-400 italic">
                        Answer cleared. Turn on the mic and speak, then press <strong className="text-white">Ctrl + Enter</strong> to answer.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bottom resize/expand indicator */}
                <div className="answer-card-bottom-actions">
                  <button className="answer-bottom-resize-btn" title="Expand / Resize">
                    <ChevronDown size={14} />
                  </button>
                  <button className="answer-bottom-expand-btn" title="Expand Solution">
                    <Maximize2 size={12} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
