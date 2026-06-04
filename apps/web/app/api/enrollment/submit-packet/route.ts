// POST /api/enrollment/submit-packet — server-side bridge from the web
// wizard's localStorage draft to the gateway's create-packet → upsert-answers
// → submit chain. Returns the packetId for the next-steps screen.

import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../lib/enrollment-api/client";
import { requireEnrollmentApiUrl } from "../../../../lib/env";
import { currentAccessToken } from "../../../../lib/supabase-server";
import { draftSchema, type SNAPApplicationDraft } from "../../../../lib/snap/draft";
import { draftToAnswerTuples } from "../../../../lib/snap/draft-to-answers";

type Body = {
  draft?: unknown;
  stateCode?: string;
};

async function upsertAnswer(
  packetId: string,
  questionKey: string,
  payload: { question_label: string; applicant_answer: string },
  bearer: string,
) {
  const base = requireEnrollmentApiUrl().replace(/\/$/, "");
  const res = await fetch(
    `${base}/v1/enrollment/packets/${packetId}/answers/${encodeURIComponent(questionKey)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        question_key: questionKey,
        question_label: payload.question_label,
        answer_source: "applicant",
        applicant_answer: payload.applicant_answer,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok && res.status !== 422) {
    // 422 = write-once immutability trigger fired; the answer was already
    // recorded and we shouldn't fail the submit for it.
    throw new EnrollmentAPIError(res.status, await res.text());
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(body.draft);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_draft" }, { status: 400 });
  }
  const draft: SNAPApplicationDraft = parsed.data;
  const stateCode = (body.stateCode ?? draft.whereApplying.state ?? "").trim().toUpperCase();
  if (stateCode.length !== 2) {
    return NextResponse.json({ error: "missing_state" }, { status: 400 });
  }

  const token = await currentAccessToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const client = enrollmentClient();
    const packet = await client.createPacket(stateCode);
    const tuples = draftToAnswerTuples(draft);
    // Run the answer upserts in parallel — they're independent rows.
    await Promise.all(
      tuples.map((t) =>
        upsertAnswer(
          packet.id,
          t.question_key,
          { question_label: t.question_label, applicant_answer: t.applicant_answer },
          token,
        ),
      ),
    );
    const submitted = await client.submitPacket(packet.id);
    return NextResponse.json({ packetId: submitted.id, status: submitted.status });
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "gateway_failed", detail: msg }, { status });
  }
}
