/**
 * Recertification interview orchestrator.
 *
 * This module runs the interview entirely in-memory using the static question bank.
 * AI coaching (Anthropic API) is gated behind `anthropicApiKey` being passed to
 * `respond()` — only provided when RECERT_AI_ENABLED="true" in the Worker env.
 *
 * Sessions are kept in a module-level Map for the duration of the Worker process.
 * Production persistence (DB-backed sessions) will be added in a future PR.
 */

import { getQuestionsForState } from './questions.js';
import type { StateCode, InterviewQuestion } from './questions.js';
import { personalizeQuestions } from './personalizer.js';
import type { PacketSnapshot } from './personalizer.js';

export type { StateCode, InterviewQuestion };

export type InterviewTurn = {
  questionId: string;
  questionText: string;
  response?: string;
};

export type Flag = {
  type: string;
  description: string;
};

export type { PacketSnapshot };

export type StartInput = {
  recertId: string;
  packetSnapshot: PacketSnapshot;
  state: StateCode;
};

export type StartResult = {
  sessionId: string;
  firstQuestion: InterviewTurn;
};

export type RespondInput = {
  sessionId: string;
  userMessage: string;
  /**
   * Optional voice-input duration in bytes (captured on-device by the iOS
   * voice intake service). When present, surfaced to the AI coach as a
   * "stuck vs confident" signal — long durations often indicate hesitation.
   */
  audioBytesDuration?: number;
  /** If provided + RECERT_AI_ENABLED, generates per-turn coaching via Claude Haiku. */
  anthropicApiKey?: string;
};

export type RespondResult = {
  turn: InterviewTurn;
  flags: Flag[];
  done: boolean;
  /** AI coaching tip, null when AI disabled or session done. */
  coaching: string | null;
};

// ---------------------------------------------------------------------------
// In-memory session store (stub only)
// ---------------------------------------------------------------------------

type SessionState = {
  recertId: string;
  state: StateCode;
  questions: InterviewQuestion[];
  currentIndex: number;
  turns: InterviewTurn[];
  flags: Flag[];
  done: boolean;
};

const sessions = new Map<string, SessionState>();

// ---------------------------------------------------------------------------
// AI coaching helper
// ---------------------------------------------------------------------------

/**
 * Calls the Anthropic Messages API for a brief coaching tip.
 * Returns null on any error — coaching is best-effort and never blocks the interview.
 */
async function fetchCoaching(
  apiKey: string,
  questionText: string,
  userMessage: string,
  audioBytesDuration?: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system:
          'You are a compassionate SNAP recertification interview coach. The applicant ' +
          'is practicing for their government benefits interview. After each answer, ' +
          'give ONE brief coaching tip (1-2 sentences max) to help them answer more ' +
          'clearly or confidently in their real interview. Be warm and encouraging. ' +
          'If the answer is already strong, affirm it briefly. Never mention food ' +
          'insecurity distress directly — focus only on interview technique.',
        messages: [
          {
            role: 'user',
            content:
              `Interview question: "${questionText}"\n` +
              `Applicant's answer: "${userMessage}"\n` +
              (audioBytesDuration !== undefined
                ? `Voice-input duration (bytes): ${audioBytesDuration} — long durations may indicate hesitation; short, fluent answers may indicate confidence. Use as a soft signal only.\n`
                : '') +
              '\nGive a brief coaching tip.',
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: Array<{ type: string; text: string }>;
    };

    const text = data?.content?.find((b) => b.type === 'text')?.text ?? null;
    return text ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new practice interview session.
 * Returns the sessionId and the first question.
 */
export function start(input: StartInput): StartResult {
  const { recertId, state, packetSnapshot } = input;
  const sessionId = crypto.randomUUID();
  const questions = getQuestionsForState(state);
  const personalizedQuestions = personalizeQuestions(questions, packetSnapshot);

  const session: SessionState = {
    recertId,
    state,
    questions: personalizedQuestions,
    currentIndex: 0,
    turns: [],
    flags: [],
    done: false,
  };

  sessions.set(sessionId, session);

  const first = personalizedQuestions[0];
  if (!first) throw new Error('Question bank is empty for state: ' + state);
  const firstQuestion: InterviewTurn = {
    questionId: first.id,
    questionText: first.text,
  };

  return { sessionId, firstQuestion };
}

/**
 * Submit a response to the current question and advance the interview.
 * Checks flagTriggers on the current question against userMessage.
 * If `anthropicApiKey` is provided, generates per-turn AI coaching (best-effort).
 */
export async function respond(input: RespondInput): Promise<RespondResult> {
  const { sessionId, userMessage, audioBytesDuration, anthropicApiKey } = input;
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  if (session.done) {
    throw new Error(`Session already completed: ${sessionId}`);
  }

  const currentQuestion = session.questions[session.currentIndex];
  if (!currentQuestion) throw new Error(`No question at index ${session.currentIndex}`);

  // Record the response on the current turn
  const respondedTurn: InterviewTurn = {
    questionId: currentQuestion.id,
    questionText: currentQuestion.text,
    response: userMessage,
  };
  session.turns.push(respondedTurn);

  // Check flagTriggers — case-insensitive substring match
  const lowerMessage = userMessage.toLowerCase();
  const newFlags: Flag[] = [];
  for (const trigger of currentQuestion.flagTriggers) {
    if (lowerMessage.includes(trigger.toLowerCase())) {
      newFlags.push({
        type: currentQuestion.topic,
        description: `Response to "${currentQuestion.text}" matched flag trigger: "${trigger}"`,
      });
    }
  }
  session.flags.push(...newFlags);

  // Advance to next question
  session.currentIndex += 1;
  const done = session.currentIndex >= session.questions.length;
  session.done = done;

  let turn: InterviewTurn;
  if (done) {
    // Session complete — return the last responded turn with done=true
    turn = respondedTurn;
  } else {
    const nextQuestion = session.questions[session.currentIndex];
    if (!nextQuestion) throw new Error(`No question at index ${session.currentIndex}`);
    turn = {
      questionId: nextQuestion.id,
      questionText: nextQuestion.text,
    };
  }

  // AI coaching — best-effort, never blocking, null when session is done
  let coaching: string | null = null;
  if (!done && anthropicApiKey) {
    coaching = await fetchCoaching(anthropicApiKey, currentQuestion.text, userMessage, audioBytesDuration);
  }

  return { turn, flags: newFlags, done, coaching };
}

/**
 * Retrieve current session state without advancing it.
 */
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

/**
 * Read the recorded turns + accumulated flags for a session.
 * Used by the scorer to build a transcript for end-of-session evaluation.
 * Returns undefined when the in-memory session is gone (e.g. Worker restart).
 */
export function getTranscript(sessionId: string): { turns: InterviewTurn[]; flags: Flag[]; state: StateCode } | undefined {
  const s = sessions.get(sessionId);
  if (!s) return undefined;
  return { turns: s.turns, flags: s.flags, state: s.state };
}
