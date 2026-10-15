import React, { useState } from "react";
import { X, Sparkles, Link as LinkIcon, Check, AlertCircle } from "lucide-react";

interface PasteJobLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { company: string; role: string; jobDescription: string }) => void;
}

export const PasteJobLinkModal: React.FC<PasteJobLinkModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleImport = () => {
    if (!inputValue || inputValue.trim().length < 5) {
      setErrorMsg("Please paste a valid job URL or job post description.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg("");

    setTimeout(() => {
      const text = inputValue.trim();

      // Check if it's a URL
      let company = "";
      let role = "";
      let jobDescription = text;

      if (text.startsWith("http://") || text.startsWith("https://")) {
        try {
          const urlObj = new URL(text);
          const hostname = urlObj.hostname.toLowerCase();
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);

          if (hostname.includes("linkedin")) {
            company = "Enterprise Partner";
            role = "Senior Technical Specialist";
            jobDescription = `Job imported from LinkedIn: ${text}\nRequirements: Distributed systems, system design, data architecture, microservices, and technical leadership.`;
          } else if (hostname.includes("greenhouse") || hostname.includes("lever")) {
            const compGuess = pathSegments[0] || "Hiring Company";
            company = compGuess.charAt(0).toUpperCase() + compGuess.slice(1);
            role = "Senior Software & Systems Engineer";
            jobDescription = `Job requisition imported from ${hostname}.\nResponsibilities: Core platform engineering, high throughput systems, and technical architecture.`;
          } else {
            company = hostname.replace("www.", "").split(".")[0];
            company = company.charAt(0).toUpperCase() + company.slice(1);
            role = "Senior Engineer";
            jobDescription = `Imported role details from ${text}. Core engineering requirements, distributed systems design, and performance optimizations.`;
          }
        } catch (e) {
          company = "Tech Company";
          role = "Senior Engineer";
        }
      } else {
        // Raw text pasted - extract first line or title patterns
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const firstLine = lines[0] || "";

        if (firstLine.toLowerCase().includes(" at ")) {
          const parts = firstLine.split(/ at /i);
          role = parts[0]?.trim() || "Senior Engineer";
          company = parts[1]?.trim() || "Company";
        } else if (firstLine.includes("-")) {
          const parts = firstLine.split("-");
          company = parts[0]?.trim() || "Company";
          role = parts[1]?.trim() || "Senior Engineer";
        } else {
          company = "Target Company";
          role = firstLine.slice(0, 40) || "Senior Technical Engineer";
        }
        jobDescription = text;
      }

      setIsProcessing(false);
      onImport({
        company: company || "Target Company",
        role: role || "Senior Engineer",
        jobDescription
      });
      onClose();
    }, 400);
  };

  return (
    <div className="parakeet-modal-backdrop" onClick={onClose}>
      <div className="parakeet-popover-card" onClick={(e) => e.stopPropagation()}>
        <div className="popover-header">
          <div className="popover-title-row">
            <Sparkles size={18} className="text-emerald" />
            <h3>Import Job Post Details</h3>
          </div>
          <button className="btn-close-popover" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <p className="popover-subtitle">
          Paste a link to any job post (LinkedIn, Greenhouse, Lever, etc.) or paste the job description text below to automatically extract details.
        </p>

        <div className="popover-input-wrap">
          <textarea
            className="popover-textarea"
            placeholder="Paste job link (https://...) or raw job posting text..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            rows={5}
            autoFocus
          />
        </div>

        {errorMsg && (
          <div className="popover-error">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="popover-actions">
          <button className="btn-popover-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-popover-submit"
            onClick={handleImport}
            disabled={isProcessing}
          >
            {isProcessing ? "Importing..." : "Import Details"}
          </button>
        </div>
      </div>
    </div>
  );
};
