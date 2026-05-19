import { describe, it, expect } from 'vitest';
import { personalizeQuestions } from '../src/interview/personalizer.js';
import type { PacketSnapshot } from '../src/interview/personalizer.js';
import { getQuestionsForState } from '../src/interview/questions.js';
import type { InterviewQuestion } from '../src/interview/questions.js';

const CA_QUESTIONS = getQuestionsForState('CA');

// Helper to find a question by topic
function byTopic(questions: InterviewQuestion[], topic: string): InterviewQuestion | undefined {
  return questions.find((q) => q.topic === topic);
}

describe('personalizeQuestions()', () => {
  it('returns original questions unchanged when snapshot has no personalizing data', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA' };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(result).toHaveLength(CA_QUESTIONS.length);
    for (let i = 0; i < CA_QUESTIONS.length; i++) {
      expect(result[i]?.text).toBe(CA_QUESTIONS[i]?.text);
    }
  });

  it('replaces employment text when employer_count >= 2', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', employer_count: 2, is_employed: true };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    const employment = byTopic(result, 'employment');
    expect(employment).toBeDefined();
    expect(employment?.text).toBe('Are you still working at both jobs you reported last time?');
  });

  it('replaces employment text when is_employed is false', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', is_employed: false };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    const employment = byTopic(result, 'employment');
    expect(employment).toBeDefined();
    expect(employment?.text).toBe('Have you found any employment since your last certification?');
  });

  it('prefers employer_count replacement over is_employed=false when both are set', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', employer_count: 3, is_employed: false };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    const employment = byTopic(result, 'employment');
    // employer_count >= 2 branch runs first
    expect(employment?.text).toBe('Are you still working at both jobs you reported last time?');
  });

  it('replaces income_change text when income_source_count >= 2', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', income_source_count: 3 };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    const incomeQ = byTopic(result, 'income_change');
    expect(incomeQ).toBeDefined();
    expect(incomeQ?.text).toBe(
      'Have any of your 3 income sources changed — gone up, down, or stopped?',
    );
  });

  it('removes student_status question when has_students is false', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', has_students: false };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'student_status')).toBeUndefined();
    // All other questions still present
    expect(result.length).toBe(CA_QUESTIONS.length - 1);
  });

  it('keeps student_status question when has_students is true', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', has_students: true };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'student_status')).toBeDefined();
  });

  it('removes work_requirements question when is_subject_to_work_requirements is false', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', is_subject_to_work_requirements: false };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'work_requirements')).toBeUndefined();
  });

  it('removes assets question when both has_vehicles and has_bank_accounts are false', () => {
    const snapshot: PacketSnapshot = {
      state_code: 'CA',
      has_vehicles: false,
      has_bank_accounts: false,
    };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'assets')).toBeUndefined();
  });

  it('keeps assets question when has_vehicles is true even if has_bank_accounts is false', () => {
    const snapshot: PacketSnapshot = {
      state_code: 'CA',
      has_vehicles: true,
      has_bank_accounts: false,
    };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'assets')).toBeDefined();
  });

  it('can remove multiple irrelevant questions at once', () => {
    const snapshot: PacketSnapshot = {
      state_code: 'CA',
      has_students: false,
      is_subject_to_work_requirements: false,
      has_vehicles: false,
      has_bank_accounts: false,
    };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    expect(byTopic(result, 'student_status')).toBeUndefined();
    expect(byTopic(result, 'work_requirements')).toBeUndefined();
    expect(byTopic(result, 'assets')).toBeUndefined();
    expect(result.length).toBe(CA_QUESTIONS.length - 3);
  });

  it('preserves question ids and flagTriggers when personalizing text', () => {
    const snapshot: PacketSnapshot = { state_code: 'CA', employer_count: 2 };
    const result = personalizeQuestions(CA_QUESTIONS, snapshot);
    const employment = byTopic(result, 'employment');
    const original = byTopic(CA_QUESTIONS, 'employment');
    expect(employment?.id).toBe(original?.id);
    expect(employment?.flagTriggers).toEqual(original?.flagTriggers);
  });
});
