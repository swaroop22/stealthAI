import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Play, Pause, Trash2, Download, Search, Sparkles, Send, User, Bot, Volume2 } from "lucide-react";
import type { SpeakerType, TranscriptItem, PresetScenario } from "../types";
import { PRESET_SCENARIOS } from "../services/presetScenarios";

interface Props {
  transcript: TranscriptItem[];
  interimText: string;
  isCapturing: boolean;
  activeSpeaker: SpeakerType;
  consentGranted: boolean;
  autoAnswer: boolean;
  onToggleAutoAnswer: () => void;
  onToggleCapture: () => void;
  onSetSpeaker: (speaker: SpeakerType) => void;
  onAddManualTranscript: (text: string, speaker: SpeakerType) => void;
  onClearTranscript: () => void;
  onExport: () => void;
  onSelectPreset: (preset: PresetScenario) => void;
  onSendToAssistant: (text: string) => void;
}

export const TranscriptPanel: React.FC<Props> = ({
  transcript,
  interimText,
  isCapturing,
  activeSpeaker,
  consentGranted,
  autoAnswer,
  onToggleAutoAnswer,
  onToggleCapture,
  onSetSpeaker,
  onAddManualTranscript,
  onClearTranscript,
  onExport,
  onSelectPreset,
  onSendToAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [manualText, setManualText] = useState("");
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimText]);

  const filteredTranscript = transcript.filter((item) => {
    return item.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    onAddManualTranscript(manualText.trim(), activeSpeaker);
    setManualText("");
  };

  return (
    <div className="panel transcript-panel">
      {/* Clickable Header Group */}
      <div className="panel-header">
        <div
          className="panel-title-group clickable-header"
          onClick={onToggleCapture}
          title={isCapturing ? "Click to pause listening" : "Click to start listening"}
        >
          <div className={`mic-indicator-circle ${isCapturing ? "active" : "idle"}`}>
            <Mic size={16} />
          </div>
          <div>
            <div className="header-title-flex">
              <h3>Live Captions & Speech Log</h3>
              <span className={`live-tag ${isCapturing ? "tag-live" : "tag-paused"}`}>
                {isCapturing ? "● LISTENING" : "CLICK TO START"}
              </span>
            </div>
            <span className="count-pill">{transcript.length} dialogue entries</span>
          </div>
        </div>

        <div className="panel-actions">
          {/* Auto-Answer Toggle */}
          <button
            className={`btn-auto-answer ${autoAnswer ? "active" : "inactive"}`}
            onClick={onToggleAutoAnswer}
            title={autoAnswer ? "Auto-Answer is ON: AI answers immediately when you finish speaking" : "Auto-Answer is OFF: Click 'Get AI Solution' on any question"}
          >
            <Sparkles size={13} />
            <span>Auto-Answer: {autoAnswer ? "ON" : "OFF"}</span>
          </button>

          <button
            className={`btn-toggle-mic ${isCapturing ? "btn-danger" : "btn-primary"}`}
            onClick={onToggleCapture}
            title={isCapturing ? "Pause speech transcription" : "Start speech transcription"}
          >
            {isCapturing ? <Pause size={15} /> : <Play size={15} />}
            <span>{isCapturing ? "Pause Captions" : "Start Captions"}</span>
          </button>

          <button
            className="btn-icon"
            onClick={onExport}
            disabled={transcript.length === 0}
            title="Export session transcripts"
          >
            <Download size={16} />
          </button>

          <button
            className="btn-icon text-danger"
            onClick={onClearTranscript}
            disabled={transcript.length === 0}
            title="Clear transcript"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Active Listening Status Bar */}
      {isCapturing && (
        <div className="live-speech-banner">
          <Volume2 size={16} className="volume-icon-pulse" />
          <span>
            Microphone active & listening. {autoAnswer ? "⚡ Auto-Answer is ON — speak a question and AI will solve it!" : "Speak now or click a preset."}
          </span>
        </div>
      )}

      {/* Quick Presets / Simulation Bar */}
      <div className="presets-bar">
        <span className="presets-label">
          <Sparkles size={13} /> Test Scenarios:
        </span>
        <div className="presets-scroll">
          {PRESET_SCENARIOS.map((p) => (
            <button
              key={p.id}
              className="preset-chip"
              onClick={() => onSelectPreset(p)}
              title={p.prompt}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            placeholder="Search spoken dialogue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="speaker-selector">
          <span className="speaker-label">Label Speech As:</span>
          <button
            className={`speaker-btn ${activeSpeaker === "Interviewer" ? "active" : ""}`}
            onClick={() => onSetSpeaker("Interviewer")}
          >
            Interviewer
          </button>
          <button
            className={`speaker-btn ${activeSpeaker === "Candidate" ? "active" : ""}`}
            onClick={() => onSetSpeaker("Candidate")}
          >
            Candidate (Me)
          </button>
        </div>
      </div>

      {/* Transcript List */}
      <div className="transcript-scroll-area">
        {filteredTranscript.length === 0 && !interimText && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <MicOff size={32} className="text-muted" />
            </div>
            <h4>Microphone Not Active Yet</h4>
            <p>
              Click <strong>"Start Captions"</strong> above, or click the big button below to begin speech transcription:
            </p>

            <button className="btn-empty-start" onClick={onToggleCapture}>
              <Play size={16} />
              <span>Turn On Microphone & Listen</span>
            </button>

            <div className="empty-divider">
              <span>OR TEST INSTANTLY WITHOUT SPEAKING</span>
            </div>

            <div className="empty-quick-buttons">
              <button
                className="btn-quick-sample"
                onClick={() => onSelectPreset(PRESET_SCENARIOS[0])}
              >
                ⚡ Test "Design LRU Cache" Question
              </button>
              <button
                className="btn-quick-sample"
                onClick={() => onSelectPreset(PRESET_SCENARIOS[3])}
              >
                ⚡ Test "STAR Conflict" Question
              </button>
            </div>
          </div>
        )}

        {filteredTranscript.map((item) => (
          <div key={item.id} className={`transcript-card ${item.speaker.toLowerCase()}`}>
            <div className="card-meta">
              <span className={`speaker-badge ${item.speaker.toLowerCase()}`}>
                {item.speaker === "Interviewer" ? <User size={12} /> : <Bot size={12} />}
                {item.speaker}
              </span>
              <time>{item.timestamp}</time>
              <button
                className="btn-send-context prominent"
                onClick={() => onSendToAssistant(item.text)}
                title="Generate AI Solution for this question right now"
              >
                ⚡ Get AI Solution →
              </button>
            </div>
            <p className="card-text">{item.text}</p>
          </div>
        ))}

        {interimText && (
          <div className="transcript-card interim">
            <div className="card-meta">
              <span className="speaker-badge interim">
                <span className="dot-blinking"></span> Hearing speech...
              </span>
            </div>
            <p className="card-text interim-text">{interimText}</p>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Manual Speech / Test Input */}
      <div className="manual-input-box">
        <textarea
          placeholder="Type or paste question manually (Press Enter to submit)..."
          rows={2}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleManualSubmit();
            }
          }}
        />
        <button
          className="btn-send-manual"
          disabled={!manualText.trim()}
          onClick={handleManualSubmit}
          title="Add to transcript"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
