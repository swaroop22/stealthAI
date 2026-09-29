import { describe, it, expect } from "vitest";
import { ResumeParser } from "../../services/resumeParser";

describe("ResumeParser service", () => {
  const sampleResume = `
John Doe
johndoe@example.com | (555) 123-4567 | San Francisco, CA

Senior Software Engineer with 8+ years of experience in distributed systems.

TECHNICAL SKILLS:
Languages: Python, Go, TypeScript, SQL, Java
Frameworks & Tools: React, Docker, Kubernetes, Kafka, PostgreSQL, Redis, AWS

PROFESSIONAL EXPERIENCE:
Senior Software Engineer at Stripe (2018 - Present)
• Architected payment processing microservices reducing p99 latency by 45%.
• Scaled event-driven distributed streaming pipelines handling 50 million events daily.
• Optimized PostgreSQL query performance and cut cloud infrastructure costs by $120,000 annually.

Software Engineer at Uber (2016 - 2018)
• Spearheaded migration from monolithic Ruby service to Go microservices.
• Increased system throughput by 3x while maintaining 99.99% availability.
`;

  it("extracts candidate name accurately from the header", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume, "john_doe_resume.pdf");
    expect(profile.name).toBe("John Doe");
    expect(profile.resumeFileName).toBe("john_doe_resume.pdf");
  });

  it("extracts target role accurately", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.targetRole).toBe("Senior Software Engineer");
  });

  it("extracts known programming languages", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.primaryLanguages).toContain("Python");
    expect(profile.primaryLanguages).toContain("Go");
    expect(profile.primaryLanguages).toContain("TypeScript");
    expect(profile.primaryLanguages).toContain("SQL");
    expect(profile.primaryLanguages).toContain("Java");
  });

  it("extracts known frameworks and technologies", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.frameworks).toContain("React");
    expect(profile.frameworks).toContain("Docker");
    expect(profile.frameworks).toContain("Kubernetes");
    expect(profile.frameworks).toContain("Kafka");
    expect(profile.frameworks).toContain("PostgreSQL");
    expect(profile.frameworks).toContain("Redis");
    expect(profile.frameworks).toContain("AWS");
  });

  it("extracts explicit years of experience", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.yearsExp).toBe("8+ years");
  });

  it("derives years of experience from earliest graduation or work year when explicit yoe is absent", () => {
    const resumeWithoutExplicitYOE = `
Jane Smith
Staff Software Engineer
Experience at Google from 2015 to Present.
Specialized in Python and React.
`;
    const profile = ResumeParser.analyzeResumeText(resumeWithoutExplicitYOE);
    const currentYear = new Date().getFullYear();
    const expectedYOE = `${currentYear - 2015}+ years`;
    expect(profile.yearsExp).toBe(expectedYOE);
  });

  it("extracts key metrics and quantified achievements", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.keyMetrics).toBeDefined();
    expect(profile.keyMetrics!.length).toBeGreaterThan(0);
    const metricsJoined = profile.keyMetrics!.join(" ");
    expect(metricsJoined).toMatch(/latency|million|\$120,000|throughput/i);
  });

  it("extracts past companies", () => {
    const profile = ResumeParser.analyzeResumeText(sampleResume);
    expect(profile.pastCompanies).toBeDefined();
    expect(profile.pastCompanies).toContain("Stripe");
  });

  it("falls back to safe defaults when parsing minimal or unstructured text", () => {
    const minimalText = "Resume Header Page 1";
    const profile = ResumeParser.analyzeResumeText(minimalText);
    expect(profile.name).toBe("Candidate");
    expect(profile.targetRole).toBe("Senior Software Engineer");
    expect(profile.primaryLanguages.length).toBeGreaterThan(0);
    expect(profile.frameworks.length).toBeGreaterThan(0);
  });

  it("parseFile throws descriptive error when text content is empty", async () => {
    const emptyFile = new File(["   "], "empty.txt", { type: "text/plain" });
    await expect(ResumeParser.parseFile(emptyFile)).rejects.toThrow(
      "Could not extract text from the file"
    );
  });

  it("parseFile parses valid plain text resume file successfully", async () => {
    const validFile = new File([sampleResume], "resume.txt", { type: "text/plain" });
    const result = await ResumeParser.parseFile(validFile);
    expect(result.profile.name).toBe("John Doe");
    expect(result.rawText).toContain("Senior Software Engineer");
  });
});
