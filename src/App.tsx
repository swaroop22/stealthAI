import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { ConsentGate } from "./components/ConsentGate";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { ScreenVisionPanel } from "./components/ScreenVisionPanel";
import { AssistantPanel } from "./components/AssistantPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ResumeModal } from "./components/ResumeModal";
import { CodingAssistant } from "./components/CodingAssistant";
import { SpeechService } from "./services/speechService";
import { ScreenCaptureService } from "./services/screenService";
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
import { AlertCircle, CheckCircle2, LayoutGrid, Layers } from "lucide-react";
import { extractLastQuestionFromSpeech } from "./utils/speechExtractor";
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

const DEFAULT_INITIAL_RESPONSE: AIResponse = {
  id: "initial-explain-yourself-response",
  mode: "coding",
  timestamp: "03:57 PM",
  prompt: "Explain yourself",
  content: `I'm a **Lead Data Engineer** with more than 15 years of experience building and supporting enterprise data platforms across banking, healthcare, and pharmaceutical domains. My main strengths are **Python, SQL, Databricks, Apache Spark, dbt, Snowflake, and AWS**.

In my current role at **PNC**, I lead the enterprise data lakehouse migration and distributed analytics architecture.`,
  isStreaming: false,
  tokensGenerated: 58
};

const DEFAULT_INITIAL_TRANSCRIPT: TranscriptItem[] = [];

export default function App() {
  const [viewMode, setViewMode] = useState<"overlay" | "dashboard">("overlay");

  const [consent, setConsent] = useState<ConsentAudit>(() => {
    const saved = localStorage.getItem("stealthai_consent");
    return saved
      ? JSON.parse(saved)
      : {
          granted: true,
          timestamp: new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
          participantNoticeAcknowledged: true,
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
  const [transcript, setTranscript] = useState<TranscriptItem[]>(DEFAULT_INITIAL_TRANSCRIPT);
  const [activeSnippet, setActiveSnippet] = useState<ScreenSnippet | null>(null);
  const [activeMode, setActiveMode] = useState<AssistantMode>("coding");

  // Multi-response history
  const [responses, setResponses] = useState<AIResponse[]>([]);
  const [activeResponseId, setActiveResponseId] = useState<string | null>(null);

  const [autoAnswer, setAutoAnswer] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);

  const autoAnswerRef = useRef<boolean>(false);
  const speechAccumulatorRef = useRef<string>("");
  const autoAnswerTimerRef = useRef<any>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const isGeneratingRef = useRef<boolean>(false);
  const triggerGenRef = useRef<(prompt: string, modeOverride?: AssistantMode) => void>(() => {});

  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);

  // Resize Electron window dynamically on viewMode change
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.resizeWindow) {
      if (viewMode === "dashboard") {
        electron.resizeWindow(1200, 800);
      } else {
        electron.resizeWindow(720, 520);
      }
    }
  }, [viewMode]);

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
  const triggerGeneration = useCallback(
    (promptText: string, modeOverride?: AssistantMode, contextText?: string) => {
      if (!promptText || promptText.trim().length === 0) return;
      const cleanPrompt = promptText.trim();
      const mode = modeOverride || detectMode(cleanPrompt, activeMode);
      setActiveMode(mode);

      const responseId = crypto.randomUUID();
      const timestamp = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit"
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
      isGeneratingRef.current = true;
      lastTriggerTimeRef.current = Date.now();

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
            isGeneratingRef.current = false;
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
            isGeneratingRef.current = false;
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
        },
        contextText
      );
    },
    [activeMode, profile, activeSnippet, consent.localOnlyMode, apiKey]
  );

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
  }, [consent.granted, isCapturing, activeSpeaker, apiKey]);

  const handleCaptureScreenshot = async () => {
    try {
      const snippet = await ScreenCaptureService.captureScreen("Meeting screen capture");
      setActiveSnippet(snippet);
      showToast("Screen captured! Analyzing...", "success");
      triggerGeneration("Analyze the problem diagram or code snippet from the screen.", "coding");
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        showToast(err.message || "Failed to capture screen", "error");
      }
    }
  };

  const handleTriggerAnswer = (promptOverride?: string) => {
    if (promptOverride && promptOverride.trim()) {
      triggerGeneration(promptOverride.trim());
      return;
    }

    // Extract the latest/last question from the end of the speech transcript
    const extracted = extractLastQuestionFromSpeech(transcript, interimText);
    if (extracted.question && extracted.question.trim().length > 2) {
      showToast(`Answering: "${extracted.question.slice(0, 42)}..."`, "info");
      triggerGeneration(extracted.question.trim(), undefined, extracted.fullTranscriptText);
      return;
    }

    if (activeSnippet) {
      triggerGeneration("Analyze the problem from the screen snapshot.", "coding");
      return;
    }

    showToast("Please turn on the mic and speak, then click Answer.", "info");
  };

  const handleClearCurrentAnswer = () => {
    if (activeResponseId) {
      const remaining = responses.filter((r) => r.id !== activeResponseId);
      setResponses(remaining);
      setActiveResponseId(null);
    } else {
      setResponses([]);
      setActiveResponseId(null);
    }
    showToast("Answer cleared", "info");
  };

  // Keyboard Shortcuts (⌘ + Enter, ⌘ + Shift + Enter, ⌘ + Backspace, ⌘ + ←, ⌘ + →)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (!isCmd) return;

      // ⌘ + Shift + Enter: Screenshot
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleCaptureScreenshot();
        return;
      }

      // ⌘ + Enter: Answer
      if (!e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleTriggerAnswer();
        return;
      }

      // ⌘ + Shift + Backspace: Clear Transcript
      if (e.shiftKey && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        setTranscript([]);
        setInterimText("");
        speechAccumulatorRef.current = "";
        showToast("Transcript cleared", "info");
        return;
      }

      // ⌘ + Backspace: Clear current answer
      if (!e.shiftKey && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        handleClearCurrentAnswer();
        return;
      }

      // ⌘ + ArrowLeft: Prev
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = responses.findIndex((r) => r.id === activeResponseId);
        if (idx < responses.length - 1 && responses[idx + 1]) {
          setActiveResponseId(responses[idx + 1].id);
        }
        return;
      }

      // ⌘ + ArrowRight: Next
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const idx = responses.findIndex((r) => r.id === activeResponseId);
        if (idx > 0 && responses[idx - 1]) {
          setActiveResponseId(responses[idx - 1].id);
        }
        return;
      }

      // ⌘ + \ or ⌘ + H: Toggle/Hide Window
      if (e.key === "\\" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        const electron = (window as any).electronAPI;
        if (electron?.toggleWindow) {
          electron.toggleWindow();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeResponseId, responses, transcript, activeSnippet]);

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
  };

  const handleSelectPreset = (preset: PresetScenario) => {
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
    triggerGeneration(preset.prompt, preset.mode);
  };

  const activeResponse = responses.find((r) => r.id === activeResponseId) || (responses.length > 0 ? responses[0] : null);

  const handleExport = () => {
    const report = {
      metadata: {
        exportedAt: new Date().toISOString(),
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
    <>
      {viewMode === "overlay" ? (
        /* CODING ASSISTANT FLOATING HUD & ANSWER CARD OVERLAY */
        <CodingAssistant
          isCapturing={isCapturing}
          activeSpeaker={activeSpeaker}
          interimText={interimText}
          transcript={transcript}
          activeResponse={activeResponse}
          responseHistory={responses}
          activeSnippet={activeSnippet}
          consent={consent}
          profile={profile}
          apiKey={apiKey}
          onToggleCapture={handleToggleCapture}
          onCaptureScreenshot={handleCaptureScreenshot}
          onTriggerAnswer={handleTriggerAnswer}
          onSelectResponse={(id) => setActiveResponseId(id)}
          onClearCurrentAnswer={handleClearCurrentAnswer}
          onClearTranscript={() => {
            setTranscript([]);
            setInterimText("");
            showToast("Transcript cleared", "info");
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenResumeModal={() => setIsResumeModalOpen(true)}
          onExportSession={handleExport}
          onSwitchToDashboard={() => setViewMode("dashboard")}
          showToast={showToast}
        />
      ) : (
        /* FULL DASHBOARD STUDIO VIEW */
        <div className="app-layout">
          <div className="view-switch-banner">
            <button
              className="btn-overlay-mode"
              onClick={() => setViewMode("overlay")}
              title="Return to Coding Assistant Floating HUD"
            >
              <Layers size={15} />
              <span>Switch to Coding Assistant Floating HUD Mode</span>
            </button>
          </div>

          <Header
            isCapturing={isCapturing}
            consent={consent}
            profile={profile}
            onOpenResumeModal={() => setIsResumeModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onExport={handleExport}
          />

          <main className="main-content">
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

            <div className="workspace-grid">
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
        </div>
      )}

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
    </>
  );
}
