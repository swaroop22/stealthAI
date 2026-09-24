import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { CandidateProfile } from "../types";

// Configure worker for pdfjs
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
} catch (e) {
  console.warn("Could not set pdfjs workerSrc:", e);
}

export class ResumeParser {
  private static KNOWN_LANGUAGES = [
    "JavaScript", "TypeScript", "Python", "Java", "Go", "Golang", "C++", "C#",
    "Rust", "Kotlin", "Swift", "SQL", "Ruby", "PHP", "Scala", "R", "Bash", "Shell", "C"
  ];

  private static KNOWN_FRAMEWORKS = [
    "React", "Next.js", "Node.js", "Express", "Spring Boot", "FastAPI", "Django",
    "Flask", "NestJS", "Vue", "Angular", "Docker", "Kubernetes", "AWS", "GCP",
    "Azure", "Kafka", "RabbitMQ", "Redis", "PostgreSQL", "MySQL", "MongoDB",
    "DynamoDB", "Elasticsearch", "GraphQL", "REST", "gRPC", "Terraform", "CI/CD",
    "Airflow", "Spark", "Databricks", "Snowflake", "BigQuery", "S3", "EKS", "ECS", "Lambda"
  ];

  public static async parseFile(file: File): Promise<{ profile: CandidateProfile; rawText: string }> {
    let rawText = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        rawText = await this.extractPdfWithPdfJs(file);
      } catch (pdfErr) {
        console.warn("pdfjs-dist extraction failed, falling back to binary scan:", pdfErr);
        rawText = await this.fallbackPdfExtract(file);
      }
    } else {
      rawText = await file.text();
    }

    if (!rawText || rawText.trim().length === 0) {
      throw new Error("Could not extract text from the file. Please switch to 'Paste Resume Text' to paste directly.");
    }

    const profile = this.analyzeResumeText(rawText, file.name);
    return { profile, rawText };
  }

  // 1. High-fidelity PDF extraction using pdfjs-dist
  private static async extractPdfWithPdfJs(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
          });

    const pdf = await loadingTask.promise;
    const pagesText: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map((item: any) => item.str || "");
      pagesText.push(strings.join(" "));
    }

    return pagesText.join("\n\n");
  }

  // Fallback binary extractor if worker or pdfjs fails
  private static async fallbackPdfExtract(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryStr = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }

    const textMatches: string[] = [];
    const parenRegex = /\(([^)]+)\)\s*(?:Tj|TJ)/g;
    let match: RegExpExecArray | null;
    while ((match = parenRegex.exec(binaryStr)) !== null) {
      const txt = match[1].trim();
      if (txt.length > 2 && !txt.startsWith("/")) {
        textMatches.push(txt);
      }
    }

    if (textMatches.length > 10) {
      return textMatches.join(" ");
    }

    const asciiStrings: string[] = [];
    const asciiRegex = /[A-Za-z0-9,.:;'"\s-]{4,}/g;
    while ((match = asciiRegex.exec(binaryStr)) !== null) {
      const s = match[0].trim();
      if (!s.startsWith("/") && !s.includes("Font") && !s.includes("Obj")) {
        asciiStrings.push(s);
      }
    }
    return asciiStrings.join("\n");
  }

  // 2. Comprehensive resume analysis & entity extraction
  public static analyzeResumeText(rawText: string, fileName?: string): CandidateProfile {
    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

    // Name Extraction: Scan top 5 lines for a human name (avoiding headers/contact labels)
    let name = "Candidate";
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const candidateLine = lines[i].replace(/[^a-zA-Z\s]/g, "").trim();
      const words = candidateLine.split(/\s+/);
      const lower = candidateLine.toLowerCase();
      if (
        words.length >= 2 &&
        words.length <= 4 &&
        !lower.includes("resume") &&
        !lower.includes("curriculum") &&
        !lower.includes("page") &&
        !lower.includes("email") &&
        !lower.includes("phone")
      ) {
        name = candidateLine;
        break;
      }
    }

    // Role Extraction
    let targetRole = "Senior Software Engineer";
    const roleRegex = /(Staff Software Engineer|Principal Engineer|Senior Software Engineer|Software Engineer|Full Stack Developer|Frontend Engineer|Backend Engineer|Systems Engineer|Data Engineer|DevOps Engineer|Cloud Architect|Engineering Manager|Tech Lead|Solutions Architect)/i;
    const roleMatch = rawText.match(roleRegex);
    if (roleMatch) {
      targetRole = roleMatch[0];
    }

    // Languages Extraction
    const foundLanguages: string[] = [];
    const textLower = rawText.toLowerCase();
    for (const lang of this.KNOWN_LANGUAGES) {
      const regex = new RegExp(`\\b${lang.toLowerCase().replace("+", "\\+")}\\b`, "i");
      if (regex.test(textLower)) {
        foundLanguages.push(lang === "Golang" ? "Go" : lang);
      }
    }

    // Frameworks & Tools Extraction
    const foundFrameworks: string[] = [];
    for (const fw of this.KNOWN_FRAMEWORKS) {
      const regex = new RegExp(`\\b${fw.toLowerCase()}\\b`, "i");
      if (regex.test(textLower)) {
        foundFrameworks.push(fw);
      }
    }

    // Years of Experience Calculation
    let yearsExp = "5+ years";
    const yoeExplicit = rawText.match(/(\d{1,2})\+?\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp)/i);
    if (yoeExplicit) {
      yearsExp = `${yoeExplicit[1]}+ years`;
    } else {
      const yearMatches = rawText.match(/\b(20\d{2})\b/g);
      if (yearMatches && yearMatches.length > 0) {
        const sortedYears = yearMatches.map(Number).sort((a, b) => a - b);
        const earliest = sortedYears[0];
        const currentYear = new Date().getFullYear();
        const diff = Math.max(1, currentYear - earliest);
        if (diff > 0 && diff < 30) {
          yearsExp = `${diff}+ years`;
        }
      }
    }

    // Extract Companies & Experiences
    const pastCompanies: string[] = [];
    const companyRegex = /(?:at|@|company:|experience:)\s+([A-Z][A-Za-z0-9\s&]{2,30})/g;
    let compMatch: RegExpExecArray | null;
    while ((compMatch = companyRegex.exec(rawText)) !== null) {
      const c = compMatch[1].trim();
      if (!c.toLowerCase().includes("present") && !c.toLowerCase().includes("january") && !pastCompanies.includes(c)) {
        pastCompanies.push(c);
      }
    }

    // Extract Quantified Accomplishments & Metrics (percentages, dollar amounts, scaling numbers)
    const sentences = rawText.split(/[.\n•\-]/).map((s) => s.trim()).filter(Boolean);
    const keyMetrics: string[] = [];
    const metricRegex = /(\d+%\s*|p99|\bms\b|latency|throughput|\btps\b|\$\d+|\bmillion\b|\bscalable\b|reduced|increased|optimized|architected|spearheaded|migrated|scaled)/i;

    for (const sentence of sentences) {
      if (sentence.length > 25 && sentence.length < 220 && metricRegex.test(sentence)) {
        keyMetrics.push(sentence);
        if (keyMetrics.length >= 6) break;
      }
    }

    const keyProjects = keyMetrics.length > 0
      ? keyMetrics.slice(0, 3).join("; ")
      : "Designed microservices and distributed data pipelines handling high-throughput production traffic.";

    return {
      name,
      targetRole,
      yearsExp,
      primaryLanguages: foundLanguages.length > 0 ? Array.from(new Set(foundLanguages)) : ["TypeScript", "Python", "Java"],
      frameworks: foundFrameworks.length > 0 ? Array.from(new Set(foundFrameworks)).slice(0, 10) : ["React", "Node.js", "Docker", "PostgreSQL", "Redis"],
      keyProjects,
      customGuidelines: "Personalize all STAR interview responses with quantified metrics and achievements from my actual resume.",
      resumeText: rawText,
      resumeFileName: fileName || "Pasted Resume Text",
      resumeParsedAt: new Date().toISOString(),
      keyMetrics,
      pastCompanies
    };
  }
}
