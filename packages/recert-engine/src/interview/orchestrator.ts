/**
 * Recertification interview orchestrator — STUB implementation.
 *
 * This module runs the interview entirely in-memory using the static question bank.
 * Real AI (Anthropic API) wiring is a separate PR, gated behind RECERT_AI_ENABLED.
 *
 * Sessions are kept in a module-level Map for the duration of the Worker process.
 * Production persistence (DB-backed sessions) will be added alongside AI wiring.
 */

import { getQuestionsForState } from './questions.js';
import type { StateCode, InterviewQuestion } from './questions.js';

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

export type StartInput = {
  recertId: string;
  /** Snapshot of the enrollment packet (unused in stub; passed through for future AI wiring). */
  packetSnapshot: Record<string, unknown>;
  state: StateCode;
};

export type StartResult = {
  sessionId: string;
  firstQuestion: InterviewTurn;
};

export type RespondInput = {
  sessionId: string;
  userMessage: string;
};

export type RespondResult = {
  turn: InterviewTurn;
  flags: Flag[];
  done: boolean;
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Start a new practice interview session.
 * Returns the sessionId and the first question.
 */
export function start(input: StartInput): StartResult {
  const { recertId, state } = input;
  const sessionId = crypto.randomUUID();
  const questions = getQuestionsForState(state);

  const session: SessionState = {
    recertId,
    state,
    questions,
    currentIndex: 0,
    turns: [],
    flags: [],
    done: false,
  };

  sessions.set(sessionId, session);

  const first = questions[0];
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
 */
export function respond(input: RespondInput): RespondResult {
  const { sessionId, userMessage } = input;
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

  return { turn, flags: newFlags, done };
}

/**
 * Retrieve current session state without advancing it.
 */
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}
