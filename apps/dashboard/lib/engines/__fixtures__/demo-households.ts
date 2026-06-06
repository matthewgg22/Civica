// Synthetic demo households for /cbo-preview (PUBLIC page — zero real PII).
//
// Pure fiction, adapted from the v0.6 engine test-profile deck
// (data-ops/sample/civica-test-profiles/v0.6.json). These are the same
// synthetic profiles the rules engine is graded against, so every verdict /
// benefit the demo renders is real engine output cross-checked by oracleCA.
// Names and one-line situations are invented for the demo; no real applicant
// data is used or derivable.
//
// Regenerate the facts from the deck if v0.6 changes; keep names/situations.

import type { Facts } from "@civica/snap-rules";

/**
 * Policy date the demo evaluates against: 2026-06-01, the v0.6 deck's authored
 * basis (FY2026, after the OBBBA effective dates of 2025-10-01 and 2025-11-01).
 * Pinning the demo to this date (rather than the wall clock) keeps it
 * deterministic and aligned with the oracle: the engine has date-gated rules, so
 * evaluating at the fixtures' authored date is what makes every rendered verdict
 * match oracleCA. Bump this with the deck when the fixtures are regenerated for a
 * new fiscal year.
 */
export const DEMO_AS_OF = new Date("2026-06-01T00:00:00Z");

export interface DemoHousehold {
  /** Stable legacy id from the v0.6 deck (e.g. "A04"). */
  key: string;
  /** Invented display name for the demo. */
  name: string;
  /** One-line plain-English situation for a CBO audience. */
  situation: string;
  /** Engine-shaped facts (v0.6 mirrors the Facts type 1:1). */
  facts: Facts;
  /** Oracle expectation for CA — the cross-check the demo + test assert against. */
  oracleCA: { verdict: string; eligible: boolean; benefit: number | null };
}

export const DEMO_HOUSEHOLDS: DemoHousehold[] = [
  {
    "key": "A04",
    "name": "The Romeros",
    "situation": "Two parents, two kids, one full-time retail wage",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 34,
          "role": "head",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m2",
          "age": 32,
          "role": "spouse",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m3",
          "age": 6,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m4",
          "age": 8,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "wages",
          "amount": 2000,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 1200,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 0,
        "child_support_paid": 0
      },
      "assets": 400,
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 804
    }
  },
  {
    "key": "A01",
    "name": "Dana M.",
    "situation": "Single mother of two, part-time wages",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 29,
          "role": "head",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m2",
          "age": 5,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m3",
          "age": 7,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "wages",
          "amount": 1300,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 950,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 0,
        "child_support_paid": 0
      },
      "assets": 200,
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 759
    }
  },
  {
    "key": "A07",
    "name": "Mr. & Mrs. Okafor",
    "situation": "Retired couple, Social Security, high rent",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 68,
          "role": "head",
          "disability": true,
          "elderly": true,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m2",
          "age": 70,
          "role": "spouse",
          "disability": false,
          "elderly": true,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "unearned_rsdi",
          "amount": 1500,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 1300,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 80,
        "child_support_paid": 0
      },
      "assets": 3800,
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 546
    }
  },
  {
    "key": "A03",
    "name": "Samuel T.",
    "situation": "Disabled adult, SSDI, recurring medical costs",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 54,
          "role": "head",
          "disability": true,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "unearned_rsdi",
          "amount": 1100,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 850,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 300,
        "child_support_paid": 0
      },
      "assets": 900,
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 298
    }
  },
  {
    "key": "A05",
    "name": "Ray (no fixed address)",
    "situation": "Single adult, zero income",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 40,
          "role": "head",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "abawd_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [],
      "shelter": {
        "rent": 0,
        "sua_tier": "none",
        "sua_amount": 0,
        "internet": 0,
        "homeless_deduction": true
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 0,
        "child_support_paid": 0
      },
      "assets": 0,
      "cat_elig": "NPA",
      "expedited": true,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 298
    }
  },
  {
    "key": "M18",
    "name": "The Herreras",
    "situation": "Undocumented parent, two U.S.-citizen children",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 38,
          "role": "head",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "undocumented",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m2",
          "age": 8,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m3",
          "age": 10,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "wages",
          "amount": 2000,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 1000,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 0,
        "child_support_paid": 0
      },
      "assets": "n/a:not_authored",
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "APPROVE",
      "eligible": true,
      "benefit": 352
    }
  },
  {
    "key": "D08",
    "name": "The Lindqvists",
    "situation": "Dual-income professional household, over the limit",
    "facts": {
      "household": [
        {
          "member_id": "m1",
          "age": 42,
          "role": "head",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m2",
          "age": 40,
          "role": "spouse",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m3",
          "age": 10,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        },
        {
          "member_id": "m4",
          "age": 12,
          "role": "child",
          "disability": false,
          "elderly": false,
          "student": "not",
          "immigration": "citizen",
          "five_yr_bar": "n/a",
          "sponsored": false,
          "work_class": "gen_work_subject",
          "abawd_months_used": 0,
          "disqual": [],
          "living": "housed"
        }
      ],
      "income": [
        {
          "member": "m1",
          "type": "wages",
          "amount": 4500,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        },
        {
          "member": "m2",
          "type": "wages",
          "amount": 3000,
          "freq": "monthly",
          "anticipation": "averaged",
          "source_status": "ongoing"
        }
      ],
      "shelter": {
        "rent": 1500,
        "sua_tier": "HCSUA",
        "sua_amount": 663,
        "internet": 0,
        "homeless_deduction": false
      },
      "deductions": {
        "dependent_care": 0,
        "medical_unreimbursed": 0,
        "child_support_paid": 0
      },
      "assets": 40000,
      "cat_elig": "NPA",
      "expedited": false,
      "sponsor_income": null
    },
    "oracleCA": {
      "verdict": "DENY",
      "eligible": false,
      "benefit": null
    }
  }
];
