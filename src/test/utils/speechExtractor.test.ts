import { describe, it, expect } from 'vitest';
import { extractLastQuestionFromSpeech } from '../../utils/speechExtractor';
import type { TranscriptItem } from '../../types';

describe('speechExtractor utils', () => {
  it('extracts an explicit question with a question mark', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:00:00', text: 'Hello Alex, thanks for joining.' },
      { id: '2', speaker: 'Candidate', timestamp: '10:00:15', text: 'Thank you for having me.' },
      { id: '3', speaker: 'Interviewer', timestamp: '10:00:30', text: 'Can you explain the difference between a process and a thread?' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toBe('Can you explain the difference between a process and a thread?');
    expect(result.sourceSpeaker).toBe('Interviewer');
  });

  it('extracts question using question starter regex even if question mark is missing', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:01:00', text: 'what is the time complexity of quicksort in the worst case' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toBe('What is the time complexity of quicksort in the worst case?');
  });

  it('stitches preceding context sentence with the question starter', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:02:00', text: 'In Apache Spark when running on large datasets,' },
      { id: '2', speaker: 'Interviewer', timestamp: '10:02:08', text: 'how do you handle shuffle spill to disk?' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toContain('In Apache Spark when running on large datasets');
    expect(result.question).toContain('how do you handle shuffle spill to disk?');
  });

  it('strips conversational trailing fillers after a question', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:03:00', text: 'How does indexing work in PostgreSQL, take your time and let me know' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toBe('How does indexing work in PostgreSQL?');
  });

  it('skips standalone conversational fillers and finds earlier question', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:04:00', text: 'What is CAP theorem and how does PACELC extend it?' },
      { id: '2', speaker: 'Candidate', timestamp: '10:04:15', text: 'yeah' },
      { id: '3', speaker: 'Interviewer', timestamp: '10:04:20', text: 'okay sure' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toBe('What is CAP theorem and how does PACELC extend it?');
  });

  it('does NOT turn non-question 2-4 word fragments into fake questions', () => {
    // Regression test for the issue where "Different kind of words" was turned into "Different kind of words?"
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:05:00', text: 'thank you very much bye bye' },
      { id: '2', speaker: 'Interviewer', timestamp: '10:05:10', text: 'Working for this restaurant' },
      { id: '3', speaker: 'Interviewer', timestamp: '10:05:20', text: 'Specific keywords' },
      { id: '4', speaker: 'Interviewer', timestamp: '10:05:30', text: 'Different kind of words' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    // Since none of these contain question starters or real technical concepts, no question should be fabricated
    expect(result.question).toBe('');
  });

  it('extracts substantive technical phrases even without explicit question words', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:06:00', text: 'Redis cache stampede mitigation strategy' },
    ];

    const result = extractLastQuestionFromSpeech(transcript);
    expect(result.question).toBe('Redis cache stampede mitigation strategy?');
  });

  it('prioritizes live interim speech if present', () => {
    const transcript: TranscriptItem[] = [
      { id: '1', speaker: 'Interviewer', timestamp: '10:07:00', text: 'What is a binary tree?' },
    ];

    const result = extractLastQuestionFromSpeech(transcript, 'how does cycle detection work in linked lists?');
    expect(result.question).toBe('How does cycle detection work in linked lists?');
    expect(result.sourceSpeaker).toBe('Live Voice');
  });

  it('returns empty string when transcript is empty', () => {
    const result = extractLastQuestionFromSpeech([]);
    expect(result.question).toBe('');
    expect(result.fullTranscriptText).toBe('');
  });
});
