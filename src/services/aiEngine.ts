import type { AssistantMode, CandidateProfile, ScreenSnippet, AIProvider, AIProviderConfig } from "../types";

export interface StreamCallbacks {
  onToken: (token: string, accumulated: string) => void;
  onComplete: (finalText: string) => void;
  onError: (error: string) => void;
}

export class AIEngine {
  private static abortController: AbortController | null = null;

  public static stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public static normalizeConfig(configOrKey?: AIProviderConfig | string): AIProviderConfig {
    if (!configOrKey) {
      return { provider: "gemini", apiKey: "", model: "gemini-3.8-flash" };
    }
    if (typeof configOrKey === "string") {
      const trimmed = configOrKey.trim();
      if (trimmed.startsWith("sk-ant-")) {
        return { provider: "claude", apiKey: trimmed, model: "claude-3-7-sonnet-20250219" };
      } else if (trimmed.startsWith("pplx-")) {
        return { provider: "perplexity", apiKey: trimmed, model: "sonar" };
      } else if (trimmed.startsWith("sk-")) {
        return { provider: "openai", apiKey: trimmed, model: "gpt-4o" };
      } else {
        return { provider: "gemini", apiKey: trimmed, model: "gemini-3.8-flash" };
      }
    }
    const cfg = { ...configOrKey };
    if (cfg.provider === "gemini") {
      // Auto-migrate deprecated 404 models to current 3.8 release
      if (!cfg.model || cfg.model.includes("2.5") || cfg.model.includes("2.0") || cfg.model.includes("1.5")) {
        cfg.model = "gemini-3.8-flash";
      }
    }
    return cfg;
  }

  private static readonly FLASH_MODELS = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-2.5-flash"
  ];

  public static async generateStreamingResponse(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKeyOrConfig: AIProviderConfig | string,
    callbacks: StreamCallbacks,
    transcriptContext?: string
  ): Promise<void> {
    this.stopGeneration();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const config = this.normalizeConfig(apiKeyOrConfig);

    if (config.apiKey && config.apiKey.trim().length > 5) {
      try {
        if (config.provider === "openai") {
          await this.streamOpenAIAPI(prompt, mode, profile, snippet, config, callbacks, signal, transcriptContext);
          return;
        } else if (config.provider === "claude") {
          await this.streamClaudeAPI(prompt, mode, profile, snippet, config, callbacks, signal, transcriptContext);
          return;
        } else if (config.provider === "perplexity") {
          await this.streamPerplexityAPI(prompt, mode, profile, snippet, config, callbacks, signal, transcriptContext);
          return;
        } else if (config.provider === "custom_openai") {
          await this.streamOpenAICompatibleAPI(prompt, mode, profile, snippet, config, callbacks, signal, transcriptContext);
          return;
        } else {
          // Gemini
          await this.streamGeminiAPI(prompt, mode, profile, snippet, config, callbacks, signal, transcriptContext);
          return;
        }
      } catch (err: any) {
        if (signal.aborted) return;
        const errMsg = String(err?.message || err);
        console.warn(`Live ${config.provider} API call failed, falling back to built-in model engine:`, errMsg);
        callbacks.onToken(`⚡ *[Notice: ${config.provider.toUpperCase()} API: ${errMsg}. Using built-in intelligence engine...]*\n\n`, "");
      }
    }

    await this.streamLocalEngine(prompt, mode, profile, snippet, callbacks, signal);
  }

  public static async transcribeAudio(blob: Blob, apiKeyOrConfig: AIProviderConfig | string): Promise<string> {
    const config = this.normalizeConfig(apiKeyOrConfig);
    if (!config.apiKey || config.apiKey.trim().length < 5) {
      return "";
    }

    // If using OpenAI or Custom OpenAI with whisper support:
    if (config.provider === "openai" || (config.provider === "custom_openai" && config.apiKey)) {
      try {
        let baseUrl = (config.baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
        if (!baseUrl.endsWith("/v1") && !baseUrl.includes("/v1/")) {
          baseUrl += "/v1";
        }
        const formData = new FormData();
        const extension = blob.type.includes("mp4") ? "mp4" : "webm";
        formData.append("file", blob, `speech.${extension}`);
        formData.append("model", "whisper-1");
        formData.append("language", "en");

        const response = await fetch(`${baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey.trim()}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          if (data?.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch (whisperErr) {
        console.warn("Whisper transcription failed, falling back:", whisperErr);
      }
    }

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const rawMime = blob.type || "audio/webm";
    const mimeType = rawMime.split(";")[0] || "audio/webm";

    for (const model of this.FLASH_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey.trim()}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data
                    }
                  },
                  {
                    text: "Transcribe the spoken words in this audio snippet accurately. Output ONLY the raw transcribed words with normal punctuation. Do not add quotes, commentary, or Markdown formatting. If no speech is present, return nothing."
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 256
            }
          })
        });

        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) return "";
        const clean = candidateText.trim();
        if (clean.toLowerCase() === "none" || clean.toLowerCase() === "none.") return "";
        return clean;
      } catch (err) {
        console.warn(`Model ${model} transcription request failed:`, err);
      }
    }

    return "";
  }

  // 1. OpenAI / ChatGPT Streamer (GPT-4o, o3-mini, o1, etc.)
  private static async streamOpenAIAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    config: AIProviderConfig,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const systemPrompt = this.buildSystemPrompt(mode, profile);
    const fullUserPrompt = transcriptContext && transcriptContext.trim().length > 0
      ? `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== CURRENT QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
      : prompt;

    let userContent: any = fullUserPrompt;
    if (snippet && snippet.dataUrl) {
      userContent = [
        { type: "text", text: fullUserPrompt },
        { type: "image_url", image_url: { url: snippet.dataUrl } }
      ];
    }

    const modelName = config.model || "gpt-4o";
    const requestBody: any = {
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      stream: true
    };
    if (!modelName.startsWith("o1") && !modelName.startsWith("o3")) {
      requestBody.temperature = 0.25;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText.slice(0, 140)}`);
    }

    await this.processSSEStream(response, callbacks, signal, (json) => {
      return json.choices?.[0]?.delta?.content || "";
    });
  }

  // 2. Anthropic Claude Streamer (Claude 3.7 Sonnet, Claude 3.5 Sonnet, Claude 3.5 Haiku)
  private static async streamClaudeAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    config: AIProviderConfig,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const systemPrompt = this.buildSystemPrompt(mode, profile);
    const fullUserPrompt = transcriptContext && transcriptContext.trim().length > 0
      ? `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== CURRENT QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
      : prompt;

    const userContentParts: any[] = [];
    if (snippet && snippet.dataUrl) {
      const mimeMatch = snippet.dataUrl.match(/data:([^;]+);/);
      const mediaType = mimeMatch ? mimeMatch[1] : "image/png";
      const base64Data = snippet.dataUrl.split(",")[1];
      userContentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data
        }
      });
    }
    userContentParts.push({ type: "text", text: fullUserPrompt });

    const modelName = config.model || "claude-3-7-sonnet-20250219";
    const requestBody = {
      model: modelName,
      system: systemPrompt,
      messages: [{ role: "user", content: userContentParts }],
      max_tokens: 2048,
      temperature: 0.25,
      stream: true
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude HTTP ${response.status}: ${errText.slice(0, 140)}`);
    }

    await this.processSSEStream(response, callbacks, signal, (json) => {
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
        return json.delta.text || "";
      }
      return "";
    });
  }

  // 3. Perplexity AI Streamer (Sonar, Sonar Pro, Sonar Reasoning)
  private static async streamPerplexityAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    config: AIProviderConfig,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const systemPrompt = this.buildSystemPrompt(mode, profile);
    const fullUserPrompt = transcriptContext && transcriptContext.trim().length > 0
      ? `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== CURRENT QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
      : prompt;

    const modelName = config.model || "sonar";
    const requestBody = {
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullUserPrompt }
      ],
      temperature: 0.2,
      stream: true
    };

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Perplexity HTTP ${response.status}: ${errText.slice(0, 140)}`);
    }

    await this.processSSEStream(response, callbacks, signal, (json) => {
      return json.choices?.[0]?.delta?.content || "";
    });
  }

  // 4. Custom OpenAI-Compatible Streamer (DeepSeek, Groq, Ollama, OpenRouter, etc.)
  private static async streamOpenAICompatibleAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    config: AIProviderConfig,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const systemPrompt = this.buildSystemPrompt(mode, profile);
    const fullUserPrompt = transcriptContext && transcriptContext.trim().length > 0
      ? `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== CURRENT QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
      : prompt;

    let userContent: any = fullUserPrompt;
    if (snippet && snippet.dataUrl) {
      userContent = [
        { type: "text", text: fullUserPrompt },
        { type: "image_url", image_url: { url: snippet.dataUrl } }
      ];
    }

    let baseUrl = (config.baseUrl || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
    if (!baseUrl.endsWith("/v1") && !baseUrl.includes("/v1/")) {
      baseUrl += "/v1";
    }
    const targetUrl = `${baseUrl}/chat/completions`;

    const modelName = config.model || "deepseek-chat";
    const requestBody: any = {
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      stream: true,
      temperature: 0.25
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (config.apiKey && config.apiKey.trim()) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API HTTP ${response.status}: ${errText.slice(0, 140)}`);
    }

    await this.processSSEStream(response, callbacks, signal, (json) => {
      return json.choices?.[0]?.delta?.content || "";
    });
  }

  // 5. Generic SSE Stream consumer helper
  private static async processSSEStream(
    response: Response,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    extractToken: (json: any) => string
  ) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream received.");

    const decoder = new TextDecoder();
    let accumulated = "";
    let lineBuffer = "";

    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const token = extractToken(parsed);
            if (token) {
              accumulated += token;
              callbacks.onToken(token, accumulated);
            }
          } catch (e) {
            // Ignore partial/non-JSON frame
          }
        }
      }
    }

    if (accumulated.trim().length > 0) {
      callbacks.onComplete(accumulated);
    } else {
      throw new Error("No text content received from stream.");
    }
  }

  // 6. Google Gemini Streamer
  private static async streamGeminiAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKeyOrConfig: AIProviderConfig | string,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const config = this.normalizeConfig(apiKeyOrConfig);
    const apiKey = config.apiKey.trim();
    const systemInstructions = this.buildSystemPrompt(mode, profile);
    const contents: any[] = [];
    const userParts: any[] = [];

    // Inject recent transcript context so the model understands the conversational setup
    if (transcriptContext && transcriptContext.trim().length > 0) {
      userParts.push({
        text: `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== CURRENT QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
      });
    } else {
      userParts.push({ text: prompt });
    }

    if (snippet && snippet.dataUrl) {
      const base64Data = snippet.dataUrl.split(",")[1];
      const mimeMatch = snippet.dataUrl.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      userParts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }

    contents.push({ role: "user", parts: userParts });

    const candidateModels = config.model
      ? [config.model, ...this.FLASH_MODELS.filter((m) => m !== config.model)]
      : this.FLASH_MODELS;

    let lastError: Error | null = null;
    for (const model of candidateModels) {
      if (signal.aborted) return;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstructions }] },
            contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2048
            }
          }),
          signal
        });

        if (!response.ok) {
          lastError = new Error(`Gemini API ${model} HTTP ${response.status}`);
          continue;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No readable stream received.");

        const decoder = new TextDecoder();
        let accumulated = "";
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const jsonStr = trimmed.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                const parsed = JSON.parse(jsonStr);
                const candidate = parsed.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                for (const part of parts) {
                  if (part.text) {
                    accumulated += part.text;
                    callbacks.onToken(part.text, accumulated);
                  }
                }
              } catch (e) {
                // Incomplete JSON or non-text frame
              }
            }
          }
        }

        if (accumulated.trim().length > 0) {
          callbacks.onComplete(accumulated);
          return;
        }
      } catch (err: any) {
        if (signal.aborted) return;
        lastError = err;
      }
    }

    // Secondary fallback: Try standard non-streaming generateContent if streaming SSE failed
    for (const model of this.FLASH_MODELS) {
      if (signal.aborted) return;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstructions }] },
            contents,
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 2048
            }
          }),
          signal
        });

        if (!response.ok) continue;

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          const words = text.split(/(\s+|\n)/);
          let accumulated = "";
          for (const word of words) {
            if (signal.aborted) return;
            accumulated += word;
            callbacks.onToken(word, accumulated);
            await new Promise((r) => setTimeout(r, 6));
          }
          callbacks.onComplete(accumulated);
          return;
        }
      } catch (e: any) {
        if (signal.aborted) return;
      }
    }

    if (lastError) throw lastError;
  }

  private static async streamLocalEngine(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    callbacks: StreamCallbacks,
    signal: AbortSignal
  ) {
    const fullText = this.generateLocalSynthesis(prompt, mode, profile, snippet);
    const words = fullText.split(/(\s+|\n)/);
    let accumulated = "";

    for (let i = 0; i < words.length; i++) {
      if (signal.aborted) return;
      const piece = words[i];
      accumulated += piece;
      callbacks.onToken(piece, accumulated);

      const delay = piece === "\n" ? 16 : piece.length > 5 ? 7 : 3;
      await new Promise((r) => setTimeout(r, delay));
    }

    callbacks.onComplete(accumulated);
  }

  private static buildSystemPrompt(mode: AssistantMode, profile: CandidateProfile): string {
    const lines = [
      "You are an expert, real-time technical interview co-pilot assisting the candidate during a live interview.",
      "",
      "=== CANDIDATE RESUME & PROFILE (GROUND TRUTH) ===",
      "- Full Name: " + (profile.name || "Candidate"),
      "- Target / Current Role: " + (profile.targetRole || "Senior Software Engineer"),
      "- Total Experience: " + (profile.yearsExp || "5+ years"),
      "- Core Languages: " + (profile.primaryLanguages?.join(", ") || "Python, SQL, TypeScript"),
      "- Frameworks & Cloud: " + (profile.frameworks?.join(", ") || "Spark, Databricks, Kafka, Snowflake, AWS, PostgreSQL"),
      "- Work Achievements & Metrics: " + (profile.keyProjects || "High-scale enterprise data and cloud platforms"),
      ""
    ];

    if (profile.resumeText && profile.resumeText.length > 0) {
      lines.push("=== FULL RESUME TEXT ===");
      lines.push(profile.resumeText.slice(0, 4500));
      lines.push("========================");
      lines.push("");
    }

    lines.push("CRITICAL ANSWER RULES:");
    lines.push("1. DIRECT RELEVANCE & ACCURACY: Answer the EXACT question or topic asked. If the prompt is a technical term or concept from the interview transcript, explain that specific concept with precision.");
    lines.push("2. ZERO UNASKED RESUME PITCHES: NEVER talk about AWS, Terraform, Microservices, or candidate background unless the interviewer EXPLICITLY asks for a self-introduction ('Tell me about yourself', 'Walk me through your resume', 'What did you build at your last role?'). For any technical topic or concept, explain the technical mechanics, architecture, and code directly without introductory fluff.");
    lines.push("3. NO DUPLICATE ANSWERS: Each answer must be distinct, addressing the specific prompt with code examples, internal mechanics, and real-world trade-offs.");
    lines.push("4. INTERVIEW FORMAT: Structure answers with crisp bullet points, bold key terms, and exact technical explanations that the user can speak comfortably in an interview.");
    lines.push("5. CONTEXT DISAMBIGUATION: If the prompt is brief or conversational, examine the RECENT INTERVIEW CONVERSATION to determine the actual topic the interviewer was asking about and answer that directly.");
    return lines.join("\n");
  }

  private static generateLocalSynthesis(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null
  ): string {
    const p = prompt.toLowerCase();
    const primaryLang = (profile.primaryLanguages && profile.primaryLanguages[0]) || "Python";
    const candidateName = profile.name || "Candidate";
    const targetRole = profile.targetRole || "Senior Data Engineer";
    const yearsExp = profile.yearsExp || "8+ years";
    const languagesList = profile.primaryLanguages?.join(", ") || "Python, SQL, PySpark";
    const frameworksList = profile.frameworks?.slice(0, 6).join(", ") || "Databricks, Apache Spark, Kafka, Snowflake, AWS, dbt";

    // 1. DATA STRUCTURES & ALGORITHMS

    // Binary Tree / Binary Search Tree (BST)
    if (p.includes("binary tree") || p.includes("bst") || (p.includes("tree") && (p.includes("travers") || p.includes("invert") || p.includes("height") || p.includes("leaf") || p.includes("node") || p.includes("balance")))) {
      return [
        "⭐ **Binary Tree & Binary Search Tree (BST) — Core Concepts:**",
        "",
        "• **Definition:** A hierarchical tree structure where each node has at most two children (`left` and `right`). In a **BST**, all nodes in the left subtree have values `< root`, and all in the right subtree have values `> root`.",
        "• **Traversals:**",
        "  - **In-Order (Left, Root, Right):** Visits BST nodes in strictly sorted ascending order.",
        "  - **Pre-Order (Root, Left, Right):** Ideal for cloning or serializing tree structure.",
        "  - **Post-Order (Left, Right, Root):** Bottom-up evaluation, ideal for deletion or height calculation.",
        "  - **Level-Order (BFS):** Uses a FIFO queue to visit nodes level-by-level.",
        "• **Time Complexity:** Average search/insert/delete is `O(log N)` for balanced trees (AVL/Red-Black); degenerates to `O(N)` for skewed trees.",
        "• **Space Complexity:** `O(H)` where `H` is tree height (recursion stack frames)."
      ].join("\n");
    }

    // Linked List & Reversal
    if (p.includes("linked list") || (p.includes("reverse") && p.includes("list")) || p.includes("cycle detection")) {
      return [
        "⭐ **Linked List — Architecture & Key Operations:**",
        "",
        "• **Structure:** Linear collection of nodes where each node contains data and a reference (`next` pointer, and `prev` in doubly linked lists).",
        "• **Reversal Algorithm (3 Pointers):**",
        "  - Maintain `prev = null`, `curr = head`, `next = null`.",
        "  - Loop: `next = curr.next; curr.next = prev; prev = curr; curr = next;`.",
        "  - **Complexity:** `O(N)` time complexity, `O(1)` space complexity.",
        "• **Cycle Detection (Floyd's Tortoise & Hare):**",
        "  - Fast pointer advances 2 steps while slow pointer advances 1 step. If they meet, a cycle exists.",
        "• **Trade-offs vs Array:** Linked lists allow `O(1)` prepend/insert given a pointer, but lack random access (`O(N)` lookup) and have poor CPU cache locality."
      ].join("\n");
    }

    // Hash Map / Hash Table
    if (p.includes("hash map") || p.includes("hash table") || p.includes("hashmap") || (p.includes("hash") && (p.includes("collision") || p.includes("lookup")))) {
      return [
        "⭐ **Hash Map & Hash Table Internals:**",
        "",
        "• **Core Mechanism:** Maps keys to bucket array indices using a hash function: `index = hash(key) % array_capacity`.",
        "• **Collision Resolution Strategies:**",
        "  - **Separate Chaining:** Each bucket holds a linked list (or balanced BST like Red-Black tree in Java 8+ when bucket size > 8).",
        "  - **Open Addressing (Linear/Quadratic Probing):** Searches for the next open slot directly in the array upon collision.",
        "• **Time Complexity:** Average `O(1)` for search, insert, and delete; worst-case `O(N)` when all keys collide into a single bucket.",
        "• **Load Factor & Rehashing:** When entries / capacity exceeds threshold (typically 0.75), capacity doubles and all keys are rehashed."
      ].join("\n");
    }

    // Two Sum / Arrays & Hashing
    if (p.includes("two sum") || (p.includes("array") && p.includes("sum"))) {
      return [
        "⭐ **Two Sum — Optimal Algorithm:**",
        "",
        "• **Problem:** Find indices of two numbers that add up to a target value.",
        "• **Optimal Approach (One-Pass Hash Map):**",
        "  - Iterate through array while checking if `target - num` exists in the hash map.",
        "  - If found, return `[map.get(target - num), currentIndex]`.",
        "  - Otherwise, insert `num -> currentIndex` into the map.",
        "• **Complexity:** **`O(N)` Time Complexity** (single pass) • **`O(N)` Space Complexity** (hash map storage)."
      ].join("\n");
    }

    // Binary Search
    if (p.includes("binary search")) {
      return [
        "⭐ **Binary Search — Principles & Complexity:**",
        "",
        "• **Prerequisite:** Input array must be sorted in ascending or monotonic order.",
        "• **Algorithm:** Repeatedly bisect search range by comparing target with middle element.",
        "• **Mid Calculation:** Use `mid = left + Math.floor((right - left) / 2)` to eliminate integer overflow.",
        "• **Complexity:** **`O(log N)` Time Complexity** • **`O(1)` Space Complexity**."
      ].join("\n");
    }

    // 2. OBJECT-ORIENTED PROGRAMMING (OOP) & DESIGN PATTERNS

    // Polymorphism
    if (p.includes("polymorphism")) {
      return [
        "⭐ **Polymorphism in Object-Oriented Programming:**",
        "",
        "• **Definition:** The ability of different objects to respond to the same message/method call in their own class-specific manner.",
        "• **Compile-Time Polymorphism (Static / Overloading):**",
        "  - Multiple methods in the same class share the same name but have different parameter signatures.",
        "  - Resolved at compile time by the compiler.",
        "• **Runtime Polymorphism (Dynamic / Overriding):**",
        "  - A subclass provides a specific implementation of a method defined in its superclass or interface.",
        "  - Resolved dynamically at runtime via **Virtual Method Table (vtable)** dispatch.",
        "• **Key Benefit:** Loose coupling — caller code interacts with high-level interfaces without knowing concrete underlying implementations."
      ].join("\n");
    }

    // OOP Pillars: Encapsulation, Abstraction, Inheritance
    if (p.includes("oop") || p.includes("pillars") || p.includes("encapsulation") || p.includes("inheritance") || p.includes("abstraction")) {
      return [
        "⭐ **Core Pillars of Object-Oriented Programming (OOP):**",
        "",
        "• **Encapsulation:** Bundling data (state) and methods (behavior) within a class, and restricting direct access to internal components using access modifiers (`private`, `protected`).",
        "• **Abstraction:** Hiding complex internal implementation details and exposing only a clean, simple interface to consumers.",
        "• **Inheritance:** Enabling a new class to inherit attributes and methods from an existing class to foster reusability ('is-a' relationship). Modern design prefers composition over inheritance.",
        "• **Polymorphism:** Allowing entities to take on multiple forms through method overriding (dynamic) and method overloading (static)."
      ].join("\n");
    }

    // SOLID Principles
    if (p.includes("solid")) {
      return [
        "⭐ **SOLID Principles — Clean Software Architecture:**",
        "",
        "• **S — Single Responsibility Principle (SRP):** A class should have only one reason to change, handling exactly one responsibility.",
        "• **O — Open/Closed Principle (OCP):** Software entities should be open for extension, but closed for modification.",
        "• **L — Liskov Substitution Principle (LSP):** Subtypes must be substitutable for their base types without altering system correctness.",
        "• **I — Interface Segregation Principle (ISP):** Clients should not be forced to depend on interfaces they do not use (prefer small, focused interfaces).",
        "• **D — Dependency Inversion Principle (DIP):** High-level modules should depend on abstractions (interfaces), not concrete low-level implementations."
      ].join("\n");
    }

    // 3. NETWORKING, PROTOCOLS & DISTRIBUTED SYSTEMS

    // TCP vs UDP
    if (p.includes("tcp") || p.includes("udp")) {
      return [
        "⭐ **TCP vs UDP — Transport Layer Protocol Comparison:**",
        "",
        "• **TCP (Transmission Control Protocol):**",
        "  - **Connection-Oriented:** Establishes connection via **3-Way Handshake (SYN -> SYN-ACK -> ACK)**.",
        "  - **Reliability:** Guaranteed delivery through sequence numbers, acknowledgments (ACKs), and automatic retransmissions.",
        "  - **Flow & Congestion Control:** Implements sliding window flow control and congestion avoidance algorithms.",
        "  - **Best for:** Web (HTTP/HTTPS), databases, file transfers, financial transactions.",
        "",
        "• **UDP (User Datagram Protocol):**",
        "  - **Connectionless:** Broadcasts datagrams immediately without handshake or state tracking.",
        "  - **No Delivery Guarantees:** Packets may arrive out-of-order or drop without retransmission.",
        "  - **Lowest Latency & Overhead:** Minimal 8-byte header overhead with zero handshake lag.",
        "  - **Best for:** Real-time gaming, live video/audio streaming, DNS queries, VoIP."
      ].join("\n");
    }

    // CAP Theorem
    if (p.includes("cap theorem") || p.includes("cap")) {
      return [
        "⭐ **CAP Theorem — Distributed Systems Trade-off:**",
        "",
        "• **Core Rule:** In any asynchronous network subject to partitions, a distributed data store can guarantee at most **two out of three** properties:",
        "  - **C — Consistency:** Every read receives the most recent write or an error.",
        "  - **A — Availability:** Every non-failing node returns a response for every request (never errors or times out).",
        "  - **P — Partition Tolerance:** The system continues functioning despite network packet loss or delayed messages.",
        "• **Real-World Reality:** Network partitions (**P**) are physically inevitable. Therefore, systems must choose between:",
        "  - **CP (Consistency + Partition Tolerance):** Rejects writes or times out during split-brain to protect data correctness (e.g. Spanner, HBase, ZooKeeper).",
        "  - **AP (Availability + Partition Tolerance):** Continues serving reads/writes using eventual consistency, reconciliation, or CRDTs (e.g. Cassandra, DynamoDB, Couchbase)."
      ].join("\n");
    }

    // REST vs GraphQL vs gRPC
    if (p.includes("rest") || p.includes("graphql") || p.includes("grpc")) {
      return [
        "⭐ **API Architecture Comparison: REST vs GraphQL vs gRPC:**",
        "",
        "• **REST (Representational State Transfer):** Standard HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`) with resource URIs. Highly cacheable at HTTP layer; suffers from over-fetching and under-fetching.",
        "• **GraphQL:** Single endpoint where clients declare exact query structures. Solves over-fetching and allows multiple resource stitching in a single trip; requires complex caching and query depth protection.",
        "• **gRPC (Google Remote Procedure Call):** Runs over HTTP/2 using Protocol Buffers binary serialization. Extremely low latency, strong type generation, and bidirectional streaming; ideal for internal microservice communication."
      ].join("\n");
    }

    // 4. CONCURRENCY & OPERATING SYSTEMS

    // Process vs Thread / Concurrency / Deadlock
    if (p.includes("process") && p.includes("thread")) {
      return [
        "⭐ **Process vs Thread — Operating System Primitives:**",
        "",
        "• **Process:** Independent program instance with its own private address space, heap, memory descriptors, and OS handles. High context-switch cost; communication requires IPC (sockets, pipes, shared memory).",
        "• **Thread:** Smallest unit of execution scheduled within a process. Threads share the process heap, code, and global variables, but maintain individual stacks and registers. Low context-switch cost; requires synchronization (locks) to prevent data races."
      ].join("\n");
    }

    if (p.includes("deadlock")) {
      return [
        "⭐ **Deadlock — Conditions & Prevention Strategies:**",
        "",
        "• **Definition:** A state where two or more threads are permanently blocked, each holding a lock that the other needs.",
        "• **4 Coffman Conditions Required for Deadlock:**",
        "  1. **Mutual Exclusion:** Resources cannot be shared simultaneously.",
        "  2. **Hold and Wait:** A thread holds resources while waiting for others.",
        "  3. **No Preemption:** Resources cannot be forcibly revoked.",
        "  4. **Circular Wait:** Closed chain of threads waiting on each other's locks.",
        "• **Prevention:** Acquire locks in a strict global ordering, use lock timeouts (`tryLock`), or implement lock-free concurrent data structures."
      ].join("\n");
    }

    // Garbage Collection
    if (p.includes("garbage collect") || p.includes("gc")) {
      return [
        "⭐ **Garbage Collection (GC) — Memory Management:**",
        "",
        "• **Core Purpose:** Automatically identifies and reclaims heap memory occupied by objects that are no longer reachable from GC roots.",
        "• **Generational Hypothesis:** Most allocated objects die young. Heap is split into:",
        "  - **Young Generation (Eden, Survivor):** Frequently collected via fast Minor GC.",
        "  - **Old / Tenured Generation:** Long-lived objects collected via Major / Full GC.",
        "• **Algorithms:** Mark-Sweep (identifies live objects, frees remainder), Mark-Compact (defragments free space), Reference Counting (Python, Swift with cycle detectors)."
      ].join("\n");
    }

    // 5. DATA ENGINEERING & CLOUD

    // Apache Spark / PySpark / Databricks
    if (p.includes("spark") || p.includes("databricks") || p.includes("pyspark") || p.includes("shuffle") || p.includes("skew") || p.includes("partition")) {
      return [
        "⭐ **Apache Spark & Databricks — Core Architecture & Optimization:**",
        "",
        "• **Driver vs Executor Execution:** Driver analyzes the DAG, optimizes via Catalyst Optimizer, and schedules tasks across Executor worker JVMs.",
        "• **Shuffle Spill & Remediation:** Shuffle spill (Memory to Disk) happens when executor memory is overwhelmed during wide transformations (`groupBy`, `join`). Fix by increasing `spark.sql.shuffle.partitions`, enabling Adaptive Query Execution (`spark.sql.adaptive.enabled = true`), or salting skewed keys.",
        "• **Data Skew Strategies:** Broadcast smaller tables (`broadcast(df)`) to bypass shuffle entirely; for skewed large joins, append a random salt key `0..N-1` to distribute partition hotspots evenly.",
        "• **Storage & Lakehouse:** Delta Lake uses Parquet data files with an ACID transaction log (`_delta_log`), enabling `OPTIMIZE` file compaction, `Z-ORDER` clustering for multi-column skip indexing, and Time Travel."
      ].join("\n");
    }

    // Apache Kafka
    if (p.includes("kafka") || p.includes("streaming") || p.includes("event-driven") || p.includes("consumer lag")) {
      return [
        "⭐ **Apache Kafka & Distributed Streaming Architecture:**",
        "",
        "• **Topic & Partition Design:** Topics are divided into partitions for parallelism. Partition keys determine partition placement via Murmur2 hashing; ordered guarantees exist strictly within a single partition.",
        "• **Consumer Lag Triage:** Lag occurs when consumption rate < production rate. Address by increasing topic partitions and matching consumer instances up to partition count, tuning `max.poll.records`, or optimizing downstream processing.",
        "• **Exactly-Once Semantics (EOS):** Achieved via idempotent producer (`enable.idempotence=true` with transactional IDs) combined with `read_committed` consumer isolation.",
        "• **Fault Tolerance & ISR:** In-Sync Replicas (`min.insync.replicas=2`, `acks=all`) prevent data loss during broker failovers."
      ].join("\n");
    }

    // Snowflake, BigQuery & Data Warehousing
    if (p.includes("snowflake") || p.includes("bigquery") || p.includes("warehouse") || p.includes("lakehouse") || p.includes("dbt")) {
      return [
        "⭐ **Cloud Data Warehousing & Modern Lakehouse (Snowflake / BigQuery / dbt):**",
        "",
        "• **Decoupled Compute & Storage:** Compute virtual warehouses scale independently from persistent columnar storage (S3/GCS/Azure Blob). Multi-cluster warehouses auto-suspend and auto-scale.",
        "• **Micro-partitioning & Pruning:** Data is automatically partitioned into immutable columnar micro-partitions (50-500MB). Clustering keys ensure aggressive partition pruning on high-cardinality filters.",
        "• **dbt Transformation Layer:** Modular ELT using SQL `ref()` macros. Implements lineage DAGs, incremental models (`is_incremental()`), schema tests, and documentation.",
        "• **Zero-Copy Cloning & Time Travel:** Instant environment replication for staging/QA without physical data duplication via metadata pointers."
      ].join("\n");
    }

    // Database, SQL, Indexing & ACID
    if (p.includes("acid") || p.includes("index") || p.includes("database") || p.includes("sql") || p.includes("transaction") || p.includes("join")) {
      return [
        "⭐ **Database Design, SQL Performance & Storage Engines:**",
        "",
        "• **ACID Guarantees:** **Atomicity** (WAL / undo logs), **Consistency** (schema invariants and foreign keys), **Isolation** (MVCC snapshots and transaction isolation levels: Read Committed vs Serializable), **Durability** (fsync to non-volatile disk).",
        "• **Indexing Strategies:** B+ Trees for range queries, sorting, and prefix scans; Hash indexes for exact key lookups. Create composite indexes ordered by column cardinality.",
        "• **Join Algorithms:** Nested Loop (small sets / indexed inner), Hash Join (large unsorted equi-joins using in-memory build phase), Merge Join (pre-sorted streams).",
        "• **Row vs Columnar Storage:** Row stores (PostgreSQL, MySQL) excel at OLTP point-writes and full-row fetches; Columnar formats (Parquet, ORC, Snowflake) compress dramatically and scan only queried columns for OLAP aggregates."
      ].join("\n");
    }

    // Docker & Kubernetes
    if (p.includes("docker") || p.includes("kubernetes") || p.includes("k8s") || p.includes("container") || p.includes("pod")) {
      return [
        "⭐ **Cloud-Native Infrastructure & Container Orchestration:**",
        "",
        "• **Container Fundamentals:** Docker packages application code and OS userland dependencies using Linux cgroups (resource limits) and namespaces (isolation).",
        "• **Kubernetes Workload Primitives:** Pods (smallest schedulable unit), Deployments (declarative replica management & zero-downtime rolling updates), Services (ClusterIP/LoadBalancer stable networking).",
        "• **High Availability & Autoscaling:** Horizontal Pod Autoscaler (HPA) driven by CPU/Memory or custom Prometheus metrics; cluster autoscaler scales node pools.",
        "• **Networking & Ingress:** Ingress controllers (Nginx, Envoy) handle TLS termination, path-based routing, and load balancing across microservices."
      ].join("\n");
    }

    // Python Internals
    if (p.includes("python") || p.includes("gil") || p.includes("multiprocessing") || p.includes("generator") || p.includes("async")) {
      return [
        "⭐ **Python Performance, Concurrency & Core Internals:**",
        "",
        "• **Global Interpreter Lock (GIL):** Mutex preventing multiple native threads from executing Python bytecodes simultaneously in CPython. Use `multiprocessing` for CPU-bound tasks and `asyncio` / `threading` for I/O-bound concurrency.",
        "• **Generators & Iterators:** `yield` produces memory-efficient lazy evaluation streams without loading multi-gigabyte datasets into memory at once.",
        "• **Memory Management:** Reference counting combined with a generational cyclic garbage collector for circular references. Use `__slots__` to suppress instance `__dict__` for high-volume objects.",
        "• **Typing & Clean Architecture:** Use `dataclasses`, Pydantic for validation, and typing annotations for defensive, production-ready pipelines."
      ].join("\n");
    }

    // Introduction / Resume Walkthrough (strictly scoped to personal introduction)
    const isExplicitIntro =
      p === "tell me about yourself" ||
      p.startsWith("tell me about yourself") ||
      p === "explain yourself" ||
      p.startsWith("explain yourself") ||
      p.includes("walk me through your resume") ||
      p.includes("walk through your resume") ||
      p.includes("introduce yourself") ||
      p.includes("give me your elevator pitch") ||
      p === "who are you" ||
      p === "tell me about your background" ||
      p === "walk me through your background" ||
      p === "what is your background" ||
      p === "tell me about your role" ||
      p === "what do you do" ||
      p.startsWith("why should we hire you");

    const isNotTechnicalQuestion =
      !p.includes("if ") &&
      !p.includes("when ") &&
      !p.includes("how to ") &&
      !p.includes("how do you ") &&
      !p.includes("how would you ") &&
      !p.includes("what would you ") &&
      !p.includes("difference") &&
      !p.includes("explain how") &&
      !p.includes("in python") &&
      !p.includes("in sql") &&
      !p.includes("in java") &&
      !p.includes("in spark") &&
      !p.includes("in databricks") &&
      !p.includes("in kafka");

    const isIntroOrResume = isExplicitIntro && isNotTechnicalQuestion;

    if (isIntroOrResume) {
      const topMetrics = profile.keyMetrics && profile.keyMetrics.length > 0
        ? profile.keyMetrics.slice(0, 3)
        : [
            "Architected distributed data platforms handling millions of records daily with high reliability.",
            "Optimized pipeline execution and cluster resources, reducing processing latency by over 40%.",
            "Led modern data stack migration to Databricks and cloud-native lakehouse architecture."
          ];

      return [
        "### 🎙️ The 60-Second Elevator Pitch (Personalized from your Resume)",
        "*(Speak this naturally to the interviewer)*",
        "",
        "\"Hi, thanks for having me! I'm **" + candidateName + "**, currently working as a **" + targetRole + "** with over **" + yearsExp + "** of experience designing and scaling production data and software systems.",
        "",
        "Throughout my career, my primary technical focus has centered on **" + languagesList + "**, alongside modern architectures like **" + frameworksList + "**.",
        "",
        "Most recently, my work has focused on: **" + (profile.keyProjects?.slice(0, 180) || "architecting event-driven data pipelines, lakehouse governance, and scalable backend platforms") + "**.\"",
        "",
        "#### 📌 Key Highlights to Emphasize:",
        "* **Role & Experience:** " + targetRole + " with " + yearsExp + " in production engineering.",
        "* **Core Stack:** " + languagesList + " • " + frameworksList + ".",
        ...topMetrics.map((m) => "* **Measurable Impact:** " + m),
        "",
        "#### 💡 How to Close:",
        "*\"What excites me about this opportunity is the chance to bring my experience in " + (profile.frameworks?.[0] || "scalable data platforms") + " and " + primaryLang + " to solve high-impact challenges with your team.\"*"
      ].filter(Boolean).join("\n");
    }

    // Behavioral Questions (STAR Method)
    const isBehavioral =
      p.includes("tell me about a time") ||
      p.includes("conflict") ||
      p.includes("disagreement") ||
      p.includes("failure") ||
      p.includes("mistake") ||
      p.includes("leadership") ||
      p.includes("difficult") ||
      p.includes("challenge") ||
      mode === "behavioral";

    if (isBehavioral && mode !== "coding") {
      const metricHighlight = (profile.keyMetrics && profile.keyMetrics[0]) || "Scaled pipeline throughput by 3x and reduced data latency by 45%.";

      return [
        "### 🌟 STAR Framework (Grounded in " + candidateName + "'s Experience)",
        "**Question:** \"" + prompt + "\"",
        "",
        "#### 1. Situation:",
        "During my tenure as **" + targetRole + "** (working on " + (profile.keyProjects?.slice(0, 110) || "enterprise data pipelines") + "), our team encountered a critical scalability bottleneck during peak processing hours.",
        "",
        "#### 2. Task:",
        "As lead engineer, my goal was to eliminate the processing delay using **" + frameworksList + "** while keeping SLA commitments intact and preventing data inconsistency.",
        "",
        "#### 3. Action:",
        "* **Root Cause Isolation:** Profiled distributed execution metrics and memory footprints to isolate partition skew and resource contention.",
        "* **Implementation:** Re-architected pipeline transformations with optimized partitioning and caching using **" + primaryLang + "**.",
        "* **Cross-Team Alignment:** Conducted technical reviews with senior stakeholders and instituted automated CI/CD validation tests.",
        "",
        "#### 4. Result:",
        "* **" + metricHighlight + "**",
        "* Zero SLA breaches and 99.9% pipeline reliability.",
        "* Established design patterns adopted across engineering squads."
      ].join("\n");
    }

    // 6. DYNAMIC TECHNICAL SYNTHESIS (Clean, question-focused answer structure)
    const cleanPrompt = prompt.trim();
    return [
      "⭐ **Key Takeaways & Explanation: " + cleanPrompt + "**",
      "",
      "• **Core Concept:** Directly addressing **" + cleanPrompt + "**: In an interview, begin by stating the formal definition, its primary use case, and the exact problem it solves.",
      "• **How It Works & Implementation:**",
      "  - Identify the primary components, data flow, or state transitions involved.",
      "  - Highlight standard patterns or algorithms used to implement this in " + primaryLang + ".",
      "• **Key Considerations & Trade-offs:**",
      "  - **Complexity:** Evaluate time complexity (`O(1)` vs `O(N)` vs `O(log N)`) and memory/space overhead.",
      "  - **Edge Cases:** Consider null inputs, boundary conditions, concurrency/race conditions, and error recovery.",
      "• **Interview Delivery Tip:** Structure your response into: (1) High-level definition, (2) Internal mechanics with a brief code/design example, and (3) Practical trade-offs from your past experience."
    ].join("\n");
  }
}
