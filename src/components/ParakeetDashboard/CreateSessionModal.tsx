import React, { useState, useEffect } from "react";
import {
  X,
  Briefcase,
  Phone,
  Bot,
  Sparkles,
  Video,
  ChevronDown,
  Check,
  AlertCircle,
  Play,
  ArrowRight,
  ArrowLeft,
  FileText,
  Upload,
  Plus
} from "lucide-react";
import type { SessionType, AssistantMode, CreateSessionInput } from "../../types";
import { SessionService, ResumeOption, DocumentOption } from "../../services/sessionService";
import { PasteJobLinkModal } from "./PasteJobLinkModal";

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSession: (input: CreateSessionInput, shouldLaunchDirectly: boolean) => void;
  onOpenResumeModal: () => void;
  showToast: (text: string, type: "info" | "success" | "error") => void;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  onClose,
  onCreateSession,
  onOpenResumeModal,
  showToast
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [sessionType, setSessionType] = useState<SessionType>("Interview");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumes, setResumes] = useState<ResumeOption[]>(() => SessionService.getAvailableResumes());
  const [documents, setDocuments] = useState<DocumentOption[]>(() => SessionService.getAvailableDocuments());
  const [selectedResumeId, setSelectedResumeId] = useState<string>(() => {
    const list = SessionService.getAvailableResumes();
    return list.length > 0 ? list[0].id : "none";
  });
  const [selectedDocId, setSelectedDocId] = useState("none");
  const [showPasteJobModal, setShowPasteJobModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 2 Preferences
  const [mode, setMode] = useState<AssistantMode>("coding");
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [aiProvider, setAIProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-3.8-flash");
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (isOpen) {
      const currentResumes = SessionService.getAvailableResumes();
      setResumes(currentResumes);
      if (currentResumes.length > 0 && (selectedResumeId === "none" || !currentResumes.some(r => r.id === selectedResumeId))) {
        setSelectedResumeId(currentResumes[0].id);
      } else if (currentResumes.length === 0) {
        setSelectedResumeId("none");
      }
      setDocuments(SessionService.getAvailableDocuments());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (!company.trim()) {
      setValidationError("company");
      return;
    }
    if (!jobDescription.trim()) {
      setValidationError("jobDescription");
      return;
    }
    setValidationError(null);
    setStep(2);
  };

  const handleApplyPreset = () => {
    setCompany("Acme Systems");
    setRole("Staff Infrastructure Engineer");
    setJobDescription(
      "Design and maintain scalable microservices, low-latency APIs, and cloud infrastructure with automated CI/CD and distributed observability."
    );
    setCustomInstructions("Focus heavily on distributed system resilience, concurrency models, and real-world high throughput trade-offs.");
    showToast("✨ Applied Mock System Engineer preset!", "success");
    setValidationError(null);
  };

  const handleCreate = (shouldLaunchDirectly: boolean) => {
    if (!company.trim()) {
      setStep(1);
      setValidationError("company");
      return;
    }
    if (!jobDescription.trim()) {
      setStep(1);
      setValidationError("jobDescription");
      return;
    }

    const chosenResume = selectedResumeId !== "none" ? resumes.find((r) => r.id === selectedResumeId) : undefined;
    const chosenDoc = selectedDocId !== "none" ? documents.find((d) => d.id === selectedDocId) : undefined;

    const input: CreateSessionInput = {
      sessionType,
      company: company.trim(),
      role: role.trim() || "Senior Technical Candidate",
      jobDescription: jobDescription.trim(),
      resumeFileName: chosenResume?.name,
      resumeText: chosenResume?.text,
      documentName: chosenDoc ? chosenDoc.name : undefined,
      preferences: {
        mode,
        autoAnswer,
        aiProvider,
        model,
        customInstructions
      }
    };

    onCreateSession(input, shouldLaunchDirectly);
  };

  return (
    <>
      <div className="parakeet-modal-backdrop" onClick={onClose}>
        <div
          className="create-session-modal-card"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* LEFT SIDEBAR PANEL */}
          <div className="modal-left-panel">
            <div className="modal-panel-header">
              <h2 className="modal-main-title">Create Interview Session</h2>
              <p className="modal-main-subtitle">
                Enter the details &amp; select what you need for this call.
              </p>
            </div>

            {/* Stepper Navigation */}
            <div className="modal-stepper">
              <div
                className={`stepper-item ${step === 1 ? "active" : "completed"}`}
                onClick={() => setStep(1)}
              >
                <div className="stepper-circle">1</div>
                <span className="stepper-label">Details</span>
              </div>

              <div className="stepper-line"></div>

              <div
                className={`stepper-item ${step === 2 ? "active" : ""}`}
                onClick={() => {
                  if (company.trim() && jobDescription.trim()) {
                    setStep(2);
                  } else {
                    setValidationError(company.trim() ? "jobDescription" : "company");
                  }
                }}
              >
                <div className="stepper-circle">2</div>
                <span className="stepper-label">Preferences</span>
              </div>
            </div>

            {/* Left Panel Bottom Action Buttons */}
            <div className="left-panel-bottom-actions">
              <button
                className="btn-left-secondary"
                onClick={() => showToast("Tutorial: Create a session, paste job details, then start live audio assistant.", "info")}
              >
                <Video size={16} />
                <span>View Tutorial</span>
              </button>

              <button
                className="btn-left-secondary"
                onClick={handleApplyPreset}
                title="Load sample interview requirements"
              >
                <Bot size={16} />
                <span>Mock Presets</span>
              </button>
            </div>
          </div>

          {/* RIGHT CONTENT PANEL */}
          <div className="modal-right-panel">
            {/* Top Close Button */}
            <button className="btn-modal-close" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>

            {step === 1 ? (
              /* STEP 1: DETAILS */
              <div className="step-content-scroll">
                {/* Session Type */}
                <div className="form-group-field">
                  <label className="field-label">Session Type</label>
                  <div className="session-type-selector">
                    <button
                      type="button"
                      className={`session-type-card ${sessionType === "Interview" ? "selected" : ""}`}
                      onClick={() => setSessionType("Interview")}
                    >
                      <Briefcase size={16} />
                      <span>Interview</span>
                    </button>

                    <button
                      type="button"
                      className={`session-type-card ${sessionType === "Regular" ? "selected" : ""}`}
                      onClick={() => setSessionType("Regular")}
                    >
                      <Phone size={16} />
                      <span>Regular</span>
                    </button>

                    <button
                      type="button"
                      className={`session-type-card ${sessionType === "Mock" ? "selected" : ""}`}
                      onClick={() => setSessionType("Mock")}
                    >
                      <Bot size={16} />
                      <span>Mock</span>
                    </button>
                  </div>
                </div>

                {/* Import Details Helper */}
                <div className="import-helper-box">
                  <p className="import-helper-text">
                    Have a link to the job post? Import the details automatically.
                  </p>
                  <button
                    type="button"
                    className="btn-paste-job-link"
                    onClick={() => setShowPasteJobModal(true)}
                  >
                    <Sparkles size={16} className="text-emerald" />
                    <span>Paste a job link</span>
                  </button>
                </div>

                {/* Company Name */}
                <div className="form-group-field">
                  <label className="field-label">Company</label>
                  <div className="input-wrap-relative">
                    <input
                      type="text"
                      className={`form-input-text ${validationError === "company" ? "input-error" : ""}`}
                      placeholder="Enter company name"
                      value={company}
                      onChange={(e) => {
                        setCompany(e.target.value);
                        if (validationError === "company") setValidationError(null);
                      }}
                    />
                    {validationError === "company" && (
                      <div className="validation-tooltip">
                        <AlertCircle size={13} />
                        <span>Please fill out this field.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Job Description */}
                <div className="form-group-field">
                  <label className="field-label">Job Description</label>
                  <div className="input-wrap-relative">
                    <textarea
                      className={`form-textarea ${validationError === "jobDescription" ? "input-error" : ""}`}
                      placeholder="Enter job description"
                      rows={6}
                      value={jobDescription}
                      onChange={(e) => {
                        setJobDescription(e.target.value);
                        if (validationError === "jobDescription") setValidationError(null);
                      }}
                    />
                    {validationError === "jobDescription" && (
                      <div className="validation-tooltip">
                        <AlertCircle size={13} />
                        <span>Please fill out this field.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Context (CV / Resume & Documents) */}
                <div className="context-section">
                  <label className="field-label">Context</label>
                  <div className="context-grid-two-col">
                    {/* CV / Resume Dropdown */}
                    <div className="context-dropdown-col">
                      <span className="dropdown-sublabel">CV / Resume</span>
                      <div className="select-wrapper">
                        <select
                          className="form-select-dropdown"
                          value={selectedResumeId}
                          onChange={(e) => {
                            if (e.target.value === "upload_new") {
                              onOpenResumeModal();
                            } else {
                              setSelectedResumeId(e.target.value);
                            }
                          }}
                        >
                          <option value="none">
                            {resumes.length === 0 ? "No resume uploaded" : "None / Skip resume"}
                          </option>
                          {resumes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                          <option value="upload_new">+ Upload New Resume...</option>
                        </select>
                        <ChevronDown size={14} className="select-arrow-icon" />
                      </div>
                    </div>

                    {/* Documents Dropdown */}
                    <div className="context-dropdown-col">
                      <span className="dropdown-sublabel">Documents</span>
                      <div className="select-wrapper">
                        <select
                          className="form-select-dropdown"
                          value={selectedDocId}
                          onChange={(e) => setSelectedDocId(e.target.value)}
                        >
                          <option value="none">
                            {documents.length === 0 ? "No documents uploaded" : "None / Skip document"}
                          </option>
                          {documents.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="select-arrow-icon" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 1 Actions Footer */}
                <div className="modal-footer-actions">
                  <button type="button" className="btn-modal-cancel" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-modal-next"
                    onClick={handleNext}
                    id="btn-create-session-next"
                  >
                    <span>Next</span>
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: PREFERENCES */
              <div className="step-content-scroll">
                <div className="preferences-header">
                  <h3 className="section-title">Session Preferences</h3>
                  <p className="section-desc">
                    Tailor AI copilot intelligence and auto-response behavior for this session.
                  </p>
                </div>

                {/* Focus Mode */}
                <div className="form-group-field">
                  <label className="field-label">Assistance Focus Mode</label>
                  <div className="mode-pill-grid">
                    {[
                      { id: "coding", label: "Coding & Algorithms", desc: "Optimal time/space complexity & code" },
                      { id: "system_design", label: "System Design", desc: "Architecture, trade-offs & scaling" },
                      { id: "behavioral", label: "STAR Behavioral", desc: "Situation, Task, Action & metrics" },
                      { id: "meeting_notes", label: "Discussion & Notes", desc: "Concise technical explanations" }
                    ].map((m) => (
                      <div
                        key={m.id}
                        className={`pref-card-choice ${mode === m.id ? "selected" : ""}`}
                        onClick={() => setMode(m.id as AssistantMode)}
                      >
                        <span className="pref-choice-title">{m.label}</span>
                        <span className="pref-choice-desc">{m.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automation Toggles */}
                <div className="form-group-field">
                  <label className="field-label">Live Assistant Features</label>
                  <div className="pref-toggles-card">
                    <div className="toggle-row">
                      <div className="toggle-info">
                        <span className="toggle-label">⚡ Auto-Answer Interviewer Questions</span>
                        <span className="toggle-sub">
                          Generates instant solutions automatically when the interviewer asks a question.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        className="toggle-checkbox"
                        checked={autoAnswer}
                        onChange={(e) => setAutoAnswer(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Specific Interview Guidance */}
                <div className="form-group-field">
                  <label className="field-label">Specific Directives for this Call (Optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="e.g. Focus on Databricks Lakehouse, PySpark optimization, SQL window functions, and enterprise metrics."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                  />
                </div>

                {/* Step 2 Actions Footer */}
                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <div className="footer-right-buttons">
                    <button
                      type="button"
                      className="btn-modal-draft"
                      onClick={() => handleCreate(false)}
                      title="Save this session record to call list without immediately starting"
                    >
                      Save Session
                    </button>

                    <button
                      type="button"
                      className="btn-modal-start"
                      onClick={() => handleCreate(true)}
                      id="btn-create-and-start-session"
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Start Session</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paste Job Link Modal */}
      <PasteJobLinkModal
        isOpen={showPasteJobModal}
        onClose={() => setShowPasteJobModal(false)}
        onImport={(imported) => {
          setCompany(imported.company);
          if (imported.role) setRole(imported.role);
          setJobDescription(imported.jobDescription);
          showToast("✨ Job details imported successfully!", "success");
        }}
      />
    </>
  );
};
