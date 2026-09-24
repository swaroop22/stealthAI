import React, { useState, useEffect } from "react";
import {
  Monitor,
  Mic,
  Move,
  Minimize2,
  Maximize2,
  MoreVertical,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Settings,
  FileText,
  Download,
  Send,
  X,
  LayoutGrid,
  Columns2,
  MessageSquare,
  Sparkles,
  Clock
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
  const [cardTab, setCardTab] = useState<"question" | "answer" | "split">("split");
  const [copiedQuestion, setCopiedQuestion] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  // Dynamically shrink or expand Electron window based on card collapse and tab state
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.resizeWindow) {
      if (isCardCollapsed) {
        electron.resizeWindow(740, 115);
      } else if (cardTab === "split") {
        electron.resizeWindow(860, 520);
      } else {
        electron.resizeWindow(740, 500);
      }
    }
  }, [isCardCollapsed, cardTab]);

  // Keyboard shortcuts for switching tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setCardTab("question");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        setCardTab("answer");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "3") {
        e.preventDefault();
        setCardTab("split");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const handleEndApp = () => {
    const electron = (window as any).electronAPI;
    if (electron?.closeWindow) {
      electron.closeWindow();
    } else {
      if (isCapturing) onToggleCapture();
      showToast("Session ended", "info");
    }
  };

  // Format speech stream chunks as discrete pills like the screenshot
  const displaySpeechPills = (): string[] => {
    const rawText = interimText.trim() || (transcript.length > 0 ? transcript[transcript.length - 1].text : "");
    if (!rawText) return ["What happens when", "I type a", "URL into the", "browser?"];

    // Filter out internal system logs
    if (rawText.startsWith("[") && rawText.endsWith("]")) {
      return ["Listening...", "(speech", "detected)"];
    }

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
    return pills.slice(-4);
  };

  // Parse structured answer: TL;DR and bullets
  const parseAnswerContent = (content: string) => {
    if (!content) return { tldr: "DNS, connection, request, render.", bullets: [
      { prefix: "Resolve:", text: "the host goes through the cache chain, then the recursive resolver." },
      { prefix: "Connect:", text: "TCP handshake, then TLS — ALPN negotiates HTTP/2 here." },
      { prefix: "Render:", text: "the server responds; the browser parses HTML, builds the DO" }
    ]};

    let tldr = "";
    const bullets: { prefix: string; text: string }[] = [];
    const lines = content.split("\n").map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (line.includes("⭐") || line.toLowerCase().startsWith("**answer:**") || line.toLowerCase().startsWith("answer:")) {
        tldr = line.replace(/^[⭐\s*]*(answer:)?/i, "").replace(/^\*+/g, "").replace(/\*+$/g, "").trim();
      } else if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) {
        const clean = line.replace(/^[•\-*]\s*/, "");
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
          { prefix: "Render:", text: "the server responds; the browser parses HTML, builds the DO" }
        ]
      };

  return (
    <div className="prateek-overlay-wrapper">
      {/* FLOATING HUD & ANSWER CARD OVERLAY CONTAINER (100% Transparent Desktop Background) */}
      <div className="prateek-floating-hud-container">
        {/* TOP HUD BAR (Draggable region) */}
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
              title="Answer current question (⌘ + Enter)"
            >
              <span className="pill-text">Answer</span>
              <span className="prateek-kbd">⌘↵</span>
            </button>

            <button
              className="prateek-pill-btn"
              onClick={onCaptureScreenshot}
              title="Take screenshot & solve (⌘ + Shift + Enter)"
            >
              <span className="pill-text">Screenshot</span>
              <span className="prateek-kbd">⌘⇧↵</span>
            </button>

            <button
              className={`prateek-pill-btn prateek-pill-dashed ${isChatOpen ? "active" : ""}`}
              onClick={() => setIsChatOpen(!isChatOpen)}
              title="Toggle Custom Prompt (⌘ + Shift + Backspace)"
            >
              <span className="pill-text">Chat</span>
              <span className="prateek-kbd">⌘⇧⌫</span>
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
              title={isCardCollapsed ? "Expand Answer Card" : "Collapse to Bar"}
            >
              {isCardCollapsed ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
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

            <button
              className="prateek-end-btn"
              onClick={handleEndApp}
              title="Close Application"
            >
              End
            </button>
          </div>
        </div>

        {/* INLINE QUICK CHAT DRAWER */}
        {isChatOpen && (
          <form className="prateek-chat-drawer no-drag" onSubmit={handleChatSubmit}>
            <input
              type="text"
              className="prateek-chat-input"
              placeholder="Ask anything (e.g. What happens when I type a URL into the browser?)..."
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
          <div className="prateek-audio-bars no-drag" title={isCapturing ? "Live Audio Capturing" : "Audio Muted"}>
            <span className={`bar bar-1 ${isCapturing ? "bouncing" : ""}`} />
            <span className={`bar bar-2 ${isCapturing ? "bouncing" : ""}`} />
            <span className={`bar bar-3 ${isCapturing ? "bouncing" : ""}`} />
          </div>

          {/* Speech Chunks as Rounded Pills */}
          <div className="prateek-speech-tokens-container no-drag">
            {displaySpeechPills().map((pill, idx) => (
              <span key={idx} className="prateek-token-pill">
                {pill}
              </span>
            ))}
          </div>

          {/* Right Action: Clear and Expand */}
          <div className="prateek-speech-actions no-drag">
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
        {/* MAIN FLOATING QUESTION & ANSWER CARD */}
        {!isCardCollapsed && (
          <div className={`prateek-card no-drag ${cardTab === "split" ? "split-mode" : ""}`}>
            {/* Card Top Navigation & Left/Right Tabs */}
            <div className="prateek-card-top">
              <div className="prateek-card-top-left">
                {/* Previous / Next Question Navigation */}
                <div className="prateek-history-nav">
                  <button
                    className="prateek-nav-btn"
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    title="Previous Question (⌘ + ←)"
                  >
                    <span className="prateek-kbd">⌘←</span>
                  </button>
                  <button
                    className="prateek-nav-btn"
                    onClick={handleNext}
                    disabled={!canGoNext}
                    title="Next Question (⌘ + →)"
                  >
                    <span className="prateek-kbd">⌘→</span>
                  </button>
                </div>

                {/* Left & Right Segmented Tabs */}
                <div className="prateek-segmented-tabs">
                  <button
                    className={`prateek-tab-btn ${cardTab === "question" ? "active" : ""}`}
                    onClick={() => setCardTab("question")}
                    title="Question / What I Asked (⌘ + 1)"
                  >
                    <MessageSquare size={13} />
                    <span>Question</span>
                    <span className="tab-kbd">⌘1</span>
                  </button>

                  <button
                    className={`prateek-tab-btn ${cardTab === "answer" ? "active" : ""}`}
                    onClick={() => setCardTab("answer")}
                    title="AI Answer & Solution (⌘ + 2)"
                  >
                    <Sparkles size={13} />
                    <span>Answer</span>
                    <span className="tab-kbd">⌘2</span>
                  </button>

                  <button
                    className={`prateek-tab-btn ${cardTab === "split" ? "active" : ""}`}
                    onClick={() => setCardTab("split")}
                    title="Split: Question on Left, Answer on Right (⌘ + 3)"
                  >
                    <Columns2 size={13} />
                    <span>Split</span>
                    <span className="tab-kbd">⌘3</span>
                  </button>
                </div>
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

            {/* CARD BODY: Tabs or Split View */}
            <div className={`prateek-card-body ${cardTab === "split" ? "split" : "single"}`}>
              {/* LEFT TAB / COLUMN: WHAT I ASKED */}
              {(cardTab === "question" || cardTab === "split") && (
                <div className="prateek-question-panel">
                  <div className="prateek-panel-subhead">
                    <div className="subhead-left">
                      <MessageSquare size={14} className="icon-sky" />
                      <span className="subhead-title">What I Asked</span>
                      {activeResponse?.mode && (
                        <span className="mode-pill">{activeResponse.mode.replace("_", " ")}</span>
                      )}
                    </div>
                    <div className="subhead-right">
                      <span className="subhead-timestamp">
                        {activeResponse?.timestamp || "Just now"}
                      </span>
                      <button
                        className="prateek-copy-icon-btn"
                        onClick={handleCopyQuestion}
                        title="Copy Question"
                      >
                        {copiedQuestion ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Primary Prompt Text Box */}
                  <div className="prateek-question-box">
                    <p className="prateek-question-text">
                      {activeResponse
                        ? activeResponse.prompt
                        : "What happens when I type a URL into the browser?"}
                    </p>
                  </div>

                  {/* Screen Snapshot Context (if available) */}
                  {activeSnippet && (
                    <div className="prateek-snippet-box">
                      <div className="snippet-box-header">
                        <Monitor size={12} className="icon-sky" />
                        <span>Captured Screen Context</span>
                      </div>
                      <img
                        src={activeSnippet.dataUrl}
                        alt="Screen capture"
                        className="snippet-preview-img"
                      />
                    </div>
                  )}

                  {/* Session Questions History */}
                  {responseHistory.length > 0 && (
                    <div className="prateek-history-questions-box">
                      <div className="history-header-row">
                        <Clock size={12} />
                        <span>All Questions Asked ({responseHistory.length})</span>
                      </div>
                      <div className="history-questions-scroll">
                        {responseHistory.map((item, idx) => {
                          const isSelected = activeResponse?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              className={`history-q-item ${isSelected ? "selected" : ""}`}
                              onClick={() => onSelectResponse(item.id)}
                              title={item.prompt}
                            >
                              <span className="q-badge">#{responseHistory.length - idx}</span>
                              <span className="q-text">{item.prompt}</span>
                              <span className="q-time">{item.timestamp}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* RIGHT TAB / COLUMN: AI ANSWER & SOLUTION */}
              {(cardTab === "answer" || cardTab === "split") && (
                <div className="prateek-answer-panel">
                  <div className="prateek-panel-subhead">
                    <div className="subhead-left">
                      <Sparkles size={14} className="icon-amber" />
                      <span className="subhead-title">AI Solution</span>
                      {activeResponse?.isStreaming && (
                        <span className="generating-pulse">Generating...</span>
                      )}
                    </div>
                    <div className="subhead-right">
                      {profile.targetRole && (
                        <span className="footer-profile-pill">{profile.targetRole}</span>
                      )}
                      <button
                        className="prateek-copy-icon-btn"
                        onClick={handleCopyAnswer}
                        title="Copy Solution"
                      >
                        {copiedAnswer ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

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

                  {/* Footer Row: Timestamp & Feedback */}
                  <div className="prateek-card-footer">
                    <div className="footer-left">
                      <span className="footer-meta">
                        Answer · {activeResponse?.timestamp || new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
                      </span>
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
        )}
      </div>
    </div>
  );
};
