"use server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { createApiClient } from "./client";

async function getAuthedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return createApiClient(session?.access_token);
}

export type PatchMePayload = {
  state_code?: "CA" | "MA";
  language?: "en" | "es";
};

export type ApiActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function patchMe(payload: PatchMePayload): Promise<ApiActionResult> {
  const client = await getAuthedClient();
  const { error } = await client.PATCH("/me", { body: payload });
  if (error) return { success: false, error: String(error) };
  return { success: true, data: undefined };
}

export async function getMe() {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me");
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data };
}

// ── Packets ───────────────────────────────────────────────────────────────────

export async function getPacketHistory(packetId: string) {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me/packets/{packetId}/history", {
    params: { path: { packetId } },
  });
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data: data ?? [] };
}

export async function getOrCreatePacket(stateCode: "CA" | "MA") {
  const client = await getAuthedClient();

  const { data: packets, error: listErr } = await client.GET("/me/packets");
  if (listErr) return { success: false as const, error: String(listErr) };

  const existing = packets?.find((p) => p.status !== "Closed");
  if (existing) return { success: true as const, data: existing };

  const { data: created, error: createErr } = await client.POST("/me/packets", {
    body: { state_code: stateCode },
  });
  if (createErr || !created) return { success: false as const, error: String(createErr) };
  return { success: true as const, data: created };
}

// ── Questions + answers ───────────────────────────────────────────────────────

export async function getQuestions(packetId: string) {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me/packets/{packetId}/questions", {
    params: { path: { packetId } },
  });
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data: data ?? [] };
}

export async function getAnswers(packetId: string) {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me/packets/{packetId}/answers", {
    params: { path: { packetId } },
  });
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data: data ?? [] };
}

export async function saveAnswer(
  packetId: string,
  questionId: string,
  value: unknown
): Promise<ApiActionResult> {
  const client = await getAuthedClient();
  const { error } = await client.POST("/me/packets/{packetId}/answers", {
    params: { path: { packetId } },
    body: { question_id: questionId, value },
  });
  if (error) return { success: false, error: String(error) };
  return { success: true, data: undefined };
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function listDocuments(packetId: string) {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me/packets/{packetId}/documents", {
    params: { path: { packetId } },
  });
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data: data ?? [] };
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export async function listInboxItems() {
  const client = await getAuthedClient();
  const { data, error } = await client.GET("/me/inbox");
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data: data ?? [] };
}

export async function resolveInboxItem(requestId: string): Promise<ApiActionResult> {
  const client = await getAuthedClient();
  const { error } = await client.POST("/me/inbox/{requestId}/resolve", {
    params: { path: { requestId } },
  });
  if (error) return { success: false, error: String(error) };
  return { success: true, data: undefined };
}

// ── Consent ───────────────────────────────────────────────────────────────────

export async function grantConsent(packetId: string, signature: string): Promise<ApiActionResult> {
  const client = await getAuthedClient();
  const { error } = await client.POST("/me/packets/{packetId}/consent", {
    params: { path: { packetId } },
    body: { signature, consented_at: new Date().toISOString() },
  });
  if (error) return { success: false, error: String(error) };
  return { success: true, data: undefined };
}

export async function withdrawConsent(packetId: string): Promise<ApiActionResult> {
  const client = await getAuthedClient();
  const { error } = await client.DELETE("/me/packets/{packetId}/consent", {
    params: { path: { packetId } },
  });
  if (error) return { success: false, error: String(error) };
  return { success: true, data: undefined };
}

// ── Submit ────────────────────────────────────────────────────────────────────

export async function submitPacket(packetId: string) {
  const client = await getAuthedClient();
  const { data, error } = await client.POST("/me/packets/{packetId}/submit", {
    params: { path: { packetId } },
  });
  if (error) return { success: false as const, error: String(error) };
  return { success: true as const, data };
}

/** Grant consent then submit in one action. Returns the updated packet. */
export async function submitWithConsent(
  packetId: string,
  signature: string
): Promise<ApiActionResult> {
  const consentResult = await grantConsent(packetId, signature);
  if (!consentResult.success) return consentResult;

  const submitResult = await submitPacket(packetId);
  if (!submitResult.success) return { success: false, error: submitResult.error };

  return { success: true, data: undefined };
}

// ── Readiness ─────────────────────────────────────────────────────────────────

export type ReadinessReport = {
  questionsReady: boolean;
  documentsReady: boolean;
  requiredQuestionsTotal: number;
  requiredQuestionsAnswered: number;
  requiredDocsTotal: number;
  requiredDocsUploaded: number;
};

export async function getReadiness(packetId: string): Promise<ReadinessReport> {
  const [questionsResult, answersResult, docsResult] = await Promise.all([
    getQuestions(packetId),
    getAnswers(packetId),
    listDocuments(packetId),
  ]);

  // Questions readiness
  const sections = questionsResult.success ? questionsResult.data : [];
  const allQuestions = sections.flatMap((s) => s.questions);
  const requiredQs = allQuestions.filter((q) => q.required);
  const savedAnswers = answersResult.success ? answersResult.data : [];
  const answeredIds = new Set(
    savedAnswers
      .filter((a) => {
        const v = a.value;
        if (v === null || v === undefined) return false;
        if (typeof v === "string") return (v as string).trim().length > 0;
        if (Array.isArray(v)) return (v as unknown[]).length > 0;
        return true;
      })
      .map((a) => a.question_id)
  );
  const requiredQsAnswered = requiredQs.filter((q) => answeredIds.has(q.id)).length;

  // Documents readiness
  const docs = docsResult.success ? docsResult.data : [];
  const requiredDocs = docs.filter((d) => d.required);
  const UPLOADED_STATUSES = new Set(["Uploaded", "Accepted for Packet", "Needs Review"]);
  const uploadedDocs = requiredDocs.filter((d) => UPLOADED_STATUSES.has(d.status)).length;

  return {
    questionsReady: requiredQs.length === 0 || requiredQsAnswered === requiredQs.length,
    documentsReady: requiredDocs.length === 0 || uploadedDocs === requiredDocs.length,
    requiredQuestionsTotal: requiredQs.length,
    requiredQuestionsAnswered: requiredQsAnswered,
    requiredDocsTotal: requiredDocs.length,
    requiredDocsUploaded: uploadedDocs,
  };
}
