import type { SpeakerType, TranscriptItem } from "../types";

export type SpeechCallback = (item: TranscriptItem) => void;
export type InterimCallback = (text: string) => void;

export class SpeechService {
  private static recognition: any = null;
  private static isListening: boolean = false;
  private static activeSpeaker: SpeakerType = "Interviewer";
  private static mediaStream: MediaStream | null = null;
  private static audioCtx: AudioContext | null = null;
  private static analyser: AnalyserNode | null = null;
  private static dataArray: Uint8Array | null = null;
  private static restartTimer: any = null;
  private static watchdogTimer: any = null;

  // Stored callbacks for safe auto-recovery
  private static storedOnFinal: SpeechCallback | null = null;
  private static storedOnInterim: InterimCallback | null = null;
  private static storedOnError: ((err: string) => void) | null = null;

  public static isSupported(): boolean {
    return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }

  public static setSpeaker(speaker: SpeakerType) {
    this.activeSpeaker = speaker;
  }

  public static getSpeaker(): SpeakerType {
    return this.activeSpeaker;
  }

  public static getAudioLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray as any);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    return Math.min(1, avg / 128);
  }

  public static async startListening(
    onFinal: SpeechCallback,
    onInterim: InterimCallback,
    onError: (err: string) => void
  ): Promise<boolean> {
    this.storedOnFinal = onFinal;
    this.storedOnInterim = onInterim;
    this.storedOnError = onError;

    // 1. Request microphone stream via getUserMedia first
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (!this.mediaStream) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.mediaStream = stream;

          // Initialize AudioContext analyser for audio visualizer
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              this.audioCtx = new AudioContextClass();
              const source = this.audioCtx.createMediaStreamSource(stream);
              this.analyser = this.audioCtx.createAnalyser();
              this.analyser.fftSize = 64;
              this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
              source.connect(this.analyser);
            }
          } catch (e) {
            console.warn("AudioContext analyser init:", e);
          }
        }
      }
    } catch (micErr: any) {
      if (micErr.name === "NotAllowedError" || micErr.name === "PermissionDeniedError") {
        onError("Microphone permission was denied. Please allow microphone access in your browser address bar.");
        return false;
      }
      console.warn("getUserMedia error:", micErr);
    }

    // 2. Check for Web Speech API
    if (!this.isSupported()) {
      onError("Web Speech API is not supported in this browser. Please use Chrome or Edge for live microphone speech.");
      return false;
    }

    this.isListening = true;
    this.createAndStartRecognition();
    this.startWatchdog();
    return true;
  }

  private static createAndStartRecognition() {
    if (!this.isListening) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.onstart = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onend = null;
          this.recognition.abort();
        } catch (e) {}
        this.recognition = null;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onstart = () => {
        // Active and running
      };

      this.recognition.onresult = (event: any) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          if (result.isFinal) {
            if (this.storedOnFinal && transcriptText.trim().length > 0) {
              this.storedOnFinal({
                id: crypto.randomUUID(),
                timestamp: new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                }).format(new Date()),
                speaker: this.activeSpeaker,
                text: transcriptText.trim()
              });
            }
          } else {
            interimText += transcriptText;
          }
        }
        if (this.storedOnInterim) {
          this.storedOnInterim(interimText);
        }
      };

      this.recognition.onerror = (event: any) => {
        // "no-speech" is normal when pausing between questions - do not error or stop!
        if (event.error === "no-speech") {
          return;
        }
        if (event.error === "not-allowed") {
          if (this.storedOnError) {
            this.storedOnError("Microphone access blocked. Click the tune/lock icon in your browser URL bar.");
          }
          this.isListening = false;
          return;
        }
        if (event.error === "network") {
          if (this.storedOnError) {
            this.storedOnError("Speech network error. Chrome speech-to-text requires internet access.");
          }
          return;
        }
      };

      this.recognition.onend = () => {
        // Bulletproof auto-recovery: when session ends after silence, restart smoothly in 120ms
        if (this.isListening) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isListening) {
              this.createAndStartRecognition();
            }
          }, 120);
        }
      };

      this.recognition.start();
    } catch (e: any) {
      // Retry in 300ms if recognition was in transition
      if (this.isListening) {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isListening) {
            this.createAndStartRecognition();
          }
        }, 300);
      }
    }
  }

  // Watchdog ensures recognition never stays dead during long meeting pauses
  private static startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      if (this.isListening && !this.recognition) {
        console.log("Watchdog restarting speech recognition...");
        this.createAndStartRecognition();
      }
    }, 2500);
  }

  public static stopListening() {
    this.isListening = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);

    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
      this.analyser = null;
      this.dataArray = null;
    }
  }

  public static getListeningStatus(): boolean {
    return this.isListening;
  }
}
