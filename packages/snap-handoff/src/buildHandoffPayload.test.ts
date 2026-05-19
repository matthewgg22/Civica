import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildHandoffPayload,
  sha256Hex,
  HANDOFF_DISCLAIMER,
  type HandoffPayload,
} from "./index";

// ---------------------------------------------------------------------------
// Fixtures — column names match commit f3abbe28 (applicant_answer, answer_source,
// extraction_id) NOT any prior wrong schema.
// ---------------------------------------------------------------------------

const PACKET_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const APPLICANT_ID = "bbbbbbbb-0000-0000-0000-000000000002";

const fixturePacket = {
  packet_id: PACKET_ID,
  status: "Ready for Handoff",
  state_code: "CA",
  county: "Alameda",
  created_at: "2026-05-01T00:00:00.000Z",
  submitted_at: "2026-05-02T00:00:00.000Z",
  handed_off_at: null,
  deleted_at: null,
  applicants: {
    applicant_id: APPLICANT_ID,
    state_code: "CA",
    preferred_language: "en",
    created_at: "2026-05-01T00:00:00.000Z",
  },
};

const fixtureAnswers = [
  {
    question_key: "household_size",
    applicant_answer: "4",
    navigator_confirmed_value: "4",
    answer_source: "applicant",
    created_at: "2026-05-01T12:00:00.000Z",
  },
];

const fixtureDocs = [
  {
    document_id: "doc-00000001",
    document_kind: "proof_of_identity",
    original_filename: "id.pdf",
    uploaded_at: "2026-05-01T13:00:00.000Z",
    processing_status: "complete",
  },
];

const fixtureDocItems = [
  {
    item_id: "item-00000001",
    document_kind: "proof_of_identity",
    label: "Photo ID",
    is_required: true,
    resolved_at: "2026-05-01T14:00:00.000Z",
    waived_at: null,
    waive_reason: null,
    resolved_document_id: "doc-00000001",
  },
];

const fixtureFields = [
  {
    field_id: "field-00000001",
    field_key: "income_monthly",
    extraction_id: "ext-00000001",
    applicant_answer: "2500",
    original_ocr_value: "2500",
    navigator_confirmed_value: "2500",
    confidence: 0.98,
    needs_review: false,
    reviewed_at: "2026-05-01T15:00:00.000Z",
  },
];

const fixtureNotes = [
  {
    note_id: "note-00000001",
    is_internal: false,
    created_at: "2026-05-01T16:00:00.000Z",
    author_staff_id: "staff-00000001",
  },
  // internal note — must be filtered from the exported payload
  {
    note_id: "note-00000002",
    is_internal: true,
    created_at: "2026-05-01T16:30:00.000Z",
    author_staff_id: "staff-00000001",
  },
];

const fixtureConsent = [
  {
    consent_id: "consent-00000001",
    consent_kind: "privacy_notice",
    consented_at: "2026-05-01T10:00:00.000Z",
    policy_version: "1.0",
    consent_method: "electronic",
  },
];

const fixtureHistory = [
  {
    from_status: null,
    to_status: "Draft",
    occurred_at: "2026-05-01T00:00:00.000Z",
    reason: null,
    changed_by_staff_id: null,
  },
  {
    from_status: "Draft",
    to_status: "Submitted for Review",
    occurred_at: "2026-05-02T00:00:00.000Z",
    reason: "Applicant submitted",
    changed_by_staff_id: null,
  },
];

// ---------------------------------------------------------------------------
// Mock Supabase client
// The query-builder pattern: db.schema(s).from(t).select(...).eq(...).single()
// Each chain must be thenable (for Promise.all) and expose .single() (for row
// lookups). We route by table name to return the right fixture.
// ---------------------------------------------------------------------------

type MockResult<T> = { data: T; error: null };

function makeChain<T>(listData: T[], singleData: T | null) {
  const listResult: MockResult<T[]> = { data: listData, error: null };
  const singleResult: MockResult<T | null> = { data: singleData, error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(singleResult),
    then: (
      resolve: (r: MockResult<T[]>) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(listResult).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) =>
      Promise.resolve(listResult).catch(reject),
  };
  return chain;
}

function makeMockDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableChains: Record<string, any> = {
    snap_packets: makeChain([fixturePacket], fixturePacket),
    packet_answers: makeChain(fixtureAnswers, null),
    uploaded_documents: makeChain(fixtureDocs, null),
    required_document_items: makeChain(fixtureDocItems, null),
    extraction_fields: makeChain(fixtureFields, null),
    navigator_notes: makeChain(fixtureNotes, null),
    user_consents: makeChain(fixtureConsent, null),
    packet_status_history: makeChain(fixtureHistory, null),
  };

  return {
    schema: (_schema: string) => ({
      from: (table: string) =>
        tableChains[table] ?? makeChain([], null),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as unknown as import("@supabase/supabase-js").SupabaseClient<any, any, any>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildHandoffPayload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a payload with the correct top-level shape", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);

    expect(payload).toHaveProperty("disclaimer");
    expect(payload).toHaveProperty("schema_version", 1);
    expect(payload).toHaveProperty("generated_at");
    expect(payload).toHaveProperty("packet");
    expect(payload).toHaveProperty("applicant");
    expect(payload).toHaveProperty("answers");
    expect(payload).toHaveProperty("documents");
    expect(payload).toHaveProperty("extractions");
    expect(payload).toHaveProperty("notes_meta");
    expect(payload).toHaveProperty("consent");
    expect(payload).toHaveProperty("status_history");
  });

  it("embeds the HANDOFF_DISCLAIMER verbatim", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);
    expect(payload.disclaimer).toBe(HANDOFF_DISCLAIMER);
  });

  it("applicant_id is an opaque UUID — no human-readable PII fields in the export", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);

    // applicant is present and the id is a UUID
    expect(payload.applicant).not.toBeNull();
    expect(payload.applicant!.applicant_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // no name, email, ssn, dob, or phone in the exported applicant object
    const applicantKeys = Object.keys(payload.applicant!);
    for (const piiKey of ["name", "email", "ssn", "dob", "phone", "date_of_birth"]) {
      expect(applicantKeys).not.toContain(piiKey);
    }
  });

  it("filters internal navigator notes out of notes_meta", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);
    // fixtureNotes has 2 entries; only the non-internal one should appear
    expect(payload.notes_meta).toHaveLength(1);
    expect(payload.notes_meta[0]!.note_id).toBe("note-00000001");
  });

  it("uses the corrected column names from commit f3abbe28 in answers", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);
    const answer = payload.answers[0];
    expect(answer).toHaveProperty("applicant_answer");
    expect(answer).toHaveProperty("answer_source");
    expect(answer!.applicant_answer).toBe("4");
    expect(answer!.answer_source).toBe("applicant");
  });

  it("uses the corrected column names from commit f3abbe28 in extractions", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);
    const field = payload.extractions[0];
    expect(field).toHaveProperty("extraction_id", "ext-00000001");
    expect(field).toHaveProperty("applicant_answer", "2500");
  });

  it("snapshots the full payload shape so future drift fails the build", async () => {
    const db = makeMockDb();
    const payload = await buildHandoffPayload(db, PACKET_ID);
    expect(payload).toMatchSnapshot();
  });
});

describe("sha256Hex", () => {
  it("is deterministic for the same input", async () => {
    const input = new TextEncoder().encode("civica-snap-handoff-test");
    const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(input)]);
    expect(a).toBe(b);
  });

  it("returns a 64-character lowercase hex string", async () => {
    const input = new TextEncoder().encode("test");
    const hash = await sha256Hex(input);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a known SHA-256 value for an empty input", async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await sha256Hex(new Uint8Array(0));
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("produces different hashes for different inputs", async () => {
    const enc = new TextEncoder();
    const h1 = await sha256Hex(enc.encode("abc"));
    const h2 = await sha256Hex(enc.encode("abd"));
    expect(h1).not.toBe(h2);
  });
});
