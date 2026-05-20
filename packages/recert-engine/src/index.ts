export * from './outreach/index.js';

// Recertification engine — deadline estimation and interview orchestration (T11)
import * as deadline from './deadline.js';
import * as interview from './interview/orchestrator.js';
import * as scorer from './interview/scorer.js';

export { deadline, interview, scorer };
export type { DeadlineEstimate, DeadlineEstimateInput, HouseholdType, ReminderSchedule, StateCode as DeadlineStateCode } from './deadline.js';
export { getQuestionsForState } from './interview/questions.js';
export type { InterviewQuestion, StateCode } from './interview/questions.js';
export type { InterviewTurn, Flag, StartInput, StartResult, RespondInput, RespondResult, PacketSnapshot } from './interview/orchestrator.js';
export type { ScoreInput, ScoreResult, ScoreFetchOptions } from './interview/scorer.js';

export const recertEngine = { deadline, interview, scorer };
