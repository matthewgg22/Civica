export * from './outreach/index.js';

// Recertification engine — deadline estimation and interview orchestration (T11)
import * as deadline from './deadline.js';
import * as interview from './interview/orchestrator.js';

export { deadline, interview };
export type { DeadlineEstimate, DeadlineEstimateInput, HouseholdType, ReminderSchedule, StateCode as DeadlineStateCode } from './deadline.js';
export { getQuestionsForState } from './interview/questions.js';
export type { InterviewQuestion, StateCode } from './interview/questions.js';
export type { InterviewTurn, Flag, StartInput, StartResult, RespondInput, RespondResult } from './interview/orchestrator.js';

export const recertEngine = { deadline, interview };
