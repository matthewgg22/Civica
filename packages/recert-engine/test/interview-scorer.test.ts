import { describe, it, expect, vi } from 'vitest';
import { scoreSession, buildScorePrompt } from '../src/interview/scorer.js';
import type { InterviewTurn, Flag } from '../src/interview/orchestrator.js';

const SAMPLE_TURNS: InterviewTurn[] = [
  { questionId: 'ca-q1', questionText: 'Has your address changed?', response: 'No, same address.' },
  { questionId: 'ca-q2', questionText: 'Has your income changed?', response: 'I started a new job last month.' },
];

const SAMPLE_FLAGS: Flag[] = [
  { type: 'income', description: 'New job mentioned' },
];

function mockAnthropicResponse(payload: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [
        { type: 'tool_use', id: 'toolu_1', name: 'submit_score', input: payload },
      ],
    }),
  });
}

describe('buildScorePrompt', () => {
  it('includes state, full transcript, and flags', () => {
    const { system, user } = buildScorePrompt({
      sessionId: 's1',
      turns: SAMPLE_TURNS,
      flags: SAMPLE_FLAGS,
      stateCode: 'CA',
    });
    expect(system).toMatch(/SNAP recertification interview coach/i);
    expect(system).toMatch(/Score rubric/);
    expect(user).toContain('State: CA');
    expect(user).toContain('Has your address changed?');
    expect(user).toContain('No, same address.');
    expect(user).toContain('New job mentioned');
  });

  it('formats empty flags cleanly', () => {
    const { user } = buildScorePrompt({
      sessionId: 's1', turns: SAMPLE_TURNS, flags: [], stateCode: 'CA',
    });
    expect(user).toContain('No flags raised.');
  });
});

describe('scoreSession', () => {
  it('parses a happy-path tool_use response', async () => {
    const fetchImpl = mockAnthropicResponse({
      overall_score: 78,
      strengths: ['Clear about address stability', 'Mentioned new job proactively'],
      improvements: ['Add start date for new job', 'Mention pay rate'],
      summary_en: 'Solid practice run; tighten income details before the real interview.',
      summary_es: 'Buena práctica; detalla mejor los ingresos antes de la entrevista real.',
    });

    const result = await scoreSession(
      { sessionId: 's1', turns: SAMPLE_TURNS, flags: SAMPLE_FLAGS, stateCode: 'CA' },
      { apiKey: 'test-key', fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(result.overall_score).toBe(78);
    expect(result.strengths).toHaveLength(2);
    expect(result.improvements).toHaveLength(2);
    expect(result.summary_en).toMatch(/Solid practice/);
    expect(result.summary_es).toMatch(/Buena práctica/);
    expect(result.engine_version).toContain('claude-haiku');
  });

  it('clamps overall_score to 0-100', async () => {
    const fetchImpl = mockAnthropicResponse({
      overall_score: 150,
      strengths: ['a', 'b'],
      improvements: ['c', 'd'],
      summary_en: 'x',
      summary_es: 'y',
    });
    const result = await scoreSession(
      { sessionId: 's1', turns: SAMPLE_TURNS, flags: [], stateCode: 'CA' },
      { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.overall_score).toBe(100);
  });

  it('throws on non-OK Anthropic response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream boom',
    });
    await expect(
      scoreSession(
        { sessionId: 's1', turns: SAMPLE_TURNS, flags: [], stateCode: 'CA' },
        { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/Anthropic API error 500/);
  });

  it('throws when tool_use is missing from response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'I refuse to use the tool' }] }),
    });
    await expect(
      scoreSession(
        { sessionId: 's1', turns: SAMPLE_TURNS, flags: [], stateCode: 'CA' },
        { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/submit_score tool call/);
  });

  it('throws when required fields are missing from tool input', async () => {
    const fetchImpl = mockAnthropicResponse({ overall_score: 80 }); // missing other fields
    await expect(
      scoreSession(
        { sessionId: 's1', turns: SAMPLE_TURNS, flags: [], stateCode: 'CA' },
        { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch },
      ),
    ).rejects.toThrow(/missing required fields/);
  });
});
