import React, { useState, useRef, useEffect } from "react";
import { Brain, Code, UserCheck, Layout, FileText, Copy, Check, Square, Sparkles, Send, Loader2, History, ChevronRight } from "lucide-react";
import type { AssistantMode, CandidateProfile, AIResponse } from "../types";

interface Props {
  activeMode: AssistantMode;
  profile: CandidateProfile;
  activeResponse: AIResponse | null;
  responseHistory: AIResponse[];
  onSelectResponse: (id: string) => void;
  onSetMode: (mode: AssistantMode) => void;
  onGenerate: (prompt: string) => void;
  onStop: () => void;
}

export const AssistantPanel: React.FC<Props> = ({
  activeMode,
  profile,
  activeResponse,
  responseHistory,
  onSelectResponse,
  onSetMode,
  onGenerate,
  onStop
}) => {
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeResponse?.isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [activeResponse?.content]);

  const handleCopy = () => {
    if (!activeResponse?.content) return;
    navigator.clipboard.writeText(activeResponse.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromptSubmit = () => {
    if (!customPrompt.trim()) return;
    onGenerate(customPrompt.trim());
    setCustomPrompt("");
  };

  return (
    <div className="panel assistant-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <Brain size={18} className="text-accent" />
          <h3>Real-Time Copilot</h3>
          <span className="profile-chip" title="Active Candidate Profile">
            {profile.name} • {profile.targetRole}
          </span>
        </div>

        <div className="mode-toggle-group">
          <button
            className={`mode-btn ${activeMode === "coding" ? "active" : ""}`}
            onClick={() => onSetMode("coding")}
          >
            <Code size={14} /> Coding
          </button>
          <button
            className={`mode-btn ${activeMode === "behavioral" ? "active" : ""}`}
            onClick={() => onSetMode("behavioral")}
          >
            <UserCheck size={14} /> STAR Behavioral
          </button>
          <button
            className={`mode-btn ${activeMode === "system_design" ? "active" : ""}`}
            onClick={() => onSetMode("system_design")}
          >
            <Layout size={14} /> System Design
          </button>
          <button
            className={`mode-btn ${activeMode === "meeting_notes" ? "active" : ""}`}
            onClick={() => onSetMode("meeting_notes")}
          >
            <FileText size={14} /> Notes & Actions
          </button>
        </div>
      </div>

      {/* Multi-Question Session Tabs if more than 1 question exists */}
      {responseHistory.length > 1 && (
        <div className="questions-history-tabbar">
          <div className="history-tab-label">
            <History size={13} />
            <span>Questions ({responseHistory.length}):</span>
          </div>
          <div className="history-tabs-scroll">
            {responseHistory.map((resp, idx) => {
              const isSelected = activeResponse?.id === resp.id;
              return (
                <button
                  key={resp.id}
                  className={`history-tab-chip ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectResponse(resp.id)}
                  title={resp.prompt}
                >
                  <span className="tab-number">Q{idx + 1}:</span>
                  <span className="tab-title">
                    {resp.prompt.slice(0, 24)}...
                  </span>
                  {resp.isStreaming && <span className="tab-streaming-dot"></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Response Streaming Container */}
      <div className="response-container" ref={containerRef}>
        {!activeResponse ? (
          <div className="assistant-placeholder">
            <Sparkles size={36} className="sparkle-icon" />
            <h4>AI Companion Ready</h4>
            <p>
              Speak a question into your microphone or choose a quick suggestion below. Auto-Answer will stream the solution here.
            </p>
            <div className="quick-suggestions">
              <span className="suggestion-label">Try asking:</span>
              <button onClick={() => onGenerate("Reverse nodes in k-group with O(1) space")}>
                ⚡ "Reverse nodes in k-group with O(1) space"
              </button>
              <button onClick={() => onGenerate("How to structure a STAR response for scaling database bottleneck?")}>
                ⚡ "STAR response for scaling database bottleneck"
              </button>
              <button onClick={() => onGenerate("Design a real-time collaborative document editor like Google Docs")}>
                ⚡ "System design for collaborative editor"
              </button>
              <button onClick={() => onGenerate("How to implement binary search in TypeScript?")}>
                ⚡ "Binary search in TypeScript"
              </button>
            </div>
          </div>
        ) : (
          <div className="response-content-wrapper">
            {/* Header with prompt query */}
            <div className="response-query-banner">
              <div className="query-meta">
                <span className="query-label">QUESTION / PROMPT:</span>
                <span className="query-text">"{activeResponse.prompt}"</span>
              </div>
              <div className="response-tools">
                {activeResponse.isStreaming ? (
                  <button className="btn-stop-stream" onClick={onStop}>
                    <Square size={14} /> Stop
                  </button>
                ) : (
                  <button className="btn-copy-response" onClick={handleCopy}>
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy Solution"}
                  </button>
                )}
              </div>
            </div>

            <div className="response-header-bar">
              <div className="response-meta">
                <span className="badge-mode">{activeResponse.mode.toUpperCase()}</span>
                <span className="response-time">{activeResponse.timestamp}</span>
                {activeResponse.isStreaming && (
                  <span className="badge-streaming">
                    <Loader2 size={13} className="spin-icon" />
                    <span>Streaming answer... ({activeResponse.tokensGenerated} tokens)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="markdown-body">
              {activeResponse.content ? (
                <>
                  <FormattedMarkdown text={activeResponse.content} />
                  {activeResponse.isStreaming && <span className="typing-cursor">█</span>}
                </>
              ) : (
                <div className="generating-placeholder">
                  <Loader2 size={24} className="spin-icon text-accent" />
                  <div>
                    <h5>Synthesizing Solution...</h5>
                    <p>Formulating optimal approach, time/space complexity, and code for: <em>"{activeResponse.prompt}"</em></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Prompt Bar */}
      <div className="assistant-input-bar">
        <textarea
          rows={2}
          placeholder="Ask a technical follow-up, algorithm constraint, or STAR outline..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePromptSubmit();
            }
          }}
        />
        <button
          className="btn-generate"
          disabled={!customPrompt.trim()}
          onClick={handlePromptSubmit}
        >
          <Send size={15} />
          <span>Ask</span>
        </button>
      </div>
    </div>
  );
};

// Formatted renderer for code blocks and headers
function FormattedMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  lines.forEach((line, index) => {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${index}`} className="code-block-wrapper">
            <div className="code-header">
              <span>{codeLang || "code"}</span>
              <button
                className="btn-copy-code"
                onClick={() => navigator.clipboard.writeText(codeBuffer.join("\n"))}
              >
                Copy
              </button>
            </div>
            <pre>
              <code>{codeBuffer.join("\n")}</code>
            </pre>
          </div>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.replace("```", "").trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={index}>{line.replace("### ", "")}</h3>);
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={index}>{line.replace("#### ", "")}</h4>);
    } else if (line.startsWith("* ") || line.startsWith("- ")) {
      elements.push(
        <li key={index} className="bullet-point">
          {formatInline(line.replace(/^[*-] /, ""))}
        </li>
      );
    } else if (line.trim().length === 0) {
      elements.push(<div key={index} className="spacer" />);
    } else {
      elements.push(<p key={index}>{formatInline(line)}</p>);
    }
  });

  // Render open code blocks immediately while streaming
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <div key="unclosed-streaming-code" className="code-block-wrapper">
        <div className="code-header">
          <span>{codeLang || "code"} (streaming...)</span>
        </div>
        <pre>
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      </div>
    );
  }

  return <div className="rendered-markdown">{elements}</div>;
}

function formatInline(str: string): React.ReactNode {
  const parts = str.split(/(\x60[^\x60]+\x60|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("\x60") && part.endsWith("\x60")) {
      return <code key={i} className="inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
