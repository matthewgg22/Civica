import { describe, it, expect } from "vitest";
import { normalizeForPortal } from "../src/core/normalize";
import { BenefitsCalPayloadSchema } from "../src/core/schemas";
import type { NormalizeInput } from "../src/core/normalize";

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------

function baseApplicant() {
  return {
    first_name: "Maria",
    last_name: "Garcia",
    date_of_birth: "1985-03-14",
    ssn_last4: "5678",
    phone: "+14155550001",
    street: "123 Oak St",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
  };
}

function noAnswers() {
  return [];
}

// ---------------------------------------------------------------------------
// Fixture 1: Utility-SUA household
//
// A single-person household that pays heat + electricity; QC engine has already
// computed utility_allowance_type = "standard". Income is supplied via
// income_sources (platform gig). Documents include a paystub and photo_id.
// ---------------------------------------------------------------------------

const utilityHouseholdInput: NormalizeInput = {
  packet_id: "a1b2c3d4-0000-0000-0000-000000000001",
  applicant: baseApplicant(),
  answers: noAnswers(),
  household_members: [], // single-person
  income_sources: [
    {
      income_type: "platform_gig",
      income_amount: 1200,
      income_frequency: "monthly",
    },
  ],
  documents: [
    { type: "paystub", url: "https://storage.supabase.co/object/public/docs/paystub.pdf" },
    { type: "photo_id", url: "https://storage.supabase.co/object/public/docs/id.pdf" },
  ],
  utility_allowance_type: "standard",
  client_signature_type: "async_portal",
};

// ---------------------------------------------------------------------------
// Fixture 2: Gig-income household (2 members, telephonic consent)
//
// Two-person household. Primary earns gig income; second member has W-2.
// Consent was telephonic — must carry consent_recorded_at into payload.
// No utility allowance (renter in included utilities building).
// ---------------------------------------------------------------------------

const gigHouseholdInput: NormalizeInput = {
  packet_id: "b2c3d4e5-0000-0000-0000-000000000002",
  applicant: {
    first_name: "James",
    last_name: "Lee",
    date_of_birth: "1990-07-22",
    ssn_last4: "1234",
    phone: "+13235550002",
    street: "456 Maple Ave Apt 3B",
    city: "Oakland",
    state: "CA",
    zip: "94601",
  },
  answers: noAnswers(),
  household_members: [
    {
      first_name: "Aisha",
      last_name: "Lee",
      date_of_birth: "1992-11-05",
      relationship: "spouse",
    },
  ],
  income_sources: [
    {
      income_type: "platform_gig",
      income_amount: 900,
      income_frequency: "monthly",
    },
    {
      income_type: "w2",
      income_amount: 2100,
      income_frequency: "monthly",
    },
  ],
  documents: [
    { type: "paystub", url: "https://storage.supabase.co/object/public/docs/paystub2.pdf" },
    { type: "photo_id", url: "https://storage.supabase.co/object/public/docs/id2.pdf" },
    { type: "utility_bill", url: "https://storage.supabase.co/object/public/docs/utility.pdf" },
  ],
  utility_allowance_type: "none",
  client_signature_type: "telephonic",
  telephonic_consent_recorded_at: "2026-05-18T14:30:00.000Z",
};

// ---------------------------------------------------------------------------
// Fixture 3: Income derived from packet_answers (QC engine not run yet)
// ---------------------------------------------------------------------------

const answerDrivenInput: NormalizeInput = {
  packet_id: "c3d4e5f6-0000-0000-0000-000000000003",
  applicant: baseApplicant(),
  answers: [
    { question_key: "income_type", navigator_confirmed_value: null, applicant_answer: "wages" },
    { question_key: "income_amount", navigator_confirmed_value: "1500", applicant_answer: "1500" },
    { question_key: "income_frequency", navigator_confirmed_value: "biweekly", applicant_answer: "monthly" },
  ],
  household_members: [],
  income_sources: [], // empty — should fall back to answers
  documents: [],
  utility_allowance_type: "telephone_only",
  client_signature_type: "in_person",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizeForPortal — utility-SUA household", () => {
  const payload = normalizeForPortal(utilityHouseholdInput);

  it("passes Zod schema validation", () => {
    const result = BenefitsCalPayloadSchema.safeParse(payload);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("preserves packet_id", () => {
    expect(payload.packet_id).toBe(utilityHouseholdInput.packet_id);
  });

  it("maps applicant personal info correctly", () => {
    expect(payload.first_name).toBe("Maria");
    expect(payload.last_name).toBe("Garcia");
    expect(payload.date_of_birth).toBe("1985-03-14");
    expect(payload.ssn_last4).toBe("5678");
    expect(payload.phone).toBe("+14155550001");
  });

  it("maps address correctly", () => {
    expect(payload.address.street).toBe("123 Oak St");
    expect(payload.address.city).toBe("Los Angeles");
    expect(payload.address.state).toBe("CA");
    expect(payload.address.zip).toBe("90001");
  });

  it("has no household members (single-person household)", () => {
    expect(payload.household_members).toHaveLength(0);
  });

  it("maps income sources", () => {
    expect(payload.income_sources).toHaveLength(1);
    const inc = payload.income_sources[0];
    expect(inc).toBeDefined();
    if (!inc) return;
    expect(inc.income_type).toBe("platform_gig");
    expect(inc.income_amount).toBe(1200);
    expect(inc.income_frequency).toBe("monthly");
  });

  it("sets utility_allowance_type = standard", () => {
    expect(payload.utility_allowance_type).toBe("standard");
  });

  it("includes both documents", () => {
    expect(payload.document_urls).toHaveLength(2);
    const types = payload.document_urls.map((d) => d.type);
    expect(types).toContain("paystub");
    expect(types).toContain("photo_id");
  });

  it("sets client_signature_type = async_portal", () => {
    expect(payload.client_signature_type).toBe("async_portal");
  });

  it("does not include telephonic_consent_recorded_at when not telephonic", () => {
    expect(payload.telephonic_consent_recorded_at).toBeUndefined();
  });
});

describe("normalizeForPortal — gig-income household (two-member, telephonic)", () => {
  const payload = normalizeForPortal(gigHouseholdInput);

  it("passes Zod schema validation", () => {
    const result = BenefitsCalPayloadSchema.safeParse(payload);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("maps applicant personal info correctly", () => {
    expect(payload.first_name).toBe("James");
    expect(payload.last_name).toBe("Lee");
    expect(payload.ssn_last4).toBe("1234");
    expect(payload.phone).toBe("+13235550002");
  });

  it("includes the household member", () => {
    expect(payload.household_members).toHaveLength(1);
    const member = payload.household_members[0];
    expect(member).toBeDefined();
    if (!member) return;
    expect(member.first_name).toBe("Aisha");
    expect(member.last_name).toBe("Lee");
    expect(member.relationship).toBe("spouse");
    expect(member.date_of_birth).toBe("1992-11-05");
  });

  it("maps two income sources", () => {
    expect(payload.income_sources).toHaveLength(2);
    const types = payload.income_sources.map((s) => s.income_type);
    expect(types).toContain("platform_gig");
    expect(types).toContain("w2");

    const total = payload.income_sources.reduce((sum, s) => sum + s.income_amount, 0);
    expect(total).toBe(3000);
  });

  it("sets utility_allowance_type = none", () => {
    expect(payload.utility_allowance_type).toBe("none");
  });

  it("includes three documents", () => {
    expect(payload.document_urls).toHaveLength(3);
  });

  it("sets client_signature_type = telephonic", () => {
    expect(payload.client_signature_type).toBe("telephonic");
  });

  it("includes telephonic_consent_recorded_at", () => {
    expect(payload.telephonic_consent_recorded_at).toBe("2026-05-18T14:30:00.000Z");
  });
});

describe("normalizeForPortal — income derived from packet_answers", () => {
  const payload = normalizeForPortal(answerDrivenInput);

  it("passes Zod schema validation", () => {
    const result = BenefitsCalPayloadSchema.safeParse(payload);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("derives income from answers when income_sources is empty", () => {
    expect(payload.income_sources).toHaveLength(1);
    const inc = payload.income_sources[0];
    expect(inc).toBeDefined();
    if (!inc) return;
    expect(inc.income_type).toBe("wages");
    expect(inc.income_amount).toBe(1500);
  });

  it("prefers navigator_confirmed_value over applicant_answer for frequency", () => {
    const inc = payload.income_sources[0];
    expect(inc).toBeDefined();
    if (!inc) return;
    // navigator_confirmed_value = "biweekly" should win over applicant_answer = "monthly"
    expect(inc.income_frequency).toBe("biweekly");
  });

  it("sets telephone_only utility allowance", () => {
    expect(payload.utility_allowance_type).toBe("telephone_only");
  });

  it("sets client_signature_type = in_person", () => {
    expect(payload.client_signature_type).toBe("in_person");
  });
});

describe("normalizeForPortal — edge cases", () => {
  it("defaults utility_allowance_type to none when omitted", () => {
    const { utility_allowance_type: _ua, ...rest } = utilityHouseholdInput;
    const input: NormalizeInput = {
      ...rest,
      packet_id: "ffffffff-0000-0000-0000-000000000001",
    };
    const payload = normalizeForPortal(input);
    expect(payload.utility_allowance_type).toBe("none");
  });

  it("defaults client_signature_type to async_portal when omitted", () => {
    const { client_signature_type: _cst, ...rest } = utilityHouseholdInput;
    const input: NormalizeInput = {
      ...rest,
      packet_id: "ffffffff-0000-0000-0000-000000000002",
    };
    const payload = normalizeForPortal(input);
    expect(payload.client_signature_type).toBe("async_portal");
  });

  it("filters out household members missing required fields", () => {
    const input: NormalizeInput = {
      ...utilityHouseholdInput,
      packet_id: "ffffffff-0000-0000-0000-000000000003",
      household_members: [
        { first_name: "", last_name: "Smith", date_of_birth: "1990-01-01", relationship: "child" },
        { first_name: "Valid", last_name: "Person", date_of_birth: "1995-06-15", relationship: "sibling" },
      ],
    };
    const payload = normalizeForPortal(input);
    // Only the valid member should survive the filter
    expect(payload.household_members).toHaveLength(1);
    expect(payload.household_members[0]?.first_name).toBe("Valid");
  });

  it("produces empty income list when answers have no income_type", () => {
    const input: NormalizeInput = {
      ...utilityHouseholdInput,
      packet_id: "ffffffff-0000-0000-0000-000000000004",
      income_sources: [],
      answers: [
        { question_key: "income_amount", navigator_confirmed_value: "500", applicant_answer: "500" },
        // no income_type answer
      ],
    };
    const payload = normalizeForPortal(input);
    expect(payload.income_sources).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// V1-2 (#312): demographic / eligibility fields + address.county
// ---------------------------------------------------------------------------

function answer(question_key: string, value: string) {
  return { question_key, navigator_confirmed_value: null, applicant_answer: value };
}

describe("normalizeForPortal — V1-2 demographic fields (missing → omitted)", () => {
  // No demographic answers + no county → ALL eligibility-critical fields are
  // OMITTED (left undefined) so the extension surfaces them as needs-review.
  // A missing citizenship/student/homeless/marital answer must NOT be silently
  // defaulted (autoplan Code Quality #3 + #311/V1-11). The payload still
  // validates because these fields are optional, not required.
  const payload = normalizeForPortal({
    ...utilityHouseholdInput,
    packet_id: "d1111111-0000-0000-0000-000000000001",
    answers: [],
  });

  it("still passes Zod schema validation with the demographic fields absent", () => {
    const result = BenefitsCalPayloadSchema.safeParse(payload);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("omits is_homeless and is_college_student when intake has no answer (needs-review, not defaulted)", () => {
    expect(payload.is_homeless).toBeUndefined();
    expect(payload.is_college_student).toBeUndefined();
    expect("is_homeless" in payload).toBe(false);
    expect("is_college_student" in payload).toBe(false);
  });

  it("omits marital_status and citizenship_status when intake has no answer (no silent default)", () => {
    expect(payload.marital_status).toBeUndefined();
    expect(payload.citizenship_status).toBeUndefined();
    expect("marital_status" in payload).toBe(false);
    expect("citizenship_status" in payload).toBe(false);
  });

  it("never silently defaults citizenship to us_citizen — the key is absent so the reviewer fills it", () => {
    // Regression guard: a defaulted us_citizen that LOOKS filled is a silent
    // wrong-data risk (non-citizen SNAP rules). The extension must see undefined.
    expect(payload.citizenship_status).not.toBe("us_citizen");
    expect(payload.citizenship_status).toBeUndefined();
  });

  it("omits the optional sex_assigned_at_birth and gender when absent", () => {
    expect(payload.sex_assigned_at_birth).toBeUndefined();
    expect(payload.gender).toBeUndefined();
    expect("sex_assigned_at_birth" in payload).toBe(false);
    expect("gender" in payload).toBe(false);
  });

  it("omits address.county when the applicant has no county", () => {
    expect(payload.address.county).toBeUndefined();
    expect("county" in payload.address).toBe(false);
  });
});

describe("normalizeForPortal — V1-2 demographic fields (populated)", () => {
  const payload = normalizeForPortal({
    ...gigHouseholdInput,
    packet_id: "d2222222-0000-0000-0000-000000000002",
    applicant: { ...gigHouseholdInput.applicant, county: "Sacramento County" },
    answers: [
      answer("housing_situation", "homeless"),
      answer("marital_status", "Registered Domestic Partner"),
      answer("college_student", "yes"),
      answer("citizenship_status", "non_citizen"),
      answer("sex_assigned_at_birth", "Female"),
      answer("gender", "Nonbinary"),
    ],
  });

  it("passes Zod schema validation with all new fields populated", () => {
    const result = BenefitsCalPayloadSchema.safeParse(payload);
    expect(result.success, result.error?.message).toBe(true);
  });

  it("derives is_homeless from housing_situation=homeless", () => {
    expect(payload.is_homeless).toBe(true);
  });

  it("maps a marital_status alias to the enum (domestic_partner)", () => {
    expect(payload.marital_status).toBe("domestic_partner");
  });

  it("derives is_college_student from a yes answer", () => {
    expect(payload.is_college_student).toBe(true);
  });

  it("maps citizenship_status to the enum", () => {
    expect(payload.citizenship_status).toBe("non_citizen");
  });

  it("maps sex_assigned_at_birth case-insensitively", () => {
    expect(payload.sex_assigned_at_birth).toBe("female");
  });

  it("carries gender through as a free string", () => {
    expect(payload.gender).toBe("Nonbinary");
  });

  it("trims and stores address.county as the NAME (not an ordinal)", () => {
    // county stays the name; the ca-county-ordinal transform maps it at fill time.
    expect(payload.address.county).toBe("Sacramento County");
  });
});

describe("normalizeForPortal — V1-2 edge cases", () => {
  it("prefers a direct is_homeless answer over housing_situation", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d3333333-0000-0000-0000-000000000003",
      answers: [answer("housing_situation", "homeless"), answer("is_homeless", "no")],
    });
    expect(payload.is_homeless).toBe(false);
  });

  it("maps a 'yes' citizenship answer (ABDOC-style) to us_citizen", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d4444444-0000-0000-0000-000000000004",
      answers: [answer("citizenship_status", "yes")],
    });
    expect(payload.citizenship_status).toBe("us_citizen");
  });

  it("omits marital_status for an unrecognized value (no silent default)", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d5555555-0000-0000-0000-000000000005",
      answers: [answer("marital_status", "its complicated")],
    });
    expect(payload.marital_status).toBeUndefined();
    expect("marital_status" in payload).toBe(false);
  });

  it("omits citizenship_status for an unrecognized value (no silent default)", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d5a55555-0000-0000-0000-000000000005",
      answers: [answer("citizenship_status", "green card holder")],
    });
    expect(payload.citizenship_status).toBeUndefined();
    expect("citizenship_status" in payload).toBe(false);
  });

  it("omits is_college_student for an unrecognized value (no silent default)", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d5b55555-0000-0000-0000-000000000005",
      answers: [answer("college_student", "maybe")],
    });
    expect(payload.is_college_student).toBeUndefined();
    expect("is_college_student" in payload).toBe(false);
  });

  it("includes is_college_student=false only when intake explicitly answered no", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d5c55555-0000-0000-0000-000000000005",
      answers: [answer("college_student", "no")],
    });
    expect(payload.is_college_student).toBe(false);
    expect("is_college_student" in payload).toBe(true);
  });

  it("omits sex_assigned_at_birth for an unrecognized value (no guess)", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d6666666-0000-0000-0000-000000000006",
      answers: [answer("sex_assigned_at_birth", "intersex")],
    });
    expect(payload.sex_assigned_at_birth).toBeUndefined();
  });

  it("omits address.county when the value is whitespace-only", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d7777777-0000-0000-0000-000000000007",
      applicant: { ...baseApplicant(), county: "   " },
    });
    expect(payload.address.county).toBeUndefined();
  });

  it("prefers navigator_confirmed_value for demographic answers", () => {
    const payload = normalizeForPortal({
      ...utilityHouseholdInput,
      packet_id: "d8888888-0000-0000-0000-000000000008",
      answers: [
        {
          question_key: "marital_status",
          navigator_confirmed_value: "married",
          applicant_answer: "single",
        },
      ],
    });
    expect(payload.marital_status).toBe("married");
  });
});

// ---------------------------------------------------------------------------
// V1-2 (#312): schema-level validation of the new enums + fields
// ---------------------------------------------------------------------------

describe("BenefitsCalPayloadSchema — V1-2 field validation", () => {
  const valid = normalizeForPortal({
    ...utilityHouseholdInput,
    packet_id: "d9999999-0000-0000-0000-000000000009",
    applicant: { ...baseApplicant(), county: "Fresno" },
    answers: [
      answer("marital_status", "married"),
      answer("citizenship_status", "us_national"),
      answer("sex_assigned_at_birth", "male"),
      answer("gender", "Man"),
    ],
  });

  it("accepts a fully-populated payload", () => {
    expect(BenefitsCalPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an out-of-enum marital_status", () => {
    const bad = { ...valid, marital_status: "engaged" };
    expect(BenefitsCalPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an out-of-enum citizenship_status", () => {
    const bad = { ...valid, citizenship_status: "green_card" };
    expect(BenefitsCalPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an out-of-enum sex_assigned_at_birth", () => {
    const bad = { ...valid, sex_assigned_at_birth: "other" };
    expect(BenefitsCalPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-boolean is_homeless / is_college_student", () => {
    expect(
      BenefitsCalPayloadSchema.safeParse({ ...valid, is_homeless: "yes" }).success,
    ).toBe(false);
    expect(
      BenefitsCalPayloadSchema.safeParse({ ...valid, is_college_student: 1 }).success,
    ).toBe(false);
  });

  it("treats is_homeless, marital_status, is_college_student, citizenship_status as OPTIONAL (omitted → still valid)", () => {
    // Eligibility-critical fields are optional, not required: the extension-first
    // model produces a partial payload and the human fills the rest. Omitting any
    // one must still validate so it can surface as needs-review (autoplan Code
    // Quality #3 + #311/V1-11) — NOT throw like the headless model would.
    for (const key of [
      "is_homeless",
      "marital_status",
      "is_college_student",
      "citizenship_status",
    ] as const) {
      const { [key]: _omit, ...rest } = valid;
      expect(
        BenefitsCalPayloadSchema.safeParse(rest).success,
        `missing ${key} should still validate (optional)`,
      ).toBe(true);
    }
  });

  it("validates a payload with ALL demographic fields omitted (fully partial)", () => {
    const {
      is_homeless: _h,
      marital_status: _m,
      is_college_student: _cs,
      citizenship_status: _c,
      sex_assigned_at_birth: _s,
      gender: _g,
      ...rest
    } = valid;
    expect(BenefitsCalPayloadSchema.safeParse(rest).success).toBe(true);
  });

  it("treats sex_assigned_at_birth and gender as optional", () => {
    const { sex_assigned_at_birth: _s, gender: _g, ...rest } = valid;
    expect(BenefitsCalPayloadSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts address.county as an optional free string", () => {
    expect(valid.address.county).toBe("Fresno");
    const { county: _c, ...addrRest } = valid.address;
    expect(
      BenefitsCalPayloadSchema.safeParse({ ...valid, address: addrRest }).success,
    ).toBe(true);
  });

  it("rejects an empty-string gender (min length 1)", () => {
    const bad = { ...valid, gender: "" };
    expect(BenefitsCalPayloadSchema.safeParse(bad).success).toBe(false);
  });
});
