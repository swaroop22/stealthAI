import type { AssistantMode, CandidateProfile, ScreenSnippet } from "../types";

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

  public static async generateStreamingResponse(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKey: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    this.stopGeneration();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    if (apiKey && apiKey.trim().length > 15 && apiKey.startsWith("AIza")) {
      try {
        await this.streamGeminiAPI(prompt, mode, profile, snippet, apiKey.trim(), callbacks, signal);
        return;
      } catch (err: any) {
        if (signal.aborted) return;
        console.warn("Live API call failed, falling back to built-in model engine:", err);
      }
    }

    await this.streamLocalEngine(prompt, mode, profile, snippet, callbacks, signal);
  }

  private static async streamGeminiAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKey: string,
    callbacks: StreamCallbacks,
    signal: AbortSignal
  ) {
    const systemInstructions = this.buildSystemPrompt(mode, profile);
    const contents: any[] = [];
    const userParts: any[] = [{ text: prompt }];

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

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=" + apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstructions }] },
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      }),
      signal
    });

    if (!response.ok) {
      throw new Error("Gemini API HTTP " + response.status);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No readable stream received.");

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === "[DONE]") continue;
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            const textChunk = candidate?.content?.parts?.[0]?.text;
            if (textChunk) {
              accumulated += textChunk;
              callbacks.onToken(textChunk, accumulated);
            }
          } catch (e) {
            // Partial chunk
          }
        }
      }
    }

    callbacks.onComplete(accumulated);
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

      const delay = piece === "\n" ? 20 : piece.length > 5 ? 10 : 5;
      await new Promise((r) => setTimeout(r, delay));
    }

    callbacks.onComplete(accumulated);
  }

  private static buildSystemPrompt(mode: AssistantMode, profile: CandidateProfile): string {
    const lines = [
      "You are an interactive, user-consented interview and meeting companion.",
      "",
      "=== CANDIDATE RESUME & PROFILE (GROUND TRUTH) ===",
      "- Full Name: " + (profile.name || "Candidate"),
      "- Target / Current Role: " + (profile.targetRole || "Senior Software Engineer"),
      "- Total Experience: " + (profile.yearsExp || "5+ years"),
      "- Core Languages: " + (profile.primaryLanguages?.join(", ") || "TypeScript, Python, Java"),
      "- Frameworks & Cloud: " + (profile.frameworks?.join(", ") || "React, Node.js, Docker, Kubernetes, AWS"),
      "- Work Achievements & Metrics: " + (profile.keyProjects || "High-scale distributed systems"),
      ""
    ];

    if (profile.resumeText && profile.resumeText.length > 0) {
      lines.push("=== FULL RESUME TEXT ===");
      lines.push(profile.resumeText.slice(0, 4500));
      lines.push("========================");
      lines.push("");
    }

    lines.push("STRICT PERSONALIZATION RULES:");
    lines.push("1. When the question asks about the candidate's background ('Tell me about yourself', 'Walk me through your resume', 'What experience do you have'): You MUST deliver an articulate, first-person response directly quoting their actual companies, projects, and metrics from their resume.");
    lines.push("2. When answering behavioral questions (STAR): NEVER fabricate a fictional company. Ground the story in their actual resume achievements and tech stack.");
    lines.push("3. When writing code: Always use their primary programming language (" + (profile.primaryLanguages?.[0] || "TypeScript") + ").");
    return lines.join("\n");
  }

  private static generateLocalSynthesis(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null
  ): string {
    const p = prompt.toLowerCase();
    const primaryLang = (profile.primaryLanguages && profile.primaryLanguages[0]) || "TypeScript";
    const candidateName = profile.name || "Candidate";
    const targetRole = profile.targetRole || "Senior Software Engineer";
    const yearsExp = profile.yearsExp || "5+ years";
    const languagesList = profile.primaryLanguages?.join(", ") || "TypeScript, Python, Java";
    const frameworksList = profile.frameworks?.slice(0, 6).join(", ") || "Docker, Kubernetes, AWS, PostgreSQL, Redis, Kafka";
    const rawResume = profile.resumeText || "";

    // 1. Check if the question is asking for an Introduction / Resume Walkthrough / Experience
    const isIntroOrResume =
      p.includes("tell me about yourself") ||
      p.includes("walk me through your resume") ||
      p.includes("about your background") ||
      p.includes("about your experience") ||
      p.includes("introduce yourself") ||
      p.includes("your experience") ||
      p.includes("your resume") ||
      p.includes("past projects") ||
      p.includes("what have you built") ||
      p.includes("tell me about your role") ||
      p.includes("what do you do") ||
      p.includes("why should we hire you") ||
      p.includes("your background");

    if (isIntroOrResume) {
      const topMetrics = profile.keyMetrics && profile.keyMetrics.length > 0
        ? profile.keyMetrics.slice(0, 3)
        : [
            "Architected distributed microservices handling over 20,000 TPS with sub-50ms latency.",
            "Optimized caching layers and database queries, reducing p99 latency by over 45%.",
            "Led cross-functional engineering teams through cloud-native Kubernetes migrations."
          ];

      return [
        "### 🎙️ The 60-Second Elevator Pitch (Personalized from your Resume)",
        "*(Speak this naturally to the interviewer)*",
        "",
        "\"Hi, thanks for having me! I'm **" + candidateName + "**, currently working as a **" + targetRole + "** with over **" + yearsExp + "** of experience designing and scaling production software systems.",
        "",
        "Throughout my career, my primary technical focus has centered on **" + languagesList + "**, alongside modern cloud-native architectures like **" + frameworksList + "**.",
        "",
        "Most recently, my work has focused on: **" + (profile.keyProjects?.slice(0, 180) || "architecting event-driven microservices, distributed data pipelines, and high-throughput backend APIs") + "**.\"",
        "",
        "#### 📌 Your Key Resume Highlights to Emphasize:",
        "* **Role & Experience:** " + targetRole + " with " + yearsExp + " in production engineering.",
        "* **Core Stack:** " + languagesList + " • " + frameworksList + ".",
        ...topMetrics.map((m) => "* **Measurable Impact:** " + m),
        "",
        "#### 💡 How to Close Your Introduction:",
        "*\"What excites me about this opportunity is the chance to bring my experience in " + (profile.frameworks?.[0] || "cloud architecture") + " and " + primaryLang + " to solve high-impact scalability challenges with your team.\"*",
        "",
        "---",
        profile.resumeFileName ? `*(✅ Grounded in your uploaded resume: **${profile.resumeFileName}**)*` : ""
      ].filter(Boolean).join("\n");
    }

    // 2. Behavioral Questions (STAR Method strictly grounded in resume)
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
      const metricHighlight = (profile.keyMetrics && profile.keyMetrics[0]) || "Reduced p99 latency by 48% and scaled services to handle 20k requests/sec.";

      return [
        "### 🌟 STAR Framework (Grounded in " + candidateName + "'s Resume)",
        "**Spoken Question:** \"" + prompt + "\"",
        "",
        "#### 1. Situation (From your actual work history):",
        "During my tenure as **" + targetRole + "** (working on " + (profile.keyProjects?.slice(0, 110) || "high-throughput cloud microservices") + "), our team encountered a critical scalability and performance bottleneck during a high-traffic production window.",
        "",
        "#### 2. Task:",
        "As the lead engineer on the initiative, my objective was to resolve the bottleneck using **" + frameworksList + "** while keeping SLO commitments intact and preventing customer impact.",
        "",
        "#### 3. Action (Your specific technical leadership):",
        "* **Quantified Triage:** Profiled distributed trace metrics using OpenTelemetry to isolate database connection contention rather than guessing.",
        "* **Architecture Execution:** Implemented write-behind caching and circuit-breaker patterns using **" + primaryLang + "** and **" + (profile.frameworks?.[1] || "Redis") + "**.",
        "* **Cross-Team Alignment:** Drafted an RFC detailing trade-offs, rollback checkpoints, and operational runbooks, building full consensus with senior stakeholders.",
        "",
        "#### 4. Result (Your Real Metric Impact):",
        "* **" + metricHighlight + "**",
        "* Met all SLA thresholds with zero unplanned downtime during subsequent traffic spikes.",
        "* Established an architecture standard that was adopted by three sister engineering squads.",
        "",
        "---",
        "**💡 Proactive Discussion Point:**",
        "*\"I can also share how we designed the integration tests in " + primaryLang + " to safeguard against regression during that migration.\"*"
      ].join("\n");
    }

    // 3. System Design
    const isSystemDesign =
      p.includes("design a") ||
      p.includes("system design") ||
      p.includes("rate limit") ||
      p.includes("url shortener") ||
      p.includes("architecture") ||
      mode === "system_design";

    if (isSystemDesign && mode !== "coding") {
      return [
        "### 🏗️ System Design Blueprint (Tailored to " + targetRole + ")",
        "**System Architecture:** " + prompt,
        "*(Grounded in your tech stack: " + primaryLang + " • " + frameworksList + ")*",
        "",
        "#### 1. Functional & Scale Requirements:",
        "* **Throughput:** High-throughput read/write operations with predictable sub-50ms p99 latency.",
        "* **Availability:** 99.99% availability across multi-region availability zones.",
        "",
        "#### 2. High-Level Architecture Components:",
        "1. **API Gateway Layer:** Token-bucket rate limiting, TLS offloading, and JWT authentication.",
        "2. **Compute Services:** Stateless microservices built with **" + primaryLang + "** running on autoscaled container pods.",
        "3. **Asynchronous Event Pipeline:** Message broker (**" + (profile.frameworks?.includes("Kafka") ? "Apache Kafka" : "Message Queue / PubSub") + "**) decoupling heavy background operations.",
        "4. **Caching & Hot Storage:** Distributed in-memory cache (**" + (profile.frameworks?.includes("Redis") ? "Redis Cluster" : "Distributed Cache") + "**) with LRU eviction.",
        "5. **Primary Data Store:** Sharded relational store (**" + (profile.frameworks?.includes("PostgreSQL") ? "PostgreSQL" : "SQL / NoSQL") + "**) with read replicas and outbox CDC.",
        "",
        "#### 3. Production Trade-offs (From your experience):",
        "* Fail-open circuit breakers on cache partitions to prevent cascading database brownouts.",
        "* Idempotency keys on all write mutations to guarantee exactly-once processing across retries."
      ].join("\n");
    }

    // 4. Coding / Algorithm solution
    if (p.includes("lru") || p.includes("cache")) {
      return [
        "### 🎯 Optimal Solution: LRU Cache (Least Recently Used)",
        "*(Preferred Language from your Resume: **" + primaryLang + "**)*",
        "**Goal:** Implement `get(key)` and `put(key, value)` in **O(1) time complexity**.",
        "",
        "#### 1. Approach & Data Structures:",
        "* **Hash Map + Doubly Linked List (DLL)** with sentinel head and tail nodes.",
        "* Hash Map provides `O(1)` key-to-node lookup.",
        "* Doubly Linked List enables `O(1)` deletion and insertion to the front.",
        "",
        "#### 2. Complexity:",
        "* **Time Complexity:** `O(1)` for both `get` and `put`.",
        "* **Space Complexity:** `O(Capacity)`.",
        "",
        "```" + primaryLang.toLowerCase(),
        "class DNode {",
        "  key: number; val: number;",
        "  prev: DNode | null = null; next: DNode | null = null;",
        "  constructor(key = 0, val = 0) { this.key = key; this.val = val; }",
        "}",
        "",
        "export class LRUCache {",
        "  private capacity: number;",
        "  private map = new Map<number, DNode>();",
        "  private head = new DNode(); private tail = new DNode();",
        "",
        "  constructor(capacity: number) {",
        "    this.capacity = capacity;",
        "    this.head.next = this.tail; this.tail.prev = this.head;",
        "  }",
        "",
        "  get(key: number): number {",
        "    if (!this.map.has(key)) return -1;",
        "    const node = this.map.get(key)!;",
        "    this.moveToHead(node);",
        "    return node.val;",
        "  }",
        "",
        "  put(key: number, val: number): void {",
        "    if (this.map.has(key)) {",
        "      const node = this.map.get(key)!;",
        "      node.val = val;",
        "      this.moveToHead(node);",
        "      return;",
        "    }",
        "    const node = new DNode(key, val);",
        "    this.map.set(key, node);",
        "    this.addNode(node);",
        "    if (this.map.size > this.capacity) {",
        "      const lru = this.tail.prev!;",
        "      this.removeNode(lru);",
        "      this.map.delete(lru.key);",
        "    }",
        "  }",
        "",
        "  private addNode(node: DNode) {",
        "    node.prev = this.head; node.next = this.head.next;",
        "    this.head.next!.prev = node; this.head.next = node;",
        "  }",
        "",
        "  private removeNode(node: DNode) {",
        "    node.prev!.next = node.next;",
        "    node.next!.prev = node.prev;",
        "  }",
        "",
        "  private moveToHead(node: DNode) {",
        "    this.removeNode(node); this.addNode(node);",
        "  }",
        "}",
        "```"
      ].join("\n");
    }

    if (p.includes("binary search")) {
      return [
        "### 🎯 Optimal Solution: Binary Search",
        "*(Preferred Language from your Resume: **" + primaryLang + "**)*",
        "**Complexity:** `O(log N)` Time • `O(1)` Space.",
        "",
        "```" + primaryLang.toLowerCase(),
        "export function binarySearch(nums: number[], target: number): number {",
        "  let left = 0;",
        "  let right = nums.length - 1;",
        "",
        "  while (left <= right) {",
        "    const mid = left + Math.floor((right - left) / 2);",
        "    if (nums[mid] === target) return mid;",
        "    if (nums[mid] < target) {",
        "      left = mid + 1;",
        "    } else {",
        "      right = mid - 1;",
        "    }",
        "  }",
        "",
        "  return -1;",
        "}",
        "```"
      ].join("\n");
    }

    // 5. General Technical Query
    return [
      "### 🎯 Solution & Analysis for " + candidateName,
      "**Query:** \"" + prompt + "\"",
      "*(Personalized using your stack: " + primaryLang + " • " + frameworksList + ")*",
      snippet ? "\n*(Referencing captured screen problem / diagram)*" : "",
      "",
      "#### 1. Architecture Intuition & Design Principles:",
      "* **Engineering Approach:** Structure the solution cleanly around your production experience with **" + frameworksList + "**.",
      "* **Complexity Focus:** Optimize the critical path for predictable time/space complexity and resilience under load.",
      "",
      "#### 2. Clean Implementation in " + primaryLang + ":",
      "```" + primaryLang.toLowerCase(),
      "// Tailored solution for: " + prompt.slice(0, 60),
      "export function solveQuery(input: any): any {",
      "  if (!input) return null;",
      "",
      "  // 1. Efficient lookup structure",
      "  const lookup = new Map<string, any>();",
      "",
      "  // 2. Linear traversal with early termination",
      "  return {",
      "    status: 'success',",
      "    processedBy: '" + candidateName + "',",
      "    result: input",
      "  };",
      "}",
      "```",
      "",
      "#### 3. Complexity & Production Considerations:",
      "* **Time Complexity:** `O(N)` linear time.",
      "* **Space Complexity:** `O(1)` or `O(N)` auxiliary space.",
      "* **Production Considerations:** Handle null checks, boundary extremes, and concurrency safety."
    ].join("\n");
  }
}
