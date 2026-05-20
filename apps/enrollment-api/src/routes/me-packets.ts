import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
import { getQuestionsForState } from "../lib/questions.js";
import type { Env } from "../types.js";
import { scoreErrorRisk } from "@civica/snap-qc-engine";
import { determineSUATier, checkHEAPCompliance } from "@civica/snap-rules";
import type { SUATier } from "@civica/snap-rules";
import { fetchFMR, householdSizeToBedrooms } from "../lib/hud-fmr.js";
import { validateAddress } from "../lib/smarty.js";
import { compareIncome } from "../lib/income-verification.js";
import type { PayPeriod } from "../lib/income-verification.js";

const app = new Hono<{ Bindings: Env }>();

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveApplicant(c: Context<{ Bindings: Env }>) {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }
  return getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
}

function mapPacket(p: Record<string, unknown>) {
  return {
    id: p.packet_id,
    status: p.status,
    state_code: p.state_code,
    created_at: p.created_at,
    updated_at: p.updated_at,
    submitted_at: p.submitted_at ?? null,
    notes_for_applicant: p.notes_for_applicant ?? null,
  };
}

// ── Packets list + create ─────────────────────────────────────────────────────

// GET /me/packets
app.get("/", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json((data ?? []).map((p) => mapPacket(p as Record<string, unknown>)));
});

// POST /me/packets
app.post(
  "/",
  zValidator("json", z.object({ state_code: z.enum(["CA", "MA"]) })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
    const db = makeServiceClient(c.env);

    const { data, error } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .insert({
        applicant_id: applicant.applicant_id,
        state_code: body.state_code,
        status: "Draft",
      })
      .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
      .single();

    if (error) throw new HTTPException(500, { message: error.message });
    return c.json(mapPacket(data as Record<string, unknown>), 201);
  }
);

// ── Single packet ─────────────────────────────────────────────────────────────

// GET /me/packets/:packetId
app.get("/:packetId", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(mapPacket(data as Record<string, unknown>));
});

// GET /me/packets/:packetId/history
app.get("/:packetId/history", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  // Verify ownership
  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("to_status, occurred_at, reason")
    .eq("packet_id", c.req.param("packetId"))
    .order("occurred_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => ({
      status: row.to_status,
      timestamp: row.occurred_at,
      note: row.reason ?? null,
    }))
  );
});

// ── Questions ─────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/questions
app.get("/:packetId/questions", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, state_code")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (error) throw new HTTPException(500, { message: (error as any).message });

  return c.json(getQuestionsForState(packet.state_code as string));
});

// ── Answers ───────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/answers
app.get("/:packetId/answers", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_answers")
    .select("question_key, applicant_answer, updated_at")
    .eq("packet_id", c.req.param("packetId"))
    .order("question_key");

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => {
      let value: unknown = row.applicant_answer;
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        try { value = JSON.parse(value); } catch { /* keep as string */ }
      }
      return { question_id: row.question_key, value, saved_at: row.updated_at };
    })
  );
});

// POST /me/packets/:packetId/answers — upsert a single answer
app.post(
  "/:packetId/answers",
  zValidator("json", z.object({ question_id: z.string().min(1), value: z.unknown() })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, state_code")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .single();

    if (!packet) throw new HTTPException(404, { message: "Packet not found" });

    const sections = getQuestionsForState(packet.state_code as string);
    const question = sections.flatMap((s) => s.questions).find((q) => q.id === body.question_id);
    const questionLabel = question?.label ?? body.question_id;

    const serializedValue =
      typeof body.value === "string" ? body.value : JSON.stringify(body.value);

    const db = makeServiceClient(c.env);
    const { data, error } = await db
      .schema("snap_enrollment")
      .from("packet_answers")
      .upsert(
        {
          packet_id: c.req.param("packetId"),
          question_key: body.question_id,
          question_label: questionLabel,
          answer_source: "applicant_input",
          applicant_answer: serializedValue,
          original_ocr_value: null,
        },
        { onConflict: "packet_id,question_key" }
      )
      .select("question_key, updated_at")
      .single();

    if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
    if (error) throw new HTTPException(500, { message: error.message });

    return c.json({ question_id: data.question_key, value: body.value, saved_at: data.updated_at }, 201);
  }
);

// ── Documents ─────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/documents
app.get("/:packetId/documents", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .select(`
      item_id, label, is_required, document_kind,
      resolved_at, waived_at,
      uploaded_documents!resolved_document_id(document_id, processing_status, uploaded_at)
    `)
    .eq("packet_id", c.req.param("packetId"))
    .order("created_at");

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => {
      const docRow = row.uploaded_documents as Record<string, unknown> | null;

      let status: string;
      if (row.waived_at) {
        status = "N/A";
      } else if (row.resolved_at && docRow?.processing_status === "complete") {
        status = "Accepted for Packet";
      } else if (docRow?.processing_status === "processing") {
        status = "Needs Review";
      } else if (docRow) {
        status = "Uploaded";
      } else if (!row.is_required) {
        status = "Optional";
      } else {
        status = "Not Started";
      }

      return {
        id: row.item_id,
        name: row.label,
        status,
        required: row.is_required,
        uploaded_at: (docRow?.uploaded_at as string | null) ?? null,
      };
    })
  );
});

// ── Consent ───────────────────────────────────────────────────────────────────

// POST /me/packets/:packetId/consent
app.post(
  "/:packetId/consent",
  zValidator(
    "json",
    z.object({
      signature: z.string().min(1).max(200),
      consented_at: z.string().datetime(),
    })
  ),
  async (c) => {
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet, error: pErr } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, status")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .single();

    if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
    if (packet.status !== "Draft") {
      throw new HTTPException(409, { message: "Consent already recorded or packet is not in Draft status" });
    }

    const db = makeServiceClient(c.env);
    const POLICY_VERSION = "2026-05-01";
    const consentRows = (["privacy_notice", "data_sharing", "terms_of_service"] as const).map(
      (kind) => ({
        applicant_id: applicant.applicant_id,
        consent_kind: kind,
        policy_version: POLICY_VERSION,
        consent_method: "web_checkbox" as const,
        ip_address: ip,
      })
    );

    const { error: consentErr } = await db
      .schema("snap_enrollment")
      .from("user_consents")
      .insert(consentRows);

    if (consentErr) throw new HTTPException(500, { message: consentErr.message });
    return c.body(null, 204);
  }
);

// DELETE /me/packets/:packetId/consent — revoke all consents for this applicant (service-role update)
app.delete("/:packetId/consent", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

  const { data: packet, error: pErr } = await makeAnonClient(c.env, c.get("jwt"))
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });

  const db = makeServiceClient(c.env);
  const { error } = await db
    .schema("snap_enrollment")
    .from("user_consents")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: "applicant_requested" })
    .eq("applicant_id", applicant.applicant_id)
    .is("revoked_at", null);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

// ── Document upload URL ───────────────────────────────────────────────────────

// POST /me/packets/:packetId/upload-url — generate a Supabase Storage presigned
// upload URL for a document. The client PUTs the file directly to the returned URL
// and then calls POST /documents to register it in the DB.
app.post(
  "/:packetId/upload-url",
  zValidator("json", z.object({ filename: z.string().max(255).optional() })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet, error: pErr } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .is("deleted_at", null)
      .single();

    if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

    const ext = body.filename?.split(".").pop()?.toLowerCase() ?? "pdf";
    const storagePath = `${applicant.applicant_id}/${c.req.param("packetId")}/${crypto.randomUUID()}.${ext}`;

    const svc = makeServiceClient(c.env);
    const { data, error } = await svc.storage.from("documents").createSignedUploadUrl(storagePath);
    if (error) throw new HTTPException(500, { message: error.message });

    return c.json({
      signed_url: data.signedUrl,
      storage_path: storagePath,
    }, 201);
  }
);

// ── Error Risk Score ──────────────────────────────────────────────────────────

/**
 * Derives QC flow signals from packet data using real computed values:
 * - utility-sua: determineSUATier() + checkHEAPCompliance() instead of monthly_utilities > 0 proxy
 * - gig-income: compareIncome(OCR vs reported) + Argyle instead of Argyle-only proxy
 * - shared-lease: housing_situation heuristic (unchanged; doc resolution not yet wired)
 *
 * Persists the result to packet_error_risk (non-blocking).
 */
async function scorePacketRisk(
  env: Env,
  jwt: string,
  packetId: string,
  applicantId: string,
): Promise<{ score: number | null; tier: string; factors: string[]; engine_version: string }> {
  const anonDb = makeAnonClient(env, jwt);

  const [answersResult, argyleResult, fieldsResult] = await Promise.all([
    anonDb
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, applicant_answer")
      .eq("packet_id", packetId)
      .in("question_key", [
        "employment_status",
        "housing_situation",
        "monthly_utilities",
        "monthly_gross_income",
        "has_heating_costs",
        "has_electric_or_gas",
        "has_phone",
        "receives_heap",
      ]),
    anonDb
      .schema("snap_enrollment")
      .from("argyle_connections")
      .select("linked_accounts")
      .eq("applicant_id", applicantId)
      .is("revoked_at", null)
      .maybeSingle(),
    anonDb
      .schema("snap_enrollment")
      .from("extraction_fields")
      .select("field_key, original_ocr_value, confidence")
      .eq("packet_id", packetId)
      .in("field_key", ["gross_pay", "pay_amount", "monthly_gross_income", "pay_period"]),
  ]);

  type AnswerRow = { question_key: string; applicant_answer: string | null };
  const answers: Record<string, string> = Object.fromEntries(
    (answersResult.data ?? [])
      .map((a: AnswerRow) => [a.question_key, a.applicant_answer ?? ""])
      .filter(([, v]: [string, string]) => v !== "")
  );

  const linkedAccounts = (argyleResult.data?.linked_accounts as unknown[]) ?? [];
  const argyleConnected = linkedAccounts.length > 0;

  // OCR income extraction
  type FieldRow = { field_key: string; original_ocr_value: string | null; confidence: number };
  const payFields = ((fieldsResult.data ?? []) as FieldRow[])
    .filter((f) => ["gross_pay", "pay_amount", "monthly_gross_income"].includes(f.field_key))
    .sort((a, b) => b.confidence - a.confidence);
  const payPeriodField = ((fieldsResult.data ?? []) as FieldRow[]).find((f) => f.field_key === "pay_period");

  const ocrPayAmount = payFields[0]?.original_ocr_value
    ? parseFloat(payFields[0].original_ocr_value) || null
    : null;

  let ocrPayPeriod: PayPeriod | null = null;
  if (payPeriodField?.original_ocr_value) {
    const raw = payPeriodField.original_ocr_value.toLowerCase();
    if (raw.includes("biweekly") || raw.includes("bi-weekly")) ocrPayPeriod = "biweekly";
    else if (raw.includes("weekly")) ocrPayPeriod = "weekly";
    else if (raw.includes("semi")) ocrPayPeriod = "semimonthly";
    else if (raw.includes("monthly")) ocrPayPeriod = "monthly";
    else if (raw.includes("annual") || raw.includes("yearly")) ocrPayPeriod = "annual";
  } else if (payFields[0]?.field_key === "monthly_gross_income") {
    ocrPayPeriod = "monthly";
  }

  const reportedMonthly = parseFloat(answers["monthly_gross_income"] ?? "") || null;
  const ocrComparison = compareIncome(reportedMonthly, ocrPayAmount, ocrPayPeriod);

  // SUA tier + OBBBA HEAP compliance
  const suaAnswers = {
    has_heating_costs: (answers["has_heating_costs"] as "yes" | "no" | null) ?? null,
    has_electric_or_gas: (answers["has_electric_or_gas"] as "yes" | "no" | null) ?? null,
    has_phone: (answers["has_phone"] as "yes" | "no" | null) ?? null,
  };
  const suaComputed = determineSUATier(suaAnswers);
  const heapCheck = checkHEAPCompliance({
    receives_heap: (answers["receives_heap"] as "yes" | "no" | null) ?? null,
    sua_tier_claimed: suaComputed,
  });

  type FlowSignal = { flow: "gig-income" | "utility-sua" | "shared-lease"; defensibility_score: "strong" | "moderate" | "weak" };
  const flowSignals: FlowSignal[] = [];

  // utility-sua: deterministic SUA tier computation; HEAP flag → weak
  const hasSuaData = suaAnswers.has_heating_costs !== null
    || suaAnswers.has_electric_or_gas !== null
    || suaAnswers.has_phone !== null;
  const hasFullSuaData = suaAnswers.has_heating_costs !== null
    && suaAnswers.has_electric_or_gas !== null
    && suaAnswers.has_phone !== null;
  const hasMonthlyUtilities = parseFloat(answers["monthly_utilities"] ?? "0") > 0;

  if (hasSuaData || hasMonthlyUtilities) {
    const suaDef: "strong" | "moderate" | "weak" =
      heapCheck.heap_flag ? "weak"      // OBBBA HEAP+Full-SUA conflict → high QC risk
      : hasFullSuaData ? "moderate"     // all questions answered; deterministic tier
      : "weak";                         // partial SUA data; tier uncertain
    flowSignals.push({ flow: "utility-sua", defensibility_score: suaDef });
  }

  // gig-income: Argyle API → strong; OCR match → moderate; OCR mismatch/incomplete/none → weak
  const incomeStatuses = new Set(["employed_full_time", "employed_part_time", "self_employed"]);
  const employmentStatus = answers["employment_status"];
  if (employmentStatus && incomeStatuses.has(employmentStatus)) {
    let incomeDef: "strong" | "moderate" | "weak";
    if (argyleConnected) {
      incomeDef = "strong";
    } else if (ocrComparison.direction === "incomplete" || ocrComparison.flagged) {
      incomeDef = "weak";
    } else if (ocrComparison.ocr_monthly !== null) {
      incomeDef = "moderate";
    } else {
      incomeDef = "weak";
    }
    flowSignals.push({ flow: "gig-income", defensibility_score: incomeDef });
  }

  // shared-lease: housing_situation heuristic (doc resolution status not yet wired)
  const housingSituation = answers["housing_situation"];
  if (housingSituation === "renting" || housingSituation === "living_with_family") {
    flowSignals.push({ flow: "shared-lease", defensibility_score: "moderate" });
  }

  const result = scoreErrorRisk(flowSignals);

  // Persist for analytics history (non-blocking)
  if (result.score !== null) {
    void makeServiceClient(env)
      .schema("snap_enrollment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("packet_error_risk" as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ packet_id: packetId, engine_version: result.engine_version, score: result.score, factors: result.factors, tier: result.tier } as any)
      .then(() => {}, () => {});
  }

  return { score: result.score, tier: result.tier, factors: result.factors, engine_version: result.engine_version };
}

// POST /me/packets/:packetId/error-risk
app.post("/:packetId/error-risk", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const packetId = c.req.param("packetId");
  const anonDb = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await anonDb
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, applicant_id")
    .eq("packet_id", packetId)
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const result = await scorePacketRisk(c.env, c.get("jwt"), packetId, packet.applicant_id as string);
  return c.json(result);
});

// ── Verification Summary ──────────────────────────────────────────────────────

// GET /me/packets/:packetId/verification-summary
// Rules-First API verification: SUA tier, rent vs FMR, address deliverability,
// income OCR vs reported, OBBBA HEAP compliance. External API calls (HUD, Smarty)
// are skipped gracefully when env vars are absent.
app.get("/:packetId/verification-summary", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const packetId = c.req.param("packetId");
  const anonDb = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await anonDb
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, applicant_id")
    .eq("packet_id", packetId)
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  // Parallel: fetch all DB data we need in one round trip
  const [answersResult, fieldsResult, argyleResult, paychecksResult] = await Promise.all([
    anonDb
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, applicant_answer")
      .eq("packet_id", packetId)
      .in("question_key", [
        "household_size",
        "monthly_gross_income",
        "monthly_rent_or_mortgage",
        "home_address",
        "has_heating_costs",
        "has_electric_or_gas",
        "has_phone",
        "receives_heap",
      ]),
    anonDb
      .schema("snap_enrollment")
      .from("extraction_fields")
      .select("field_key, original_ocr_value, confidence")
      .eq("packet_id", packetId)
      .in("field_key", ["gross_pay", "pay_amount", "monthly_gross_income", "pay_period", "net_pay"]),
    anonDb
      .schema("snap_enrollment")
      .from("argyle_connections")
      .select("linked_accounts")
      .eq("applicant_id", applicant.applicant_id)
      .is("revoked_at", null)
      .maybeSingle(),
    anonDb
      .schema("snap_enrollment")
      .from("marketplace_paychecks")
      .select("monthly_amount_usd, pay_date, employer_name")
      .eq("packet_id", packetId)
      .order("pay_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  type AnswerRow = { question_key: string; applicant_answer: string | null };
  const answerMap: Record<string, string | null> = Object.fromEntries(
    (answersResult.data ?? []).map((r: AnswerRow) => [r.question_key, r.applicant_answer])
  );

  const getAnswer = (key: string): string | null => answerMap[key] ?? null;

  // ── Address validation ──────────────────────────────────────────────────────
  let addressResult: { deliverability: string; rdi: string; advisory?: string } = {
    deliverability: "unavailable",
    rdi: "Unknown",
  };

  const rawAddress = getAnswer("home_address");
  if (rawAddress && c.env.SMARTY_AUTH_ID && c.env.SMARTY_AUTH_TOKEN) {
    try {
      const addr = JSON.parse(rawAddress) as { street?: string; city?: string; state?: string; zip?: string };
      if (addr.street && addr.city && addr.state && addr.zip) {
        const smarty = await validateAddress(
          addr.street,
          addr.city,
          addr.state,
          addr.zip,
          c.env.SMARTY_AUTH_ID,
          c.env.SMARTY_AUTH_TOKEN,
        );
        addressResult = smarty;
      }
    } catch {
      // Malformed address JSON — leave as unavailable
    }
  }

  // ── Rent vs HUD FMR ─────────────────────────────────────────────────────────
  const rentClaimed = parseFloat(getAnswer("monthly_rent_or_mortgage") ?? "") || null;
  const householdSize = parseInt(getAnswer("household_size") ?? "", 10) || 1;
  const bedroomCount = householdSizeToBedrooms(householdSize);

  let fmrValue: number | null = null;
  let rentRatio: number | null = null;
  let rentFlagged = false;

  if (c.env.HUD_TOKEN) {
    const rawAddress = getAnswer("home_address");
    let zip: string | null = null;
    if (rawAddress) {
      try {
        const addr = JSON.parse(rawAddress) as { zip?: string };
        zip = addr.zip ?? null;
      } catch { /* ignore */ }
    }
    if (zip) {
      const fmrResult = await fetchFMR(zip, bedroomCount, c.env.HUD_TOKEN);
      fmrValue = fmrResult.fmr;
      if (rentClaimed !== null && fmrValue !== null && fmrValue > 0) {
        rentRatio = rentClaimed / fmrValue;
        // Flag if rent is > 150% of FMR (likely error or shared-lease situation)
        rentFlagged = rentRatio > 1.5;
      }
    }
  }

  // ── SUA tier ─────────────────────────────────────────────────────────────────
  const suaAnswers = {
    has_heating_costs: getAnswer("has_heating_costs") as "yes" | "no" | null,
    has_electric_or_gas: getAnswer("has_electric_or_gas") as "yes" | "no" | null,
    has_phone: getAnswer("has_phone") as "yes" | "no" | null,
  };
  const suaComputed = determineSUATier(suaAnswers);

  // For "claimed" SUA tier, derive from the same answers (the questionnaire
  // doesn't have a separate "claimed tier" field yet). When SUA questions are
  // answered, computed == claimed; when absent, both are null.
  const suaClaimed: SUATier | null = suaComputed;
  const suaFlagged = false; // Tier mismatch detection requires two sources; deferred to Phase 2.

  const heapCheck = checkHEAPCompliance({
    receives_heap: getAnswer("receives_heap") as "yes" | "no" | null | undefined,
    sua_tier_claimed: suaClaimed,
  });

  // ── Income comparison ────────────────────────────────────────────────────────
  type FieldRow = { field_key: string; original_ocr_value: string | null; confidence: number };
  const fields = (fieldsResult.data ?? []) as FieldRow[];

  // Prefer highest-confidence pay-amount field
  const payAmountField = fields
    .filter((f) => ["gross_pay", "pay_amount", "monthly_gross_income"].includes(f.field_key))
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const payPeriodField = fields.find((f) => f.field_key === "pay_period") ?? null;

  const reportedMonthly = parseFloat(getAnswer("monthly_gross_income") ?? "") || null;
  const ocrPayAmount = payAmountField?.original_ocr_value
    ? parseFloat(payAmountField.original_ocr_value) || null
    : null;

  // Infer pay period from field_key if pay_period field is absent
  let ocrPayPeriod: PayPeriod | null = null;
  if (payPeriodField?.original_ocr_value) {
    const raw = payPeriodField.original_ocr_value.toLowerCase();
    if (raw.includes("weekly") && !raw.includes("bi")) ocrPayPeriod = "weekly";
    else if (raw.includes("biweekly") || raw.includes("bi-weekly")) ocrPayPeriod = "biweekly";
    else if (raw.includes("semi")) ocrPayPeriod = "semimonthly";
    else if (raw.includes("monthly")) ocrPayPeriod = "monthly";
    else if (raw.includes("annual") || raw.includes("yearly")) ocrPayPeriod = "annual";
  } else if (payAmountField?.field_key === "monthly_gross_income") {
    // This field is already monthly
    ocrPayPeriod = "monthly";
  }

  const incomeComparison = compareIncome(reportedMonthly, ocrPayAmount, ocrPayPeriod);

  const latestPaycheck = paychecksResult.data ?? null;
  const argyleMonthly = latestPaycheck
    ? (latestPaycheck as { monthly_amount_usd: number }).monthly_amount_usd
    : null;

  return c.json({
    shelter: {
      address: addressResult,
      rent: {
        claimed: rentClaimed,
        fmr: fmrValue,
        ratio: rentRatio,
        flagged: rentFlagged,
      },
      sua_tier: {
        claimed: suaClaimed,
        computed: suaComputed,
        flagged: suaFlagged,
        heap_flag: heapCheck.heap_flag,
      },
    },
    income: {
      reported_monthly: incomeComparison.reported_monthly,
      ocr_monthly: incomeComparison.ocr_monthly,
      delta_pct: incomeComparison.delta_pct,
      direction: incomeComparison.direction,
      flagged: incomeComparison.flagged,
      argyle_monthly: argyleMonthly,
    },
    obbba: {
      heap_flag: heapCheck.heap_flag,
      flag_reason: heapCheck.flag_reason,
    },
  });
});

// ── Submit ────────────────────────────────────────────────────────────────────

// POST /me/packets/:packetId/submit
app.post("/:packetId/submit", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

  const { data: packet, error: pErr } = await makeAnonClient(c.env, c.get("jwt"))
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
  if (packet.status !== "Draft") {
    throw new HTTPException(409, { message: `Packet cannot be submitted from status "${packet.status}"` });
  }

  const db = makeServiceClient(c.env);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .update({
      status: "Submitted for Review",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("packet_id", c.req.param("packetId"))
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error) throw new HTTPException(500, { message: error.message });

  // Auto-score on submit so packet_error_risk has a row without requiring the iOS
  // app to call /error-risk separately. Non-blocking — submission succeeds regardless.
  void scorePacketRisk(c.env, c.get("jwt"), c.req.param("packetId"), applicant.applicant_id).catch(() => {});

  return c.json(mapPacket(data as Record<string, unknown>));
});

export default app;
