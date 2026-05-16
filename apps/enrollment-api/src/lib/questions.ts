export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  section_key: string;
  type: "text" | "number" | "currency" | "date" | "single" | "multi" | "address";
  label: string;
  hint?: string;
  required: boolean;
  distress_prompt?: boolean;
  options: QuestionOption[];
  order: number;
}

export interface QuestionSection {
  key: string;
  label: string;
  questions: Question[];
}

// Core SNAP questions, shared across CA and MA
const CORE_SECTIONS: QuestionSection[] = [
  {
    key: "household",
    label: "Household",
    questions: [
      {
        id: "household_size",
        section_key: "household",
        type: "number",
        label: "How many people live in your household?",
        hint: "Include yourself and anyone you buy and prepare food with.",
        required: true,
        options: [],
        order: 1,
      },
      {
        id: "household_has_children",
        section_key: "household",
        type: "single",
        label: "Does your household include children under 18?",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        order: 2,
      },
      {
        id: "household_has_elderly",
        section_key: "household",
        type: "single",
        label: "Does your household include anyone age 60 or older?",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        order: 3,
      },
      {
        id: "household_has_disabled",
        section_key: "household",
        type: "single",
        label: "Does anyone in your household have a disability?",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
        order: 4,
      },
    ],
  },
  {
    key: "income",
    label: "Income",
    questions: [
      {
        id: "employment_status",
        section_key: "income",
        type: "single",
        label: "What is your current employment status?",
        required: true,
        options: [
          { value: "employed_full_time", label: "Employed full-time" },
          { value: "employed_part_time", label: "Employed part-time" },
          { value: "self_employed", label: "Self-employed" },
          { value: "unemployed", label: "Unemployed" },
          { value: "retired", label: "Retired" },
          { value: "unable_to_work", label: "Unable to work due to disability" },
        ],
        order: 1,
        distress_prompt: true,
      },
      {
        id: "monthly_gross_income",
        section_key: "income",
        type: "currency",
        label: "What is your household's total gross income per month?",
        hint: "Include wages, tips, self-employment income, and any other earnings before taxes.",
        required: true,
        options: [],
        order: 2,
      },
      {
        id: "income_sources",
        section_key: "income",
        type: "multi",
        label: "Which of the following does your household receive?",
        required: false,
        options: [
          { value: "social_security", label: "Social Security" },
          { value: "ssi", label: "SSI (Supplemental Security Income)" },
          { value: "unemployment", label: "Unemployment benefits" },
          { value: "child_support", label: "Child support" },
          { value: "pension", label: "Pension or retirement income" },
          { value: "rental_income", label: "Rental income" },
          { value: "none", label: "None of the above" },
        ],
        order: 3,
      },
    ],
  },
  {
    key: "expenses",
    label: "Expenses",
    questions: [
      {
        id: "monthly_rent_or_mortgage",
        section_key: "expenses",
        type: "currency",
        label: "How much does your household pay monthly for rent or mortgage?",
        required: false,
        options: [],
        order: 1,
      },
      {
        id: "monthly_utilities",
        section_key: "expenses",
        type: "currency",
        label: "Approximately how much do you pay monthly for utilities (electric, gas, water)?",
        required: false,
        options: [],
        order: 2,
      },
      {
        id: "monthly_childcare",
        section_key: "expenses",
        type: "currency",
        label: "How much does your household pay monthly for dependent care (childcare, elder care)?",
        required: false,
        options: [],
        order: 3,
      },
    ],
  },
  {
    key: "residence",
    label: "Residence",
    questions: [
      {
        id: "home_address",
        section_key: "residence",
        type: "address",
        label: "What is your current home address?",
        required: true,
        options: [],
        order: 1,
      },
      {
        id: "housing_situation",
        section_key: "residence",
        type: "single",
        label: "Which best describes your current housing situation?",
        required: true,
        options: [
          { value: "renting", label: "Renting" },
          { value: "own_home", label: "Own my home" },
          { value: "living_with_family", label: "Living with family or friends" },
          { value: "transitional", label: "Transitional or temporary housing" },
          { value: "shelter", label: "Shelter" },
          { value: "unhoused", label: "Unhoused / no fixed address" },
        ],
        order: 2,
      },
    ],
  },
  {
    key: "citizenship",
    label: "Citizenship & Residency",
    questions: [
      {
        id: "citizenship_status",
        section_key: "citizenship",
        type: "single",
        label: "What is your citizenship or immigration status?",
        required: true,
        options: [
          { value: "us_citizen", label: "U.S. citizen or U.S. national" },
          { value: "lawful_permanent_resident", label: "Lawful permanent resident (Green Card holder)" },
          { value: "qualified_noncitizen", label: "Other qualified noncitizen" },
          { value: "prefer_not_to_say", label: "Prefer not to say" },
        ],
        order: 1,
      },
    ],
  },
];

// CA-specific questions appended to income section
const CA_EXTRA: Question[] = [
  {
    id: "ca_calfresh_previously_received",
    section_key: "income",
    type: "single",
    label: "Have you received CalFresh benefits before?",
    required: false,
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    order: 10,
  },
];

export function getQuestionsForState(stateCode: string): QuestionSection[] {
  if (stateCode === "CA") {
    return CORE_SECTIONS.map((section) => {
      if (section.key !== "income") return section;
      return {
        ...section,
        questions: [...section.questions, ...CA_EXTRA].sort((a, b) => a.order - b.order),
      };
    });
  }
  return CORE_SECTIONS;
}
