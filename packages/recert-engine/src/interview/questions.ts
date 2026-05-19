/**
 * Static question bank for recertification interviews, keyed by state.
 *
 * flagTriggers: keywords that, when found in a user's response, should
 * raise a review flag for navigator attention.
 */

export type StateCode = 'CA' | 'MA';

export type InterviewQuestion = {
  id: string;
  text: string;
  topic: string;
  flagTriggers: string[];
};

// ---------------------------------------------------------------------------
// California (CalFresh) question bank
// ---------------------------------------------------------------------------

const CA_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'ca-q1',
    text: 'Has your address changed since your last certification?',
    topic: 'address',
    flagTriggers: ['moved', 'new address', 'relocated', 'different address', 'homeless', 'shelter'],
  },
  {
    id: 'ca-q2',
    text: 'Has anyone moved in or out of your household?',
    topic: 'household_composition',
    flagTriggers: ['moved in', 'moved out', 'new person', 'left', 'separated', 'divorced', 'baby', 'newborn', 'passed away', 'died'],
  },
  {
    id: 'ca-q3',
    text: 'Are you still working at the same job(s) you reported last time?',
    topic: 'employment',
    flagTriggers: ['quit', 'fired', 'laid off', 'new job', 'changed jobs', 'lost job', 'no longer work', 'stopped working'],
  },
  {
    id: 'ca-q4',
    text: 'Has your income changed — gone up, down, or stopped?',
    topic: 'income_change',
    flagTriggers: ['raise', 'pay cut', 'reduced', 'stopped', 'no income', 'less', 'more', 'overtime', 'reduced hours'],
  },
  {
    id: 'ca-q5',
    text: 'Do you have any new sources of income we should know about?',
    topic: 'new_income',
    flagTriggers: ['new job', 'freelance', 'self-employed', 'side job', 'gig', 'inheritance', 'gift', 'disability', 'pension', 'rental income'],
  },
  {
    id: 'ca-q6',
    text: 'Have your utility or housing costs changed?',
    topic: 'expenses',
    flagTriggers: ['rent increase', 'eviction', 'utility shutoff', 'higher rent', 'moved', 'new landlord', 'new lease'],
  },
  {
    id: 'ca-q7',
    text: 'Do you have any vehicles, bank accounts, or other assets that have changed?',
    topic: 'assets',
    flagTriggers: ['new car', 'bought vehicle', 'sold', 'new account', 'inheritance', 'settlement', 'lottery', 'large deposit'],
  },
  {
    id: 'ca-q8',
    text: 'Are you or anyone in your household a student?',
    topic: 'student_status',
    flagTriggers: ['enrolled', 'college', 'university', 'student', 'full time', 'part time', 'graduated', 'dropped out'],
  },
  {
    id: 'ca-q9',
    text: 'Is anyone in your household subject to work requirements?',
    topic: 'work_requirements',
    flagTriggers: ['work requirement', 'abawd', 'able-bodied', 'job search', 'training program', 'volunteer', 'exempt'],
  },
  {
    id: 'ca-q10',
    text: 'Do you have any questions about what documents you need to bring to your interview?',
    topic: 'documents',
    flagTriggers: ['missing', 'lost', 'no id', 'no proof', 'cannot find', 'need help', 'what documents'],
  },
];

// ---------------------------------------------------------------------------
// Massachusetts (DTA — Department of Transitional Assistance) question bank
// Mirrors CA questions with DTA-appropriate terminology.
// ---------------------------------------------------------------------------

const MA_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'ma-q1',
    text: 'Has your address changed since your last certification with DTA?',
    topic: 'address',
    flagTriggers: ['moved', 'new address', 'relocated', 'different address', 'homeless', 'shelter'],
  },
  {
    id: 'ma-q2',
    text: 'Has anyone moved in or out of your household?',
    topic: 'household_composition',
    flagTriggers: ['moved in', 'moved out', 'new person', 'left', 'separated', 'divorced', 'baby', 'newborn', 'passed away', 'died'],
  },
  {
    id: 'ma-q3',
    text: 'Are you still working at the same job(s) you reported to DTA last time?',
    topic: 'employment',
    flagTriggers: ['quit', 'fired', 'laid off', 'new job', 'changed jobs', 'lost job', 'no longer work', 'stopped working'],
  },
  {
    id: 'ma-q4',
    text: 'Has your income changed — gone up, down, or stopped?',
    topic: 'income_change',
    flagTriggers: ['raise', 'pay cut', 'reduced', 'stopped', 'no income', 'less', 'more', 'overtime', 'reduced hours'],
  },
  {
    id: 'ma-q5',
    text: 'Do you have any new sources of income DTA should know about?',
    topic: 'new_income',
    flagTriggers: ['new job', 'freelance', 'self-employed', 'side job', 'gig', 'inheritance', 'gift', 'disability', 'pension', 'rental income'],
  },
  {
    id: 'ma-q6',
    text: 'Have your utility or housing costs changed?',
    topic: 'expenses',
    flagTriggers: ['rent increase', 'eviction', 'utility shutoff', 'higher rent', 'moved', 'new landlord', 'new lease'],
  },
  {
    id: 'ma-q7',
    text: 'Do you have any vehicles, bank accounts, or other assets that have changed?',
    topic: 'assets',
    flagTriggers: ['new car', 'bought vehicle', 'sold', 'new account', 'inheritance', 'settlement', 'lottery', 'large deposit'],
  },
  {
    id: 'ma-q8',
    text: 'Are you or anyone in your household enrolled as a student?',
    topic: 'student_status',
    flagTriggers: ['enrolled', 'college', 'university', 'student', 'full time', 'part time', 'graduated', 'dropped out'],
  },
  {
    id: 'ma-q9',
    text: 'Is anyone in your household subject to DTA work requirements?',
    topic: 'work_requirements',
    flagTriggers: ['work requirement', 'abawd', 'able-bodied', 'job search', 'training program', 'volunteer', 'exempt'],
  },
  {
    id: 'ma-q10',
    text: 'Do you have any questions about the documents you need to bring to your DTA interview?',
    topic: 'documents',
    flagTriggers: ['missing', 'lost', 'no id', 'no proof', 'cannot find', 'need help', 'what documents'],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getQuestionsForState(state: StateCode): InterviewQuestion[] {
  return state === 'CA' ? CA_QUESTIONS : MA_QUESTIONS;
}
