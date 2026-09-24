# StealthAI — Visible Meeting, Coding & Technical Companion

A modern, user-consented desktop/web companion for live collaborative meetings, technical interview practice, and coding sessions.

---

## 🌟 Key Features

1. **Visible & Consented Architecture (Compliance-by-Design)**
   - Clear on-screen session status indicator (`● CAPTURING AUDIO (VISIBLE)`).
   - Explicit participant consent gate before speech transcription can begin.
   - Built-in **Local-Only Mode** ensuring zero external cloud transmission.

2. **Real-Time Speech-to-Text (STT)**
   - Browser Web Speech API (`webkitSpeechRecognition`) for continuous microphone captioning.
   - Interim speech token previews and finalized turn-by-turn dialogue cards.
   - Speaker attribution (`Interviewer` vs. `Candidate`).
   - One-click **"Ask Assistant →"** action on any spoken line.

3. **Multimodal Problem Ingestion (Vision / Screen Capture)**
   - Browser `navigator.mediaDevices.getDisplayMedia` window/screen snapshot capture.
   - Clipboard paste (`Cmd + V`) for LeetCode problem descriptions and architecture diagrams.
   - Direct vision AI analysis for algorithms and system diagrams.

4. **Real-Time AI Copilot & Streaming Response**
   - **Coding Mode:** Clarifying questions, optimal time/space complexity, clean TypeScript/Python implementation, edge cases.
   - **STAR Behavioral Mode:** Situation, Task, Action, Result structured storytelling with quantifiable metrics.
   - **System Design Mode:** Requirements, API gateways, distributed caching, and failure modes.
   - **Meeting Notes Mode:** Executive summary, architectural decisions, and assigned action items.
   - Token-by-token streaming animation.
   - Compatible with Google Gemini API key or zero-config local intelligence engine.

5. **Candidate Profile & Context Grounding**
   - Configurable candidate background (tech stack, years of experience, key projects).
   - Injected into prompt context for personalized responses.

6. **Audit & Export**
   - One-click export of transcripts, metadata, consent audit timestamps, and AI solutions to JSON.

---

## 🚀 Running the Application

### 1. Start the Development Server
```bash
cd ~/Desktop/stealthAI
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in Google Chrome or Microsoft Edge.

### 2. Build for Production (Web)
```bash
npm run build
npm run preview
```

---

## 🖥️ Desktop Application (macOS & Windows via Electron)

StealthAI can be run and packaged as a standalone desktop application.

### Run Desktop App in Development
```bash
npm run electron:dev
```
This concurrently starts the Vite dev server and launches the native Electron window.

### Build Standalone Installers (.dmg / .exe)

#### On macOS (Builds `.dmg` and `.zip`):
```bash
npm run electron:build:mac
```
The output `.dmg` installer will be located in the `release/` folder. Double-click to drag StealthAI into `/Applications`.

#### On Windows (Builds `.exe` installer & portable binary):
```bash
npm run electron:build:win
```
The output `StealthAI Setup 2.0.0.exe` and portable `.exe` will be located in the `release/` folder.

#### Build All:
```bash
npm run electron:dist
```

