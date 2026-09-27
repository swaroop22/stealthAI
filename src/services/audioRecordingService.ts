export interface RecordingState {
  isRecording: boolean;
  seconds: number;
  filePath?: string;
  fileName?: string;
}

export type RecordingStateListener = (state: RecordingState) => void;

export class AudioRecordingService {
  private static mediaRecorder: MediaRecorder | null = null;
  private static stream: MediaStream | null = null;
  private static isRecording: boolean = false;
  private static recordingSeconds: number = 0;
  private static timer: any = null;
  private static currentFileName: string = "";
  private static currentFilePath: string = "";
  private static collectedChunks: Blob[] = [];
  private static listeners: Set<RecordingStateListener> = new Set();

  public static addListener(listener: RecordingStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.warn("Recording listener error:", e);
      }
    });
  }

  public static getState(): RecordingState {
    return {
      isRecording: this.isRecording,
      seconds: this.recordingSeconds,
      filePath: this.currentFilePath,
      fileName: this.currentFileName
    };
  }

  public static getIsRecording(): boolean {
    return this.isRecording;
  }

  public static getSeconds(): number {
    return this.recordingSeconds;
  }

  public static async startRecording(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia is not supported on this platform.");
        return false;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.collectedChunks = [];

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      this.currentFileName = `StealthAI_Session_${timestamp}.webm`;

      // Notify Electron main process to open write stream on computer disk
      const electron = (window as any).electronAPI;
      if (electron?.startSessionRecording) {
        try {
          const res = await electron.startSessionRecording({ fileName: this.currentFileName });
          if (res?.filePath) {
            this.currentFilePath = res.filePath;
          }
        } catch (ipcErr) {
          console.warn("Could not start Electron recording file:", ipcErr);
        }
      }

      this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.collectedChunks.push(event.data);

          // Flush live directly to computer disk via Electron IPC
          if (electron?.appendRecordingChunk) {
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              electron.appendRecordingChunk(arrayBuffer);
            } catch (err) {
              console.warn("Failed to stream chunk to disk:", err);
            }
          }
        }
      };

      this.mediaRecorder.onstop = () => {
        // Stream stopped
      };

      // Flush chunks every 1 second to disk
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.recordingSeconds = 0;

      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        this.recordingSeconds += 1;
        this.notify();
      }, 1000);

      this.notify();
      return true;
    } catch (err) {
      console.error("Failed to start session audio recording:", err);
      return false;
    }
  }

  public static async stopRecording(): Promise<string> {
    if (!this.isRecording) return this.currentFilePath;

    this.isRecording = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.mediaRecorder = null;

    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      this.stream = null;
    }

    const electron = (window as any).electronAPI;
    let finalPath = this.currentFilePath;
    if (electron?.finishSessionRecording) {
      try {
        const res = await electron.finishSessionRecording();
        if (res?.filePath) {
          finalPath = res.filePath;
        }
      } catch (e) {}
    }

    this.notify();
    return finalPath;
  }

  public static async openFolder(): Promise<void> {
    const electron = (window as any).electronAPI;
    if (electron?.openRecordingsFolder) {
      await electron.openRecordingsFolder();
    } else {
      // Browser fallback: download current blob if exists
      this.downloadBlobInBrowser();
    }
  }

  public static downloadBlobInBrowser() {
    if (this.collectedChunks.length === 0) return;
    const blob = new Blob(this.collectedChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = this.currentFileName || "StealthAI_Session_Recording.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public static formatSeconds(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
}
