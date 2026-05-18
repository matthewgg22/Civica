// SNAP Interview Coach — practice-session scorer.
//
// Wire contract: the iOS InterviewCoachAPIClient (Civica/Features/SNAP/
// InterviewCoach/InterviewCoachAPIClient.swift) POSTs snake_case JSON shaped
// like InterviewScoreRequestDTO and expects InterviewScoreResponseDTO back.
// Scoring prompt is ported from claude/funny-carson-469610:
// backend/civic_api/prompts/05_interview_coach_scoring.txt.

import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-anonymous-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "claude-sonnet-4-6";
const MAX_TURN_CHARS = 1200;
const MAX_TRANSCRIPT_TURNS = 32;
const END_INTERVIEW_TOKEN = "[END_INTERVIEW]";

type Role = "caseworker" | "applicant";
type TurnDTO = { role: Role; text: string };

type ScoreRequest = {
  session_id: string;
  state_code: string;
  state_name: string;
  scenario: string;
  scenario_label: string;
  applicant_archetype: string;
  applicant_archetype_label: string;
  caseworker_persona: string;
  transcript: TurnDTO[];
};

const SCORING_PROMPT_TEMPLATE = [
  "Task: Score a SNAP applicant's performance across a practice interview transcript. Output one structured JSON object only.",
  "",
  "Context for this session: state {state_name}, scenario {scenario_label}, applicant self-described as {applicant_archetype_label}.",
  "",
  "Return JSON only:",
  "{",
  "  \"completeness\": {\"score\": 0.0, \"summary\": \"string\"},",
  "  \"accuracy_risk\": {\"score\": 0.0, \"summary\": \"string\"},",
  "  \"missing_context\": {\"score\": 0.0, \"summary\": \"string\"},",
  "  \"per_turn_notes\": [",
  "    {\"turn_index\": 0, \"applicant_text\": \"string\", \"note\": \"string\"}",
  "  ]",
  "}",
  "",
  "Scoring axes:",
  "- completeness: did the applicant answer what was asked? 1.0 means they addressed every question directly. 0.0 means they routinely deflected, gave non-answers, or stopped mid-thought. Penalize bare yes/no when the question demanded specifics.",
  "- accuracy_risk: how likely is anything the applicant said to be misread as fraud, inconsistency, or contradiction by a real caseworker? 0.0 is the safest. 1.0 means there are statements that an auditor would almost certainly flag. Specifically watch for: income amounts that drift across turns, household composition described differently in different answers, undisclosed assets or jobs, vague statements about who lives where.",
  "- missing_context: did the applicant fail to mention information that would help their application? 0.0 means they raised every salient point. 1.0 means they omitted material context (dependent children, eligible exemptions, special circumstances, applicable deductions) that the caseworker did not specifically ask about but that would matter for eligibility or processing speed.",
  "",
  "Each summary field must be 1-3 plain sentences citing specific applicant text or turn indices. Do not write generic praise or generic criticism.",
  "",
  "Hard constraints:",
  "1. Ground every claim in the transcript provided. Never invent applicant statements or attribute words to them.",
  "2. Use scenario-and-state context only to assess relevance — do not invent eligibility rules. If you would need to cite a specific income threshold or asset limit to justify a note, refer to it generically (\"the state-level income threshold\") instead.",
  "3. per_turn_notes must include one entry for every applicant turn in the transcript, in original order, with turn_index zero-indexed. If a turn was fine and unremarkable, set \"note\" to \"OK\".",
  "4. Each per-turn note is at most one sentence. Cite the specific issue, not a generic category.",
  "5. Scores are floats in [0.0, 1.0] inclusive. Do not return strings, percentages, or null.",
  "6. Do not include any prose outside the JSON object. No markdown, no commentary.",
  "7. Do not flag missing_context for topics the caseworker explicitly steered away from in the transcript.",
  "8. Treat the literal token [END_INTERVIEW] as a closing marker, not as applicant content.",
].join("\n");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);

  let payload: ScoreRequest;
  try {
    payload = (await req.json()) as ScoreRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const sessionID = clamp(payload.session_id, 80);
  if (!sessionID) return json({ error: "session_id is required" }, 400);

  const transcript = normalizeTranscript(payload.transcript);
  if (transcript.length === 0) return json({ error: "transcript is empty" }, 400);

  const systemPrompt = SCORING_PROMPT_TEMPLATE
    .replaceAll("{state_name}", clamp(payload.state_name, 60) || "the applicant's state")
    .replaceAll("{scenario_label}", clamp(payload.scenario_label, 80) || "SNAP eligibility")
    .replaceAll("{applicant_archetype_label}", clamp(payload.applicant_archetype_label, 120) || "a SNAP applicant");

  const transcriptText = formatTranscriptForScoring(transcript);

  const anthropic = new Anthropic({ apiKey });

  let completion;
  try {
    completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: transcriptText }],
    });
  } catch (err) {
    return json({ error: `Claude request failed: ${(err as Error).message}` }, 502);
  }

  const text = completion.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  if (!text) return json({ error: "Claude returned an empty response" }, 502);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJSONObject(text));
  } catch {
    return json({ error: "Failed to parse scoring JSON" }, 502);
  }

  return json({
    session_id: sessionID,
    completeness: normalizeAxis(parsed.completeness),
    accuracy_risk: normalizeAxis(parsed.accuracy_risk),
    missing_context: normalizeAxis(parsed.missing_context),
    per_turn_notes: normalizePerTurnNotes(parsed.per_turn_notes),
  });
});

function formatTranscriptForScoring(transcript: TurnDTO[]): string {
  let applicantIndex = 0;
  return transcript
    .map((t) => {
      if (t.role === "applicant") {
        const line = `[applicant turn ${applicantIndex}] ${t.text}`;
        applicantIndex += 1;
        return line;
      }
      return `[caseworker] ${t.text.replaceAll(END_INTERVIEW_TOKEN, "").trim()}`;
    })
    .join("\n");
}

function normalizeTranscript(input: TurnDTO[] | undefined): TurnDTO[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_TRANSCRIPT_TURNS)
    .map((t) => ({
      role: t?.role === "caseworker" ? "caseworker" as const : "applicant" as const,
      text: clamp(t?.text, MAX_TURN_CHARS),
    }))
    .filter((t) => t.text.length > 0);
}

function normalizeAxis(raw: unknown): { score: number; summary: string } {
  if (!raw || typeof raw !== "object") return { score: 0, summary: "" };
  const obj = raw as Record<string, unknown>;
  const rawScore = Number(obj.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0;
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  return { score, summary };
}

function normalizePerTurnNotes(raw: unknown): Array<{ turn_index: number; applicant_text: string; note: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const turnIndex = Number(obj.turn_index);
      if (!Number.isInteger(turnIndex) || turnIndex < 0) return null;
      return {
        turn_index: turnIndex,
        applicant_text: typeof obj.applicant_text === "string" ? obj.applicant_text : "",
        note: typeof obj.note === "string" ? obj.note : "",
      };
    })
    .filter((entry): entry is { turn_index: number; applicant_text: string; note: string } => entry !== null);
}

function extractJSONObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function clamp(value: unknown, maxChars: number): string {
  const trimmed = String(value ?? "").trim();
  return trimmed.slice(0, maxChars);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
