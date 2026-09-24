import React, { useState, useEffect, useRef } from "react";
import {
  Monitor,
  Mic,
  MicOff,
  Move,
  Minimize2,
  Maximize2,
  MoreVertical,
  MessageSquare,
  Copy,
  Check,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Settings,
  FileText,
  Download,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid
} from "lucide-react";
import type { AIResponse, CandidateProfile, ConsentAudit, ScreenSnippet, SpeakerType, TranscriptItem } from "../types";
import { PRESET_SCENARIOS } from "../services/presetScenarios";

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
  activeSpeaker,
  interimText,
  transcript,
  activeResponse,
  responseHistory,
  activeSnippet,
  consent,
  profile,
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
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

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

  // Copy helper
  const handleCopyQuestion = () => {
    if (!activeResponse) return;
    navigator.clipboard.writeText(activeResponse.prompt);
    setCopiedQuestion(true);
    setTimeout(() => setCopiedQuestion(false), 1800);
    showToast("Question copied", "info");
  };

  const handleCopyAnswer = () => {
    if (!activeResponse) return;
    navigator.clipboard.writeText(activeResponse.content);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 1800);
    showToast("Answer copied to clipboard", "success");
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onTriggerAnswer(chatInput.trim());
    setChatInput("");
    setIsChatOpen(false);
  };

  // Format speech stream chunks as discrete pills like the screenshot
  const displaySpeechPills = (): string[] => {
    const rawText = interimText.trim() || (transcript.length > 0 ? transcript[transcript.length - 1].text : "");
    if (!rawText) return ["What happens when", "I type a", "URL into the", "browser?"];

    // Split into chunks of 3-4 words per pill
    const words = rawText.split(/\s+/);
    const pills: string[] = [];
    let currentChunk: string[] = [];

    words.forEach((w) => {
      currentChunk.push(w);
      if (currentChunk.length >= 3) {
        pills.push(currentChunk.join(" "));
        currentChunk = [];
      }
    });
    if (currentChunk.length > 0) {
      pills.push(currentChunk.join(" "));
    }
    return pills.slice(-5);
  };

  // Parse structured answer: TL;DR and bullets
  const parseAnswerContent = (content: string) => {
    if (!content) return { tldr: "DNS, connection, request, render.", bullets: [
      { prefix: "Resolve:", text: "the host goes through the cache chain, then the recursive resolver." },
      { prefix: "Connect:", text: "TCP handshake, then TLS — ALPN negotiates HTTP/2 here." },
      { prefix: "Render:", text: "the server responds; the browser parses HTML, builds the DOM, and executes JS." }
    ]};

    let tldr = "";
    const bullets: { prefix: string; text: string }[] = [];
    const lines = content.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.includes("⭐") || line.toLowerCase().startsWith("**answer:**") || line.toLowerCase().startsWith("answer:")) {
        tldr = line.replace(/^[⭐\s*]*(answer:)?/i, "").replace(/^\*+/g, "").replace(/\*+$/g, "").trim();
      } else if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
        const clean = line.replace(/^[•\-*]\s*/, "");
        // Match prefix e.g. **Resolve:**
        const match = clean.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
        if (match) {
          bullets.push({ prefix: match[1].replace(/:$/, "") + ":", text: match[2] });
        } else {
          bullets.push({ prefix: "", text: clean });
        }
      }
    }

    if (!tldr && lines.length > 0) {
      tldr = lines[0].replace(/^[#*\s]+/, "");
    }

    return {
      tldr: tldr || content.slice(0, 80),
      bullets: bullets.length > 0 ? bullets : lines.slice(1).map(l => ({ prefix: "", text: l }))
    };
  };

  const parsed = activeResponse
    ? parseAnswerContent(activeResponse.content)
    : {
        tldr: "DNS, connection, request, render.",
        bullets: [
          { prefix: "Resolve:", text: "the host goes through the cache chain, then the recursive resolver." },
          { prefix: "Connect:", text: "TCP handshake, then TLS — ALPN negotiates HTTP/2 here." },
          { prefix: "Render:", text: "the server responds; the browser parses HTML, builds the DOM tree." }
        ]
      };

  return (
    <div className="prateek-overlay-wrapper">
      {/* Background Dimmed Workstation View (Matches screenshot depth) */}
      <div className="prateek-bg-workspace">
        <div className="prateek-bg-header">
          <div className="prateek-bg-title">
            <h2>Prepare for calls and review past sessions.</h2>
            <div className="prateek-bg-tabs">
              <span className="tab active">All</span>
              <span className="tab">Active</span>
              <span className="tab">Ended</span>
            </div>
          </div>
          <button className="prateek-dashboard-toggle-btn" onClick={onSwitchToDashboard} title="Open Full Studio Dashboard">
            <LayoutGrid size={15} />
            <span>Studio View</span>
          </button>
        </div>

        {/* Sample sessions row in background */}
        <div className="prateek-bg-table">
          <div className="prateek-bg-row">
            <span className="name">Google • System Design</span>
            <span className="type">Interview</span>
            <span className="time">31 mins 45 secs</span>
            <span className="status live">● Live Active</span>
          </div>
          <div className="prateek-bg-row">
            <span className="name">Meta • Full Stack Senior</span>
            <span className="type">Interview</span>
            <span className="time">45 mins 0 secs</span>
            <span className="status ended">Completed</span>
          </div>
          <div className="prateek-bg-row">
            <span className="name">Apple • Performance & Systems</span>
            <span className="type">Technical</span>
            <span className="time">52 mins 10 secs</span>
            <span className="status ended">Completed</span>
          </div>
        </div>
      </div>

      {/* FLOATING HUD & ANSWER CARD OVERLAY CONTAINER */}
      <div className="prateek-floating-hud-container">
        {/* TOP HUD BAR */}
        <div className="prateek-hud-top">
          {/* Left Indicator Buttons: Screen and Mic */}
          <div className="prateek-indicators-group">
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
          <div className="prateek-actions-group">
            <button
              className="prateek-pill-btn prateek-pill-answer"
              onClick={() => onTriggerAnswer()}
              title="Answer current spoken question or screen (⌘ + Enter)"
            >
              <span className="pill-text">Answer</span>
              <span className="prateek-kbd">⌘↵</span>
            </button>

            <button
              className="prateek-pill-btn"
              onClick={onCaptureScreenshot}
              title="Take screenshot and solve (⌘ + Shift + Enter)"
            >
              <span className="pill-text">Screenshot</span>
              <span className="prateek-kbd">⌘⇧↵</span>
            </button>

            <button
              className={`prateek-pill-btn prateek-pill-dashed ${isChatOpen ? "active" : ""}`}
              onClick={() => setIsChatOpen(!isChatOpen)}
              title="Toggle Custom Prompt / Chat (⌘ + Shift + Backspace)"
            >
              <span className="pill-text">Chat</span>
              <span className="prateek-kbd">⌘⇧⌫</span>
            </button>
          </div>

          {/* Right Utility Icons */}
          <div className="prateek-controls-group">
            <button className="prateek-tool-icon-btn" title="Drag / Move HUD">
              <Move size={15} />
            </button>

            <button
              className="prateek-tool-icon-btn"
              onClick={() => setIsCardCollapsed(!isCardCollapsed)}
              title={isCardCollapsed ? "Expand Answer Card" : "Collapse to Pill Bar"}
            >
              {isCardCollapsed ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
            </button>

            <div className="prateek-menu-relative">
              <button
                className="prateek-tool-icon-btn"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="More Options"
              >
                <MoreVertical size={16} />
              </button>

              {isMoreMenuOpen && (
                <div className="prateek-dropdown-menu">
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
                    <span>Full Dashboard Mode</span>
                  </button>
                </div>
              )}
            </div>

            <button
              className="prateek-end-btn"
              onClick={() => {
                if (isCapturing) onToggleCapture();
                showToast("Session ended", "info");
              }}
              title="End active session"
            >
              End
            </button>
          </div>
        </div>

        {/* INLINE QUICK CHAT DRAWER */}
        {isChatOpen && (
          <form className="prateek-chat-drawer" onSubmit={handleChatSubmit}>
            <input
              type="text"
              className="prateek-chat-input"
              placeholder="Ask anything or paste question (e.g. What happens when I type a URL into the browser?)..."
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

        {/* FLOATING LIVE SPEECH STREAM PILL BAR */}
        <div className="prateek-hud-speech">
          {/* Animated Green Waveform Audio Bars */}
          <div className="prateek-audio-bars" title={isCapturing ? "Live Audio Capturing" : "Audio Muted"}>
            <span className={`bar bar-1 ${isCapturing ? "bouncing" : ""}`} />
            <span className={`bar bar-2 ${isCapturing ? "bouncing" : ""}`} />
            <span className={`bar bar-3 ${isCapturing ? "bouncing" : ""}`} />
          </div>

          {/* Speech Chunks as Rounded Pills */}
          <div className="prateek-speech-tokens-container">
            {displaySpeechPills().map((pill, idx) => (
              <span key={idx} className="prateek-token-pill">
                {pill}
              </span>
            ))}
          </div>

          {/* Right Action: Clear and Expand */}
          <div className="prateek-speech-actions">
            <button
              className="prateek-pill-btn prateek-pill-sm"
              onClick={onClearTranscript}
              title="Clear transcript (⌘ + Shift + Backspace)"
            >
              <span className="pill-text">Clear</span>
              <span className="prateek-kbd">⌘⇧⌫</span>
            </button>

            <button
              className="prateek-icon-pill-btn"
              onClick={() => setIsCardCollapsed(!isCardCollapsed)}
              title="Toggle Size"
            >
              {isCardCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          </div>
        </div>

        {/* MAIN FLOATING ANSWER CARD */}
        {!isCardCollapsed && (
          <div className="prateek-card">
            {/* Card Navigation & Clear Bar */}
            <div className="prateek-card-top">
              <div className="prateek-history-nav">
                <button
                  className="prateek-nav-btn"
                  onClick={handlePrev}
                  disabled={!canGoPrev}
                  title="Previous Answer (⌘ + ←)"
                >
                  <span className="prateek-kbd">⌘←</span>
                </button>
                <button
                  className="prateek-nav-btn"
                  onClick={handleNext}
                  disabled={!canGoNext}
                  title="Next Answer (⌘ + →)"
                >
                  <span className="prateek-kbd">⌘→</span>
                </button>
              </div>

              <div className="prateek-card-top-right">
                <button
                  className="prateek-pill-btn prateek-pill-sm"
                  onClick={onClearCurrentAnswer}
                  title="Clear this Answer (⌘ + Backspace)"
                >
                  <span className="pill-text">Clear</span>
                  <span className="prateek-kbd">⌘⌫</span>
                </button>
                <button
                  className="prateek-icon-pill-btn"
                  onClick={() => setIsCardCollapsed(true)}
                  title="Minimize"
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>

            {/* Question Line */}
            <div className="prateek-card-question">
              <div className="prateek-question-text-group">
                <span className="question-bubble-icon">💬</span>
                <span className="question-bold-label">Question:</span>
                <span className="question-content">
                  {activeResponse
                    ? activeResponse.prompt
                    : "What happens when I type a URL into the browser?"}
                </span>
              </div>
              <button
                className="prateek-copy-icon-btn"
                onClick={handleCopyQuestion}
                title="Copy Question"
              >
                {copiedQuestion ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>

            {/* Answer Content */}
            <div className="prateek-card-answer">
              {/* Star TL;DR Summary */}
              <div className="prateek-tldr-line">
                <span className="star-icon">⭐</span>
                <span className="answer-bold-label">Answer:</span>
                <span className="answer-tldr-text">{parsed.tldr}</span>
              </div>

              {/* Bullet Breakdown Points */}
              <div className="prateek-bullets-list">
                {parsed.bullets.map((b, idx) => (
                  <div key={idx} className="prateek-bullet-item">
                    <span className="bullet-dot">•</span>
                    {b.prefix && <strong className="bullet-prefix">{b.prefix} </strong>}
                    <span className="bullet-text">{b.text}</span>
                  </div>
                ))}
              </div>

              {/* Streaming Indicator */}
              {activeResponse?.isStreaming && (
                <div className="prateek-streaming-badge">
                  <span className="pulse-dot" />
                  <span>Synthesizing response...</span>
                </div>
              )}
            </div>

            {/* Footer Row: Timestamp & Feedback */}
            <div className="prateek-card-footer">
              <div className="footer-left">
                <span className="footer-meta">
                  Answer · {activeResponse?.timestamp || new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
                </span>
                {profile.name && (
                  <span className="footer-profile-pill">
                    {profile.targetRole || "Senior Engineer"}
                  </span>
                )}
              </div>

              <div className="footer-actions">
                <button
                  className={`prateek-feedback-btn ${feedback === "up" ? "active" : ""}`}
                  onClick={() => {
                    setFeedback("up");
                    showToast("Helpful answer", "success");
                  }}
                  title="Helpful"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  className={`prateek-feedback-btn ${feedback === "down" ? "active" : ""}`}
                  onClick={() => {
                    setFeedback("down");
                    showToast("Feedback recorded", "info");
                  }}
                  title="Needs Improvement"
                >
                  <ThumbsDown size={14} />
                </button>
                <button
                  className="prateek-feedback-btn"
                  onClick={handleCopyAnswer}
                  title="Copy Solution"
                >
                  {copiedAnswer ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
