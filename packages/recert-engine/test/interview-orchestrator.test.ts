import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { start, respond, getSession } from '../src/interview/orchestrator.js';
import { getQuestionsForState } from '../src/interview/questions.js';

const PACKET_SNAPSHOT = { packet_id: 'test-packet-001', state_code: 'CA' };

describe('start()', () => {
  it('returns a sessionId and the first question', () => {
    const result = start({ recertId: 'recert-001', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    expect(typeof result.sessionId).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(result.firstQuestion.questionId).toBe('ca-q1');
    expect(typeof result.firstQuestion.questionText).toBe('string');
    expect(result.firstQuestion.questionText.length).toBeGreaterThan(0);
  });

  it('first question for CA matches the address question', () => {
    const result = start({ recertId: 'recert-002', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    expect(result.firstQuestion.questionText).toContain('address');
  });

  it('first question for MA uses DTA terminology', () => {
    const result = start({ recertId: 'recert-ma-001', packetSnapshot: PACKET_SNAPSHOT, state: 'MA' });
    expect(result.firstQuestion.questionId).toBe('ma-q1');
    expect(result.firstQuestion.questionText).toContain('DTA');
  });

  it('creates a session retrievable by sessionId', () => {
    const result = start({ recertId: 'recert-003', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const session = getSession(result.sessionId);
    expect(session).toBeDefined();
    expect(session?.recertId).toBe('recert-003');
    expect(session?.done).toBe(false);
  });
});

describe('respond()', () => {
  it('advances to the next question on a benign response', async () => {
    const { sessionId } = start({ recertId: 'r-adv', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const result = await respond({ sessionId, userMessage: 'No, nothing has changed.' });
    expect(result.done).toBe(false);
    expect(result.turn.questionId).toBe('ca-q2');
    expect(result.flags).toHaveLength(0);
    expect(result.coaching).toBeNull();
  });

  it('raises a flag when userMessage contains a flagTrigger keyword', async () => {
    const { sessionId } = start({ recertId: 'r-flag', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    // Q1 (address) has "moved" as a flagTrigger
    const result = await respond({ sessionId, userMessage: 'Yes, I moved to a new apartment.' });
    expect(result.flags.length).toBeGreaterThan(0);
    const flagTypes = result.flags.map((f) => f.type);
    expect(flagTypes).toContain('address');
  });

  it('flag match is case-insensitive', async () => {
    const { sessionId } = start({ recertId: 'r-ci', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    // "MOVED" should still trigger the flag for "moved"
    const result = await respond({ sessionId, userMessage: 'Yes I MOVED last month.' });
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('no flags raised when response has no trigger keywords', async () => {
    const { sessionId } = start({ recertId: 'r-noflag', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const result = await respond({ sessionId, userMessage: 'No changes at all.' });
    expect(result.flags).toHaveLength(0);
  });

  it('sets done=true after the last question is answered', async () => {
    const { sessionId } = start({ recertId: 'r-done', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const questions = getQuestionsForState('CA');

    let lastResult = await respond({ sessionId, userMessage: 'No.' });
    for (let i = 1; i < questions.length - 1; i++) {
      lastResult = await respond({ sessionId, userMessage: 'No changes.' });
    }
    // Final question
    lastResult = await respond({ sessionId, userMessage: 'No questions.' });

    expect(lastResult.done).toBe(true);
    expect(lastResult.coaching).toBeNull(); // coaching is null when done
  });

  it('throws for an unknown sessionId', async () => {
    await expect(respond({ sessionId: 'nonexistent-session', userMessage: 'hi' })).rejects.toThrow();
  });

  it('throws if session is already done', async () => {
    const { sessionId } = start({ recertId: 'r-already-done', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const questions = getQuestionsForState('CA');
    for (let i = 0; i < questions.length; i++) {
      await respond({ sessionId, userMessage: 'No.' });
    }
    await expect(respond({ sessionId, userMessage: 'extra' })).rejects.toThrow();
  });
});

describe('respond() — AI coaching', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns coaching string when fetch succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'Great answer! Try to be even more specific about dates.' }],
      }),
    }));

    const { sessionId } = start({ recertId: 'r-ai-ok', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const result = await respond({
      sessionId,
      userMessage: 'My address has not changed.',
      anthropicApiKey: 'test-api-key',
    });

    expect(result.coaching).toBe('Great answer! Try to be even more specific about dates.');
  });

  it('returns coaching=null when fetch throws (graceful degradation)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { sessionId } = start({ recertId: 'r-ai-fail', packetSnapshot: PACKET_SNAPSHOT, state: 'CA' });
    const result = await respond({
      sessionId,
      userMessage: 'My address has not changed.',
      anthropicApiKey: 'test-api-key',
    });

    expect(result.coaching).toBeNull();
    expect(result.done).toBe(false); // interview still advances normally
    expect(typeof result.turn.questionId).toBe('string');
  });
});
