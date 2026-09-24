import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { ConsentGate } from "./components/ConsentGate";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { ScreenVisionPanel } from "./components/ScreenVisionPanel";
import { AssistantPanel } from "./components/AssistantPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ResumeModal } from "./components/ResumeModal";
import { SpeechService } from "./services/speechService";
import { AIEngine } from "./services/aiEngine";
import type {
  TranscriptItem,
  AssistantMode,
  CandidateProfile,
  ScreenSnippet,
  AIResponse,
  ConsentAudit,
  PresetScenario,
  SpeakerType
} from "./types";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import "./App.css";

const DEFAULT_PROFILE: CandidateProfile = {
  name: "Alex Morgan",
  targetRole: "Senior Full-Stack & Systems Engineer",
  yearsExp: "6+",
  primaryLanguages: ["TypeScript", "Python", "Go", "Java"],
  frameworks: ["React", "Node.js", "Docker", "PostgreSQL", "Redis"],
  keyProjects: "Architected event-driven microservices processing 15k events/sec; optimized database indexes reducing p99 latency by 45%.",
  customGuidelines: "Be concise. Prioritize trade-offs and real-world system resilience over academic trivia."
};

export default function App() {
  const [consent, setConsent] = useState<ConsentAudit>(() => {
    const saved = localStorage.getItem("stealthai_consent");
    return saved
      ? JSON.parse(saved)
      : {
          granted: false,
          timestamp: null,
          participantNoticeAcknowledged: false,
          localOnlyMode: false
        };
  });

  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const saved = localStorage.getItem("stealthai_profile");
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem("stealthai_gemini_key") || "";
  });

  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>("");
  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerType>("Interviewer");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [activeSnippet, setActiveSnippet] = useState<ScreenSnippet | null>(null);
  const [activeMode, setActiveMode] = useState<AssistantMode>("coding");

  // Multi-response history
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);

  const [autoAnswer, setAutoAnswer] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);

  const autoAnswerRef = useRef<boolean>(true);
  const speechAccumulatorRef = useRef<string>("");
  const autoAnswerTimerRef = useRef<any>(null);
  const triggerGenRef = useRef<(prompt: string, modeOverride?: AssistantMode) => void>(() => {});

  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);

  const showToast = (text: string, type: "info" | "success" | "error" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("stealthai_consent", JSON.stringify(consent));
  }, [consent]);

  useEffect(() => {
    localStorage.setItem("stealthai_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("stealthai_gemini_key", apiKey);
    SpeechService.setApiKey(apiKey);
  }, [apiKey]);

  // Determine mode automatically from prompt
  const detectMode = (prompt: string, currentMode: AssistantMode): AssistantMode => {
    const p = prompt.toLowerCase();
    if (
      p.includes("tell me about yourself") ||
      p.includes("walk me through your resume") ||
      p.includes("about your background") ||
      p.includes("about your experience") ||
      p.includes("past projects") ||
      p.includes("tell me about a time") ||
      p.includes("conflict") ||
      p.includes("disagreement") ||
      p.includes("leadership") ||
      p.includes("failure")
    ) {
      return "behavioral";
    }
    if (p.includes("design a") || p.includes("system design") || p.includes("rate limit") || p.includes("url shortener") || p.includes("architecture")) {
      return "system_design";
    }
    if (p.includes("binary search") || p.includes("linked list") || p.includes("two sum") || p.includes("reverse") || p.includes("tree") || p.includes("cache") || p.includes("leetcode") || p.includes("algorithm")) {
      return "coding";
    }
    return currentMode;
  };

  // Assistant generator
  const triggerGeneration = useCallback((promptText: string, modeOverride?: AssistantMode) => {
    if (!promptText || promptText.trim().length === 0) return;
    const cleanPrompt = promptText.trim();
    const mode = modeOverride || detectMode(cleanPrompt, activeMode);
    setActiveMode(mode);

    const responseId = crypto.randomUUID();
    const timestamp = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());

    const newResponse: AIResponse = {
      id: responseId,
      mode,
      timestamp,
      prompt: cleanPrompt,
      content: "",
      isStreaming: true,
      tokensGenerated: 0
    };

    // Add to history and make active
    setResponses((prev) => [newResponse, ...prev]);
    setActiveResponseId(responseId);

    AIEngine.generateStreamingResponse(
      cleanPrompt,
      mode,
      profile,
      activeSnippet,
      consent.localOnlyMode ? "" : apiKey,
      {
        onToken: (_token, accumulated) => {
          setResponses((prev) =>
            prev.map((r) =>
              r.id === responseId
                ? {
                    ...r,
                    content: accumulated,
                    tokensGenerated: r.tokensGenerated + 1
                  }
                : r
            )
          );
        },
        onComplete: (finalText) => {
          setResponses((prev) =>
            prev.map((r) =>
              r.id === responseId
                ? {
                    ...r,
                    content: finalText,
                    isStreaming: false
                  }
                : r
            )
          );
          showToast("AI solution ready", "success");
        },
        onError: (err) => {
          showToast(err, "error");
          setResponses((prev) =>
            prev.map((r) =>
              r.id === responseId
                ? {
                    ...r,
                    isStreaming: false
                  }
                : r
            )
          );
        }
      }
    );
  }, [activeMode, profile, activeSnippet, consent.localOnlyMode, apiKey]);

  // Keep ref up to date
  useEffect(() => {
    triggerGenRef.current = triggerGeneration;
  }, [triggerGeneration]);

  // Audio capture handler
  const handleToggleCapture = useCallback(async () => {
    if (!consent.granted) {
      setConsent((prev) => ({
        ...prev,
        granted: true,
        timestamp: new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())
      }));
      showToast("Participant consent acknowledged. Starting microphone...", "success");
    }

    if (isCapturing) {
      SpeechService.stopListening();
      setIsCapturing(false);
      setInterimText("");
      speechAccumulatorRef.current = "";
      if (autoAnswerTimerRef.current) {
        clearTimeout(autoAnswerTimerRef.current);
      }
      showToast("Captions paused.", "info");
    } else {
      SpeechService.setSpeaker(activeSpeaker);
      SpeechService.setApiKey(apiKey);
      const success = await SpeechService.startListening(
        (finalItem) => {
          setTranscript((prev) => [...prev, finalItem]);
          setInterimText("");

          // AUTO-ANSWER WITH CONTINUOUS BUFFERING:
          if (autoAnswerRef.current && finalItem.text.trim().length > 2) {
            speechAccumulatorRef.current = (speechAccumulatorRef.current + " " + finalItem.text).trim();

            if (autoAnswerTimerRef.current) {
              clearTimeout(autoAnswerTimerRef.current);
            }

            autoAnswerTimerRef.current = setTimeout(() => {
              const fullQuestion = speechAccumulatorRef.current.trim();
              if (fullQuestion.length > 3) {
                showToast(`Answering question: "${fullQuestion.slice(0, 32)}..."`, "info");
                triggerGenRef.current(fullQuestion);
              }
              speechAccumulatorRef.current = "";
            }, 1000);
          }
        },
        (interim) => {
          setInterimText(interim);
        },
        (err) => {
          showToast(err, "error");
        }
      );

      if (success) {
        setIsCapturing(true);
        showToast("Audio transcription active (Continuous listening).", "success");
      }
    }
  }, [consent.granted, isCapturing, activeSpeaker]);

  const handleSetSpeaker = (speaker: SpeakerType) => {
    setActiveSpeaker(speaker);
    SpeechService.setSpeaker(speaker);
  };

  const handleAddManualTranscript = (text: string, speaker: SpeakerType) => {
    const item: TranscriptItem = {
      id: crypto.randomUUID(),
      timestamp: new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date()),
      speaker,
      text
    };
    setTranscript((prev) => [...prev, item]);
    showToast(`Added ${speaker} entry`, "info");
    if (autoAnswer) {
      triggerGeneration(text);
    }
  };

  // Preset question loader
  const handleSelectPreset = (preset: PresetScenario) => {
    setActiveMode(preset.mode);
    const item: TranscriptItem = {
      id: crypto.randomUUID(),
      timestamp: new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(new Date()),
      speaker: preset.speaker,
      text: preset.prompt
    };
    setTranscript((prev) => [...prev, item]);
    showToast(`Loaded preset: ${preset.title}`, "info");
    triggerGeneration(preset.prompt, preset.mode);
  };

  // Active response object from history
  const activeResponse = responses.find((r) => r.id === activeResponseId) || responses[0] || null;

  // Export full meeting report
  const handleExport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      metadata: {
        sessionType: "Collaborative Meeting & Technical Assistant",
        consentAudited: consent.granted,
        consentTimestamp: consent.timestamp,
        localOnlyProcessing: consent.localOnlyMode,
        candidateName: profile.name,
        targetRole: profile.targetRole,
        resumeIngested: Boolean(profile.resumeText)
      },
      transcripts: transcript,
      allQuestionsAndSolutions: responses.map((r) => ({
        mode: r.mode,
        prompt: r.prompt,
        timestamp: r.timestamp,
        solution: r.content
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stealthai-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Session report exported as JSON", "success");
  };

  return (
    <div className="app-layout">
      {/* Top Navigation & Status Bar */}
      <Header
        isCapturing={isCapturing}
        consent={consent}
        profile={profile}
        onOpenResumeModal={() => setIsResumeModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExport={handleExport}
      />

      {/* Main Container */}
      <main className="main-content">
        {/* Consent & Visible Protocol Banner */}
        {!consent.granted && (
          <ConsentGate
            consent={consent}
            onUpdateConsent={(updated) => setConsent((prev) => ({ ...prev, ...updated }))}
            onConfirm={() => {
              if (consent.granted) {
                showToast("Consent confirmed. Session ready.", "success");
              }
            }}
          />
        )}

        {/* Dual Panel Workspace */}
        <div className="workspace-grid">
          {/* Left Column: Live Audio Speech-to-Text & Screen Vision */}
          <div className="workspace-column left-col">
            <TranscriptPanel
              transcript={transcript}
              interimText={interimText}
              isCapturing={isCapturing}
              activeSpeaker={activeSpeaker}
              consentGranted={consent.granted}
              autoAnswer={autoAnswer}
              onToggleAutoAnswer={() => {
                setAutoAnswer((prev) => {
                  const nextVal = !prev;
                  showToast(`Auto-Answer is now ${nextVal ? "ON" : "OFF"}`, "info");
                  return nextVal;
                });
              }}
              onToggleCapture={handleToggleCapture}
              onSetSpeaker={handleSetSpeaker}
              onAddManualTranscript={handleAddManualTranscript}
              onClearTranscript={() => {
                setTranscript([]);
                showToast("Transcript cleared", "info");
              }}
              onExport={handleExport}
              onSelectPreset={handleSelectPreset}
              onSendToAssistant={(text) => triggerGeneration(text)}
            />

            <ScreenVisionPanel
              activeSnippet={activeSnippet}
              onSnippetCaptured={(snippet) => {
                setActiveSnippet(snippet);
                if (snippet) showToast("Screen snapshot attached", "success");
              }}
              onAnalyzeSnippet={() => {
                triggerGeneration("Analyze the problem diagram or code snippet from the screen.", "coding");
              }}
            />
          </div>

          {/* Right Column: AI Copilot & Solution Stream */}
          <div className="workspace-column right-col">
            <AssistantPanel
              activeMode={activeMode}
              profile={profile}
              activeResponse={activeResponse}
              responseHistory={responses}
              onSelectResponse={(id) => setActiveResponseId(id)}
              onSetMode={(mode) => setActiveMode(mode)}
              onGenerate={(prompt) => triggerGeneration(prompt)}
              onStop={() => {
                AIEngine.stopGeneration();
                if (activeResponseId) {
                  setResponses((prev) =>
                    prev.map((r) =>
                      r.id === activeResponseId
                        ? { ...r, isStreaming: false }
                        : r
                    )
                  );
                }
                showToast("Stream halted", "info");
              }}
            />
          </div>
        </div>
      </main>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className={`toast-notification ${toastMessage.type}`}>
          {toastMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Resume Modal */}
      <ResumeModal
        isOpen={isResumeModalOpen}
        profile={profile}
        onSaveProfile={(p) => setProfile(p)}
        onClose={() => setIsResumeModalOpen(false)}
        showToast={showToast}
        onTriggerTestQuestion={(q) => {
          const item: TranscriptItem = {
            id: crypto.randomUUID(),
            timestamp: new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()),
            speaker: "Interviewer",
            text: q
          };
          setTranscript((prev) => [...prev, item]);
          triggerGeneration(q);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        profile={profile}
        apiKey={apiKey}
        consent={consent}
        onSaveProfile={(p) => setProfile(p)}
        onSaveApiKey={(k) => setApiKey(k)}
        onSaveConsent={(c) => setConsent(c)}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
