import { describe, it, expect } from 'vitest';
import { AIEngine } from '../../services/aiEngine';
import type { CandidateProfile } from '../../types';

describe('aiEngine service', () => {
  const mockProfile: CandidateProfile = {
    name: 'Alex Morgan',
    targetRole: 'Senior Data Engineer',
    yearsExp: '8+ years',
    primaryLanguages: ['Python', 'SQL', 'PySpark'],
    frameworks: ['Databricks', 'Apache Spark', 'Kafka', 'Snowflake', 'AWS', 'dbt'],
    keyProjects: 'Architected high-scale streaming platform',
    customGuidelines: '',
  };

  describe('normalizeConfig', () => {
    it('returns gemini-3.8-flash default when no config is provided', () => {
      const cfg = AIEngine.normalizeConfig();
      expect(cfg.provider).toBe('gemini');
      expect(cfg.model).toBe('gemini-3.8-flash');
      expect(cfg.apiKey).toBe('');
    });

    it('auto-detects Claude API keys (sk-ant-)', () => {
      const cfg = AIEngine.normalizeConfig('sk-ant-1234567890');
      expect(cfg.provider).toBe('claude');
      expect(cfg.model).toContain('claude');
      expect(cfg.apiKey).toBe('sk-ant-1234567890');
    });

    it('auto-detects OpenAI API keys (sk-)', () => {
      const cfg = AIEngine.normalizeConfig('sk-abcdefghijk');
      expect(cfg.provider).toBe('openai');
      expect(cfg.model).toBe('gpt-4o');
      expect(cfg.apiKey).toBe('sk-abcdefghijk');
    });

    it('auto-detects Perplexity API keys (pplx-)', () => {
      const cfg = AIEngine.normalizeConfig('pplx-abcdefghijk');
      expect(cfg.provider).toBe('perplexity');
      expect(cfg.model).toBe('sonar');
      expect(cfg.apiKey).toBe('pplx-abcdefghijk');
    });

    it('auto-migrates deprecated 404 models (gemini-2.5-flash, gemini-2.0, gemini-1.5) to gemini-3.8-flash', () => {
      const cfg25 = AIEngine.normalizeConfig({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.5-flash' });
      expect(cfg25.model).toBe('gemini-3.8-flash');

      const cfg20 = AIEngine.normalizeConfig({ provider: 'gemini', apiKey: 'test', model: 'gemini-2.0-flash' });
      expect(cfg20.model).toBe('gemini-3.8-flash');

      const cfg15 = AIEngine.normalizeConfig({ provider: 'gemini', apiKey: 'test', model: 'gemini-1.5-flash' });
      expect(cfg15.model).toBe('gemini-3.8-flash');
    });
  });

  describe('generateLocalSynthesis', () => {
    // Access private static via reflection
    const callLocalSynthesis = (prompt: string, mode: any = 'coding') => {
      return (AIEngine as any).generateLocalSynthesis(prompt, mode, mockProfile, null);
    };

    it('synthesizes technical concept: Binary Tree / BST', () => {
      const response = callLocalSynthesis('Explain binary tree and bst traversals');
      expect(response).toContain('Binary Tree & Binary Search Tree');
      expect(response).toContain('In-Order');
      expect(response).toContain('O(log N)');
    });

    it('synthesizes technical concept: Linked List Cycle Detection', () => {
      const response = callLocalSynthesis('how does cycle detection work in a linked list?');
      expect(response).toContain('Linked List');
      expect(response).toContain("Floyd's Tortoise & Hare");
      expect(response).toContain('`O(1)` space complexity');
    });

    it('synthesizes technical concept: Hash Map Internals', () => {
      const response = callLocalSynthesis('Explain hash map collision resolution strategies');
      expect(response).toContain('Hash Map & Hash Table Internals');
      expect(response).toContain('Chaining');
      expect(response).toContain('Open Addressing');
    });

    it('synthesizes technical concept: Apache Spark Shuffle Spill', () => {
      const response = callLocalSynthesis('How do you troubleshoot shuffle spill in Spark?');
      expect(response).toContain('Apache Spark & Databricks — Core Architecture');
      expect(response).toContain('Shuffle Spill');
      expect(response).toContain('Data Skew');
    });

    it('synthesizes technical concept: Kafka Consumer Groups', () => {
      const response = callLocalSynthesis('How do kafka consumer groups and partition assignment work?');
      expect(response).toContain('Apache Kafka & Distributed Streaming Architecture');
      expect(response).toContain('Topic & Partition Design');
      expect(response).toContain('Consumer Lag');
    });

    it('synthesizes technical concept: SQL Indexing & ACID', () => {
      const response = callLocalSynthesis('Explain B-Tree indexing and ACID properties in SQL databases');
      expect(response).toContain('Database Design, SQL Performance & Storage Engines');
      expect(response).toContain('ACID Guarantees');
      expect(response).toContain('B+ Trees');
    });

    it('synthesizes technical concept: CAP Theorem', () => {
      const response = callLocalSynthesis('Compare CAP theorem and eventual consistency');
      expect(response).toContain('CAP Theorem — Distributed Systems Trade-off');
      expect(response).toContain('Consistency');
      expect(response).toContain('Partition Tolerance');
    });

    it('does NOT trigger elevator pitch when technical question contains "what do you do"', () => {
      const response = callLocalSynthesis('What do you do if a database query is slow?');
      // Must NOT be the elevator pitch!
      expect(response).not.toContain('The 60-Second Elevator Pitch');
      expect(response).not.toContain("Hi, thanks for having me! I'm");
    });

    it('does NOT trigger elevator pitch when technical question contains "your experience"', () => {
      const response = callLocalSynthesis('In your experience with Spark, how do you handle data skew?');
      expect(response).not.toContain('The 60-Second Elevator Pitch');
      expect(response).toContain('Apache Spark');
    });

    it('returns personalized elevator pitch when explicitly asked to introduce yourself', () => {
      const response = callLocalSynthesis('Tell me about yourself');
      expect(response).toContain('The 60-Second Elevator Pitch');
      expect(response).toContain('Alex Morgan');
      expect(response).toContain('Senior Data Engineer');
    });

    it('returns STAR framework for behavioral interview questions', () => {
      const response = callLocalSynthesis('Tell me about a time you had a technical disagreement with a team member', 'behavioral');
      expect(response).toContain('STAR Framework');
      expect(response).toContain('Situation:');
      expect(response).toContain('Task:');
      expect(response).toContain('Action:');
      expect(response).toContain('Result:');
    });
  });
});
