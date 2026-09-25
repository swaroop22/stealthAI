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

  // Active Gemini models supported by Google Generative AI API
  private static readonly FLASH_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-2.0-flash-lite"
  ];

  public static async generateStreamingResponse(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKey: string,
    callbacks: StreamCallbacks,
    transcriptContext?: string
  ): Promise<void> {
    this.stopGeneration();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    if (apiKey && apiKey.trim().length > 15) {
      try {
        await this.streamGeminiAPI(prompt, mode, profile, snippet, apiKey.trim(), callbacks, signal, transcriptContext);
        return;
      } catch (err: any) {
        if (signal.aborted) return;
        const errMsg = String(err?.message || err);
        console.warn("Live API call failed, falling back to built-in model engine:", errMsg);
        if (errMsg.includes("429") || errMsg.includes("quota")) {
          callbacks.onToken("⚡ *[Notice: Gemini Free Tier rate limit reached. Using built-in engine while quota resets...]*\n\n", "");
        }
      }
    }

    await this.streamLocalEngine(prompt, mode, profile, snippet, callbacks, signal);
  }

  public static async transcribeAudio(blob: Blob, apiKey: string): Promise<string> {
    if (!apiKey || apiKey.trim().length < 15) {
      return "";
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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
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

  private static async streamGeminiAPI(
    prompt: string,
    mode: AssistantMode,
    profile: CandidateProfile,
    snippet: ScreenSnippet | null,
    apiKey: string,
    callbacks: StreamCallbacks,
    signal: AbortSignal,
    transcriptContext?: string
  ) {
    const systemInstructions = this.buildSystemPrompt(mode, profile);
    const contents: any[] = [];
    const userParts: any[] = [];

    // Inject recent transcript context so the model understands the conversational setup
    if (transcriptContext && transcriptContext.trim().length > 0) {
      userParts.push({
        text: `=== RECENT INTERVIEW CONVERSATION (CONTEXT) ===\n${transcriptContext.slice(-2500)}\n\n=== QUESTION TO ANSWER DIRECTLY ===\n${prompt}`
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

    let lastError: Error | null = null;
    for (const model of this.FLASH_MODELS) {
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
              temperature: 0.25,
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
        return;
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

      const delay = piece === "\n" ? 18 : piece.length > 5 ? 8 : 4;
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
    lines.push("1. DIRECT RELEVANCE: Answer the specific question immediately and concisely. Never give generic filler or dodge the question.");
    lines.push("2. INTERVIEW FORMAT: Structure answers with crisp bullet points, bold key terms, and exact technical explanations that the user can speak comfortably in an interview.");
    lines.push("3. CODE EXAMPLES: When asked for code or SQL, provide clean, idiomatic code with minimal, clear comments.");
    lines.push("4. CANDIDATE PERSONALIZATION: When asked about past experience or behavioral (STAR) questions, strictly ground the answer in the candidate's actual resume projects and metrics.");
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

    // 0. Apache Spark / PySpark / Databricks
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

    // 1. Apache Kafka / Event Streaming
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

    // 2. Snowflake, BigQuery & Data Warehousing
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

    // 3. Database, SQL, Indexing & ACID
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

    // 4. Docker, Kubernetes & Cloud Architecture
    if (p.includes("docker") || p.includes("kubernetes") || p.includes("k8s") || p.includes("container") || p.includes("aws") || p.includes("gcp")) {
      return [
        "⭐ **Cloud-Native Infrastructure & Container Orchestration:**",
        "",
        "• **Container Fundamentals:** Docker packages application code and OS userland dependencies using Linux cgroups (resource limits) and namespaces (isolation).",
        "• **Kubernetes Workload Primitives:** Pods (smallest schedulable unit), Deployments (declarative replica management & zero-downtime rolling updates), Services (ClusterIP/LoadBalancer stable networking).",
        "• **High Availability & Autoscaling:** Horizontal Pod Autoscaler (HPA) driven by CPU/Memory or custom Prometheus metrics; cluster autoscaler scales node pools.",
        "• **Networking & Ingress:** Ingress controllers (Nginx, Envoy) handle TLS termination, path-based routing, and load balancing across microservices."
      ].join("\n");
    }

    // 5. Python & Programming Internals
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

    // 6. Check if the question is asking for an Introduction / Resume Walkthrough / Experience
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

    // 7. Behavioral Questions (STAR Method strictly grounded in resume)
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

    // 8. General Technical Query
    return [
      "⭐ **Key Technical Insights & Solution Overview:**",
      "",
      "• **Core Objective:** When addressing **" + prompt.trim() + "**, the focus must be on production reliability, low latency, and maintainable architecture.",
      "• **Recommended Architecture:** Utilize **" + frameworksList + "** with decoupled compute/storage, automated retries, and comprehensive monitoring.",
      "• **Key Trade-offs:** Balance consistency vs availability, compute cost vs query latency, and memory footprint under high concurrency.",
      "• **Best Practices:** Implement structured logging, automated unit and integration tests, and defensive schema validation."
    ].join("\n");
  }
}
