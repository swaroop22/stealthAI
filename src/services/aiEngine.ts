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

  private static readonly FLASH_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
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

    // Introduction / Resume Walkthrough
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
