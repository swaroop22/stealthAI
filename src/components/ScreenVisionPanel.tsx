import React from "react";
import { Monitor, Camera, Image as ImageIcon, Sparkles, X, AlertTriangle } from "lucide-react";
import { ScreenSnippet } from "../types";
import { ScreenCaptureService } from "../services/screenService";

interface Props {
  activeSnippet: ScreenSnippet | null;
  onSnippetCaptured: (snippet: ScreenSnippet | null) => void;
  onAnalyzeSnippet: (snippet: ScreenSnippet) => void;
}

export const ScreenVisionPanel: React.FC<Props> = ({
  activeSnippet,
  onSnippetCaptured,
  onAnalyzeSnippet
}) => {
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleCaptureScreen = async () => {
    setIsCapturing(true);
    setErrorMsg(null);
    try {
      const snippet = await ScreenCaptureService.captureScreen("Meeting screen capture");
      onSnippetCaptured(snippet);
    } catch (err: any) {
      if (err.name !== "NotAllowedError") {
        setErrorMsg(err.message || "Failed to capture screen.");
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              onSnippetCaptured({
                id: crypto.randomUUID(),
                dataUrl: event.target.result as string,
                timestamp: new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                }).format(new Date()),
                note: "Pasted from clipboard"
              });
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="screen-vision-card" onPaste={handlePaste} tabIndex={0}>
      <div className="screen-vision-header">
        <div className="flex-center gap-2">
          <Monitor size={17} className="text-accent" />
          <h4>Screen & Code Problem Ingestion</h4>
        </div>
        <button
          className="btn-capture"
          onClick={handleCaptureScreen}
          disabled={isCapturing}
          title="Capture current window or screen using browser API"
        >
          <Camera size={14} />
          {isCapturing ? "Selecting window..." : "Capture Screen / Tab"}
        </button>
      </div>

      {errorMsg && (
        <div className="error-banner">
          <AlertTriangle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {activeSnippet ? (
        <div className="snippet-preview-box">
          <div className="snippet-header">
            <span>Captured at {activeSnippet.timestamp}</span>
            <div className="snippet-actions">
              <button
                className="btn-analyze-ai"
                onClick={() => onAnalyzeSnippet(activeSnippet)}
              >
                <Sparkles size={14} /> Analyze with Vision AI
              </button>
              <button
                className="btn-remove-snippet"
                onClick={() => onSnippetCaptured(null)}
                title="Remove snippet"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="image-frame">
            <img src={activeSnippet.dataUrl} alt="Captured snippet" />
          </div>
        </div>
      ) : (
        <div className="screen-dropzone" onClick={handleCaptureScreen}>
          <ImageIcon size={22} className="text-muted" />
          <span>Click to capture window or paste screenshot here (Cmd+V)</span>
          <small className="text-dim">Supports LeetCode problem descriptions, architecture diagrams, or slides</small>
        </div>
      )}
    </div>
  );
};
