/**
 * End-of-session scoring for AI-assisted practice interviews.
 *
 * Takes the full transcript + accumulated flags and asks Claude Haiku to
 * evaluate the applicant's overall performance. Returns a structured
 * score (0-100), strengths, improvements, and bilingual summary.
 *
 * Uses Anthropic's tool-use feature for reliable structured JSON output —
 * the model is required to call `submit_score` with a typed payload, no
 * raw text parsing required.
 */

import type { InterviewTurn, Flag, StateCode } from './orchestrator.js';

export type ScoreInput = {
  sessionId: string;
  turns: InterviewTurn[];
  flags: Flag[];
  stateCode: StateCode;
};

export type ScoreResult = {
  overall_score: number;
  strengths: string[];
  improvements: string[];
  summary_en: string;
  summary_es: string;
  engine_version: string;
};

const ENGINE_VERSION = 'claude-haiku-4-5/score-v1';

const SCORE_TOOL = {
  name: 'submit_score',
  description: 'Submit the practice-interview evaluation for the applicant.',
  input_schema: {
    type: 'object',
    properties: {
      overall_score: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Overall preparedness score from 0 (not ready) to 100 (interview-ready).',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        description: '2-4 short bullet points naming what the applicant did well.',
      },
      improvements: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        description: '2-4 short bullet points naming what to work on before the real interview.',
      },
      summary_en: {
        type: 'string',
        description: '1-2 sentence overall summary in English. Warm, encouraging, plain language.',
      },
      summary_es: {
        type: 'string',
        description: 'Same 1-2 sentence summary in Spanish. Warm, encouraging, plain language.',
      },
    },
    required: ['overall_score', 'strengths', 'improvements', 'summary_en', 'summary_es'],
  },
} as const;

function formatTranscript(turns: InterviewTurn[]): string {
  return turns
    .map((t, i) => {
      const lines = [
        `Q${i + 1} (caseworker): ${t.questionText}`,
        `A${i + 1} (applicant): ${t.response ?? '[no response recorded]'}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

function formatFlags(flags: Flag[]): string {
  if (flags.length === 0) return 'No flags raised.';
  return flags.map((f) => `- ${f.type}: ${f.description}`).join('\n');
}

export function buildScorePrompt(input: ScoreInput): { system: string; user: string } {
  const system =
    'You are a compassionate SNAP recertification interview coach evaluating a ' +
    "practice session. Your job is to score the applicant's overall readiness " +
    'for their real interview and give specific, actionable feedback. Be warm, ' +
    'concrete, and encouraging — this is a learning tool, not a gatekeeping ' +
    'tool. Lower scores should still feel constructive. Never mention food ' +
    'insecurity distress directly; focus on interview technique (clarity, ' +
    'completeness, consistency). Score rubric:\n' +
    '  90-100: interview-ready, clear and complete answers across the board\n' +
    '  70-89: solid, minor gaps to polish\n' +
    '  50-69: workable but several answers need elaboration or correction\n' +
    '  30-49: significant gaps; real interview would likely surface follow-ups\n' +
    '  0-29: incomplete or contradictory; needs another practice run\n' +
    'Always call the submit_score tool. Strengths and improvements must be ' +
    'specific to what the applicant actually said — quote or paraphrase, do ' +
    'not give generic advice.';

  const user =
    `State: ${input.stateCode}\n\n` +
    `Transcript:\n${formatTranscript(input.turns)}\n\n` +
    `Flags raised during the session:\n${formatFlags(input.flags)}\n\n` +
    'Evaluate this practice session and submit the score.';

  return { system, user };
}

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
};

export type ScoreFetchOptions = {
  apiKey: string;
  /** Override for tests — defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * Generate a score for a completed practice session.
 * Throws on API errors — caller decides whether to retry or surface.
 */
export async function scoreSession(input: ScoreInput, opts: ScoreFetchOptions): Promise<ScoreResult> {
  const { apiKey, fetchImpl = fetch } = opts;
  const { system, user } = buildScorePrompt(input);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system,
        tools: [SCORE_TOOL],
        tool_choice: { type: 'tool', name: SCORE_TOOL.name },
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Anthropic API error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const toolBlock = data.content?.find(
      (b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> =>
        b.type === 'tool_use' && b.name === SCORE_TOOL.name,
    );
    if (!toolBlock) {
      throw new Error('Anthropic response did not include submit_score tool call');
    }

    const parsed = toolBlock.input as Partial<ScoreResult>;
    if (
      typeof parsed.overall_score !== 'number' ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.improvements) ||
      typeof parsed.summary_en !== 'string' ||
      typeof parsed.summary_es !== 'string'
    ) {
      throw new Error('submit_score payload missing required fields');
    }

    return {
      overall_score: Math.max(0, Math.min(100, Math.round(parsed.overall_score))),
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      summary_en: parsed.summary_en,
      summary_es: parsed.summary_es,
      engine_version: ENGINE_VERSION,
    };
  } finally {
    clearTimeout(timeout);
  }
}
