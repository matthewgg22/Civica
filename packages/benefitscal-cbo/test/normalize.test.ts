import { describe, it, expect } from "vitest";
import { normalizeForPortal } from "../src/normalize";
import { BenefitsCalPayloadSchema } from "../src/schemas";
import type { NormalizeInput } from "../src/normalize";

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
