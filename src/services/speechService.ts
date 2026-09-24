import type { SpeakerType, TranscriptItem } from "../types";
import { AIEngine } from "./aiEngine";

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
  private static vadInterval: any = null;

  // Audio Recorder & VAD for Electron and offline fallback
  private static mediaRecorder: MediaRecorder | null = null;
  private static recordedChunks: Blob[] = [];
  private static isRecordingAudio: boolean = false;
  private static silenceCounter: number = 0;
  private static speechDurationCounter: number = 0;
  private static apiKey: string = "";
  private static webSpeechDisabled: boolean = false;
  private static hasNotifiedFallback: boolean = false;

  // Stored callbacks
  private static storedOnFinal: SpeechCallback | null = null;
  private static storedOnInterim: InterimCallback | null = null;
  private static storedOnError: ((err: string) => void) | null = null;

  public static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      (("webkitSpeechRecognition" in window || "SpeechRecognition" in window) ||
        (navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia))
    );
  }

  public static setApiKey(key: string) {
    this.apiKey = key;
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

    // 1. Initialize microphone stream
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (!this.mediaStream) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          this.mediaStream = stream;

          // Initialize AudioContext analyser for audio visualizer & VAD
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
        onError("Microphone permission was denied. Please allow microphone access in system preferences.");
        return false;
      }
      console.warn("getUserMedia error:", micErr);
    }

    this.isListening = true;

    // 2. Start VAD (Voice Activity Detection) recorder fallback for Electron / non-Chrome
    this.startVADRecording();

    // 3. If Web Speech API is supported and hasn't permanently failed with network error, attempt it
    if (!this.webSpeechDisabled && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      this.createAndStartRecognition();
      this.startWatchdog();
    }

    return true;
  }

  private static createAndStartRecognition() {
    if (!this.isListening || this.webSpeechDisabled) return;

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
        // Recognition started smoothly
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
                  second: "2-digit",
                }).format(new Date()),
                speaker: this.activeSpeaker,
                text: transcriptText.trim(),
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
        // "no-speech" is normal pause between questions
        if (event.error === "no-speech") {
          return;
        }

        if (event.error === "not-allowed") {
          if (this.storedOnError) {
            this.storedOnError("Microphone access blocked. Please allow microphone permissions in Settings.");
          }
          this.isListening = false;
          return;
        }

        // In Electron desktop apps, Chromium lacks Google Chrome's private Speech API keys,
        // which triggers event.error = "network".
        // Instead of error looping, smoothly disable Web Speech and switch to native VAD + AI audio transcription.
        if (event.error === "network") {
          console.warn("WebSpeech recognition network unavailable in this runtime. Switching to Voice Audio & AI Transcriber.");
          this.webSpeechDisabled = true;
          if (this.recognition) {
            try {
              this.recognition.abort();
            } catch (e) {}
            this.recognition = null;
          }
          if (!this.hasNotifiedFallback) {
            this.hasNotifiedFallback = true;
            if (this.storedOnError) {
              this.storedOnError("Desktop App Mode: Live microphone active. Capturing audio turns with AI processing.");
            }
          }
          return;
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && !this.webSpeechDisabled) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isListening && !this.webSpeechDisabled) {
              this.createAndStartRecognition();
            }
          }, 120);
        }
      };

      this.recognition.start();
    } catch (e: any) {
      if (this.isListening && !this.webSpeechDisabled) {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isListening && !this.webSpeechDisabled) {
            this.createAndStartRecognition();
          }
        }, 300);
      }
    }
  }

  // Voice Activity Detection (VAD) audio loop
  private static startVADRecording() {
    if (!this.mediaStream) return;

    if (this.vadInterval) clearInterval(this.vadInterval);

    this.vadInterval = setInterval(async () => {
      if (!this.isListening || !this.mediaStream) return;

      const level = this.getAudioLevel();

      // Threshold: speech detected
      if (level > 0.07) {
        this.silenceCounter = 0;
        this.speechDurationCounter++;

        if (!this.isRecordingAudio) {
          this.startAudioChunk();
        }

        if (this.storedOnInterim && this.webSpeechDisabled) {
          this.storedOnInterim("🎤 Listening... (speech detected)");
        }
      } else if (this.isRecordingAudio) {
        this.silenceCounter++;

        // After ~1.2 seconds of silence (12 ticks * 100ms) after speech
        if (this.silenceCounter >= 12) {
          const durationTicks = this.speechDurationCounter;
          this.stopAudioChunk(durationTicks);
        }
      }
    }, 100);
  }

  private static startAudioChunk() {
    if (!this.mediaStream) return;
    try {
      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(200);
      this.isRecordingAudio = true;
      this.silenceCounter = 0;
      this.speechDurationCounter = 0;
    } catch (e) {
      console.warn("MediaRecorder start error:", e);
    }
  }

  private static async stopAudioChunk(durationTicks: number) {
    if (!this.mediaRecorder || !this.isRecordingAudio) return;

    this.isRecordingAudio = false;
    this.silenceCounter = 0;
    this.speechDurationCounter = 0;

    const recorder = this.mediaRecorder;
    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const audioBlob = new Blob(this.recordedChunks, { type: mimeType });
      this.recordedChunks = [];

      // Only process if speech was sustained (> 0.6 seconds)
      if (durationTicks >= 6 && audioBlob.size > 2048) {
        if (this.webSpeechDisabled) {
          if (this.apiKey && this.apiKey.startsWith("AIza")) {
            if (this.storedOnInterim) {
              this.storedOnInterim("⚡ Transcribing audio with Gemini AI...");
            }
            try {
              const transcribed = await AIEngine.transcribeAudio(audioBlob, this.apiKey);
              if (this.storedOnInterim) this.storedOnInterim("");
              if (transcribed && transcribed.trim().length > 0 && this.storedOnFinal) {
                this.storedOnFinal({
                  id: crypto.randomUUID(),
                  timestamp: new Intl.DateTimeFormat("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(new Date()),
                  speaker: this.activeSpeaker,
                  text: transcribed.trim(),
                });
              }
            } catch (err) {
              console.warn("Gemini audio transcription error:", err);
              if (this.storedOnInterim) this.storedOnInterim("");
            }
          } else {
            if (this.storedOnInterim) this.storedOnInterim("");
            if (this.storedOnFinal && durationTicks >= 12) {
              const durationSec = (durationTicks * 0.1).toFixed(1);
              this.storedOnFinal({
                id: crypto.randomUUID(),
                timestamp: new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date()),
                speaker: this.activeSpeaker,
                text: `[Audio Spoken (${durationSec}s) — Add Gemini API Key in Settings for live cloud transcription]`,
              });
            }
          }
        }
      } else {
        if (this.storedOnInterim && this.webSpeechDisabled) {
          this.storedOnInterim("");
        }
      }
    };

    try {
      recorder.stop();
    } catch (e) {}
  }

  private static startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      if (this.isListening && !this.webSpeechDisabled && !this.recognition) {
        this.createAndStartRecognition();
      }
    }, 2500);
  }

  public static stopListening() {
    this.isListening = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.vadInterval) clearInterval(this.vadInterval);

    if (this.mediaRecorder && this.isRecordingAudio) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    this.mediaRecorder = null;
    this.isRecordingAudio = false;

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
