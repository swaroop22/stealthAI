import React, { useState, useEffect } from "react";
import { X, User, Key, Shield, Check, ExternalLink, Cpu, Eye, EyeOff, Sparkles, Globe, Server, CheckCircle2, AlertTriangle } from "lucide-react";
import type { CandidateProfile, ConsentAudit, AIProvider, AIProviderConfig } from "../types";

export interface ProviderDef {
  id: AIProvider;
  name: string;
  tag: string;
  icon: string;
  keyPrefix: string;
  keyPlaceholder: string;
  consoleUrl: string;
  consoleName: string;
  description: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  models: { id: string; name: string; desc: string }[];
  supportsVision: boolean;
  supportsSpeech: boolean;
  needsBaseUrl?: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    tag: "GPT-4o / o3",
    icon: "🤖",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-proj-... or sk-...",
    consoleUrl: "https://platform.openai.com/api-keys",
    consoleName: "OpenAI Keys",
    description: "Industry-standard ChatGPT models with multimodal vision, o3-mini/o1 deep reasoning, and Whisper speech transcription.",
    defaultModel: "gpt-4o",
    models: [
      { id: "gpt-4o", name: "GPT-4o", desc: "Omni Flagship — Fast vision & coding" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", desc: "Ultra-fast & lightweight" },
      { id: "o3-mini", name: "o3-mini", desc: "High reasoning for math, algorithms & STEM" },
      { id: "o1", name: "o1", desc: "Deep multi-step thinking flagship" },
      { id: "gpt-4.5-preview", name: "GPT-4.5 Preview", desc: "Massive foundation model" }
    ],
    supportsVision: true,
    supportsSpeech: true
  },
  {
    id: "claude",
    name: "Anthropic Claude",
    tag: "Claude 3.7",
    icon: "🧠",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-api03-...",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    consoleName: "Anthropic Console",
    description: "Exceptional system design, nuances, and architecture depth. Native direct-browser streaming with screenshot vision.",
    defaultModel: "claude-3-7-sonnet-20250219",
    models: [
      { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", desc: "Flagship with hybrid reasoning mode" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", desc: "Elite coding & system architecture benchmark" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", desc: "Ultra-low latency code generation" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", desc: "In-depth multi-disciplinary analysis" }
    ],
    supportsVision: true,
    supportsSpeech: false
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    tag: "Live Search",
    icon: "🔍",
    keyPrefix: "pplx-",
    keyPlaceholder: "pplx-...",
    consoleUrl: "https://www.perplexity.ai/settings/api",
    consoleName: "Perplexity API",
    description: "Real-time web search grounding. Ideal for cutting-edge libraries, current cloud docs, and fact verification.",
    defaultModel: "sonar",
    models: [
      { id: "sonar", name: "Sonar", desc: "Fast search-grounded answers" },
      { id: "sonar-pro", name: "Sonar Pro", desc: "Advanced web reasoning & comprehensive citations" },
      { id: "sonar-reasoning", name: "Sonar Reasoning", desc: "Chain-of-thought with real-time web search" },
      { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", desc: "Elite reasoning model with search" }
    ],
    supportsVision: false,
    supportsSpeech: false
  },
  {
    id: "gemini",
    name: "Google Gemini",
    tag: "Gemini 2.5",
    icon: "✨",
    keyPrefix: "AIzaSy",
    keyPlaceholder: "AIzaSy...",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    consoleName: "Google AI Studio",
    description: "Multimodal speed, 2M+ token context, live screen inspection, and built-in voice audio transcription.",
    defaultModel: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fastest next-gen reasoning & vision" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", desc: "Reliable ultra-low latency production" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", desc: "2M token context for massive codebases" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", desc: "Fast lightweight multimodal" }
    ],
    supportsVision: true,
    supportsSpeech: true
  },
  {
    id: "custom_openai",
    name: "Custom / Local AI",
    tag: "DeepSeek / Groq",
    icon: "⚡",
    keyPrefix: "",
    keyPlaceholder: "API Key (leave blank for local Ollama)",
    consoleUrl: "https://api-docs.deepseek.com/",
    consoleName: "DeepSeek / Docs",
    description: "Any OpenAI-compatible endpoint: DeepSeek (V3 & R1), Groq, OpenRouter, or local Ollama / LM Studio.",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3 (chat)", desc: "DeepSeek V3 671B flagship" },
      { id: "deepseek-reasoner", name: "DeepSeek R1 (reasoner)", desc: "Open-weights deep reasoning" },
      { id: "llama-3.3-70b-versatile", name: "Groq: LLaMA 3.3 70B", desc: "Sub-second inference speed" },
      { id: "openrouter/auto", name: "OpenRouter: auto", desc: "Auto-routing best model" },
      { id: "deepseek-r1", name: "Ollama: deepseek-r1", desc: "Local Ollama on your machine" },
      { id: "llama3.2", name: "Ollama: llama3.2", desc: "Local Ollama on your machine" }
    ],
    supportsVision: true,
    supportsSpeech: true,
    needsBaseUrl: true
  }
];

const PRESET_BASE_URLS = [
  { label: "DeepSeek", url: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { label: "Groq", url: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", defaultModel: "openrouter/auto" },
  { label: "Ollama (Local)", url: "http://localhost:11434/v1", defaultModel: "deepseek-r1" },
  { label: "LM Studio (Local)", url: "http://localhost:1234/v1", defaultModel: "local-model" }
];

interface Props {
  isOpen: boolean;
  profile: CandidateProfile;
  apiKey?: string;
  aiConfig?: AIProviderConfig;
  consent: ConsentAudit;
  onSaveProfile: (profile: CandidateProfile) => void;
  onSaveApiKey?: (key: string) => void;
  onSaveAIConfig?: (config: AIProviderConfig) => void;
  onSaveConsent: (consent: ConsentAudit) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  profile,
  apiKey = "",
  aiConfig,
  consent,
  onSaveProfile,
  onSaveApiKey,
  onSaveAIConfig,
  onSaveConsent,
  onClose
}) => {
  if (!isOpen) return null;

  // Active top tab in settings
  const [activeTab, setActiveTab] = useState<"ai" | "profile" | "privacy">("ai");

  const [localProfile, setLocalProfile] = useState<CandidateProfile>(profile);
  const [localConsent, setLocalConsent] = useState<ConsentAudit>(consent);
  const [showKey, setShowKey] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);

  // Initialize active AI config
  const initialProvider = aiConfig?.provider || (apiKey.startsWith("sk-ant-") ? "claude" : apiKey.startsWith("pplx-") ? "perplexity" : apiKey.startsWith("sk-") ? "openai" : "gemini");
  const initialKey = aiConfig?.apiKey || apiKey || "";
  const initialModel = aiConfig?.model || PROVIDERS.find((p) => p.id === initialProvider)?.defaultModel || "gemini-2.5-flash";
  const initialBaseUrl = aiConfig?.baseUrl || (initialProvider === "custom_openai" ? "https://api.deepseek.com/v1" : "");

  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(initialProvider);
  const [localApiKey, setLocalApiKey] = useState(initialKey);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelText, setCustomModelText] = useState("");
  const [localBaseUrl, setLocalBaseUrl] = useState(initialBaseUrl);

  const activeProviderDef = PROVIDERS.find((p) => p.id === selectedProvider) || PROVIDERS[0];

  // When switching provider, set sensible default model and url
  const handleSelectProvider = (provId: AIProvider) => {
    setSelectedProvider(provId);
    const def = PROVIDERS.find((p) => p.id === provId);
    if (def) {
      setSelectedModel(def.defaultModel);
      setIsCustomModel(false);
      setCustomModelText("");
      if (def.needsBaseUrl && !localBaseUrl) {
        setLocalBaseUrl(def.defaultBaseUrl || "https://api.deepseek.com/v1");
      }
    }
  };

  const currentEffectiveModel = isCustomModel ? customModelText.trim() : selectedModel;

  const handleSave = () => {
    const finalModel = currentEffectiveModel || activeProviderDef.defaultModel;
    const finalConfig: AIProviderConfig = {
      provider: selectedProvider,
      apiKey: localApiKey.trim(),
      model: finalModel,
      ...(activeProviderDef.needsBaseUrl ? { baseUrl: localBaseUrl.trim() } : {})
    };

    onSaveProfile(localProfile);
    if (onSaveAIConfig) {
      onSaveAIConfig(finalConfig);
    }
    if (onSaveApiKey) {
      onSaveApiKey(localApiKey.trim());
    }
    onSaveConsent(localConsent);

    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 600);
  };

  // Determine key validity visual state
  const isKeyPresent = localApiKey.trim().length > 0;
  const isKeyMatchingPrefix =
    !activeProviderDef.keyPrefix ||
    localApiKey.trim().startsWith(activeProviderDef.keyPrefix) ||
    localApiKey.trim().startsWith("AQ.") ||
    (selectedProvider === "custom_openai" && isKeyPresent);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: "720px", width: "95vw" }}>
        
        {/* MODAL HEADER */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>
              ⚡
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>
                StealthAI Settings
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                Configure AI models, candidate profile & privacy
              </p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#080d1a", padding: "0 1.25rem" }}>
          <button
            onClick={() => setActiveTab("ai")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "ai" ? "2px solid #38bdf8" : "2px solid transparent",
              color: activeTab === "ai" ? "#38bdf8" : "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <Cpu size={15} />
            <span>AI Model & Provider</span>
            <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "10px", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
              {activeProviderDef.name.split(" ")[0]}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "profile" ? "2px solid #38bdf8" : "2px solid transparent",
              color: activeTab === "profile" ? "#38bdf8" : "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <User size={15} />
            <span>Candidate Profile</span>
          </button>

          <button
            onClick={() => setActiveTab("privacy")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "privacy" ? "2px solid #38bdf8" : "2px solid transparent",
              color: activeTab === "privacy" ? "#38bdf8" : "#94a3b8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <Shield size={15} />
            <span>Privacy & Local</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="modal-body" style={{ maxHeight: "68vh", overflowY: "auto", padding: "1.25rem 1.5rem" }}>

          {/* TAB 1: AI MODEL & PROVIDER */}
          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              
              {/* Provider Selection Row */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>
                  Select AI Engine / Provider:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                  {PROVIDERS.map((prov) => {
                    const isSelected = selectedProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => handleSelectProvider(prov.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "10px 6px",
                          borderRadius: "10px",
                          background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          border: isSelected ? "1.5px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                          color: isSelected ? "#f8fafc" : "#94a3b8",
                          cursor: "pointer",
                          transition: "all 0.18s ease"
                        }}
                      >
                        <span style={{ fontSize: "20px", marginBottom: "4px" }}>{prov.icon}</span>
                        <span style={{ fontSize: "12px", fontWeight: isSelected ? 700 : 500, textAlign: "center" }}>
                          {prov.name}
                        </span>
                        <span style={{ fontSize: "9.5px", color: isSelected ? "#38bdf8" : "#64748b", marginTop: "2px" }}>
                          {prov.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Info Banner */}
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "16px" }}>{activeProviderDef.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "13px", color: "#f8fafc" }}>{activeProviderDef.name}</strong>
                    {activeProviderDef.supportsVision && (
                      <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 600 }}>
                        ✓ Screen Vision
                      </span>
                    )}
                    {activeProviderDef.supportsSpeech && (
                      <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", fontWeight: 600 }}>
                        ✓ Speech-to-Text
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8", lineHeight: 1.4 }}>
                    {activeProviderDef.description}
                  </p>
                </div>
              </div>

              {/* API Key Input */}
              <div className="form-group full-width">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                    {activeProviderDef.name} API Key:
                  </label>
                  <a
                    href={activeProviderDef.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: "11.5px", color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px", fontWeight: 500 }}
                  >
                    <span>Get Key ({activeProviderDef.consoleName})</span>
                    <ExternalLink size={12} />
                  </a>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder={activeProviderDef.keyPlaceholder}
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    style={{
                      width: "100%",
                      paddingRight: "40px",
                      borderColor: isKeyPresent && isKeyMatchingPrefix ? "#10b981" : isKeyPresent && !isKeyMatchingPrefix ? "#f59e0b" : undefined
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "4px"
                    }}
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Key Status Message */}
                {isKeyPresent && isKeyMatchingPrefix && (
                  <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={13} />
                    <span>Valid format detected ({localApiKey.slice(0, 7)}...{localApiKey.slice(-4)}). Stored locally on device.</span>
                  </div>
                )}
                {isKeyPresent && !isKeyMatchingPrefix && (
                  <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={13} />
                    <span>
                      Notice: Key doesn't start with expected prefix &apos;{activeProviderDef.keyPrefix}&apos;. Ensure you copied the correct key.
                    </span>
                  </div>
                )}
                {!isKeyPresent && (
                  <span className="field-hint" style={{ marginTop: "4px", display: "block", fontSize: "11.5px" }}>
                    Leave blank to use the built-in offline intelligence engine (zero cloud transmission).
                  </span>
                )}
              </div>

              {/* Model Selection Dropdown */}
              <div className="form-group full-width">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                    AI Model:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomModel(!isCustomModel)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "11.5px",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    {isCustomModel ? "Pick curated model" : "Enter custom model ID"}
                  </button>
                </div>

                {!isCustomModel ? (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "6px",
                      color: "#f8fafc",
                      fontSize: "13px"
                    }}
                  >
                    {activeProviderDef.models.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: "#0f172a", color: "#f8fafc" }}>
                        {m.name} — {m.desc}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. gpt-4o, claude-3-7-sonnet-20250219, deepseek-ai/DeepSeek-V3"
                    value={customModelText}
                    onChange={(e) => setCustomModelText(e.target.value)}
                    style={{ width: "100%" }}
                  />
                )}
              </div>

              {/* Custom Base URL (For Custom / Local / DeepSeek / Ollama) */}
              {activeProviderDef.needsBaseUrl && (
                <div className="form-group full-width" style={{ marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ margin: 0, fontSize: "12.5px", fontWeight: 600, color: "#cbd5e1" }}>
                      API Base URL (OpenAI-Compatible):
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="https://api.deepseek.com/v1"
                    value={localBaseUrl}
                    onChange={(e) => setLocalBaseUrl(e.target.value)}
                    style={{ width: "100%" }}
                  />

                  {/* Quick Preset Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Quick Presets:</span>
                    {PRESET_BASE_URLS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setLocalBaseUrl(preset.url);
                          setSelectedModel(preset.defaultModel);
                          setIsCustomModel(false);
                        }}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          background: localBaseUrl === preset.url ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                          border: localBaseUrl === preset.url ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                          color: localBaseUrl === preset.url ? "#38bdf8" : "#cbd5e1",
                          cursor: "pointer"
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CANDIDATE PROFILE */}
          {activeTab === "profile" && (
            <div className="settings-section">
              <div className="section-title">
                <User size={16} className="text-accent" />
                <h4>Candidate Profile (Prompt Context)</h4>
              </div>
              <p className="section-desc">
                Injected into system prompts to align answers with your years of experience, primary tech stack, and key projects.
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={localProfile.name}
                    onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Target Role</label>
                  <input
                    type="text"
                    value={localProfile.targetRole}
                    onChange={(e) => setLocalProfile({ ...localProfile, targetRole: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Years of Experience</label>
                  <input
                    type="text"
                    value={localProfile.yearsExp}
                    onChange={(e) => setLocalProfile({ ...localProfile, yearsExp: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Primary Languages (comma separated)</label>
                  <input
                    type="text"
                    value={localProfile.primaryLanguages.join(", ")}
                    onChange={(e) =>
                      setLocalProfile({
                        ...localProfile,
                        primaryLanguages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      })
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Frameworks & Cloud Stack</label>
                  <input
                    type="text"
                    value={localProfile.frameworks.join(", ")}
                    onChange={(e) =>
                      setLocalProfile({
                        ...localProfile,
                        frameworks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      })
                    }
                  />
                </div>

                <div className="form-group full-width">
                  <label>Key Architectural Projects & Achievements</label>
                  <textarea
                    rows={2}
                    value={localProfile.keyProjects}
                    onChange={(e) => setLocalProfile({ ...localProfile, keyProjects: e.target.value })}
                    placeholder="e.g., Designed Kafka payment outbox pipeline handling 20k TPS; reduced database read contention using Redis cluster."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY & COMPLIANCE */}
          {activeTab === "privacy" && (
            <div className="settings-section">
              <div className="section-title">
                <Shield size={16} className="text-accent" />
                <h4>Privacy & Data Governance</h4>
              </div>
              <p className="section-desc">
                StealthAI protects your privacy. All session history and transcripts are stored in browser memory only.
              </p>

              <label className="checkbox-label" style={{ marginTop: "8px" }}>
                <input
                  type="checkbox"
                  checked={localConsent.localOnlyMode}
                  onChange={(e) => setLocalConsent({ ...localConsent, localOnlyMode: e.target.checked })}
                />
                <span className="checkbox-custom"></span>
                <span className="label-text">
                  Enforce Local-Only Mode (Never transmit speech or prompts to any external cloud API)
                </span>
              </label>

              <div style={{ marginTop: "1rem", padding: "12px", borderRadius: "8px", background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <h5 style={{ margin: "0 0 6px 0", color: "#38bdf8", fontSize: "12.5px" }}>Zero-Data Retention Policy</h5>
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                  API keys and candidate profiles are stored exclusively in your local machine&apos;s localStorage. No third-party analytics, tracking pixels, or remote telemetry servers are used.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="modal-footer">
          {savedAlert && <span className="save-indicator text-success"><Check size={14} /> Settings Saved!</span>}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} style={{ minWidth: "120px" }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
