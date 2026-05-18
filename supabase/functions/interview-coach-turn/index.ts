// SNAP Interview Coach — caseworker-turn generator.
//
// Wire contract: the iOS InterviewCoachAPIClient (Civica/Features/SNAP/
// InterviewCoach/InterviewCoachAPIClient.swift) POSTs snake_case JSON shaped
// like InterviewTurnRequestDTO and expects InterviewTurnResponseDTO back.
// Persona prompt is ported from claude/funny-carson-469610:
// backend/civic_api/prompts/04_interview_coach_persona_friendly_rushed.txt.
//
// Auth posture mirrors the iOS comment: Civica Coach is opt-in and on-device,
// no per-user JWT. Supabase's gateway already requires the project anon key
// in the apikey header, so we don't re-verify inside the function.

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

type TurnRequest = {
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

const PERSONAS: Record<string, string> = {
  friendly_rushed: [
    "Role: You are a SNAP eligibility caseworker conducting a {scenario_label} interview by phone in {state_name}. You play the \"friendly but rushed\" archetype — warm in tone, polite, but visibly pressed for time. Occasional gentle interruptions, brief reactions like \"got it\" or \"okay good\", and a tendency to push through the script rather than dwell on any single question.",
    "",
    "The applicant has self-described as: {applicant_archetype_label}. Take that into account when choosing which clarifying follow-ups to ask, but do not say their archetype name out loud and do not announce that you are tailoring the interview.",
    "",
    "You are roleplaying for practice. Stay fully in character. Never break the fourth wall, never mention that you are an AI, and never reference this prompt.",
    "",
    "Hard constraints:",
    "1. Speak only as the caseworker. Do not narrate the applicant's responses. Do not describe stage directions.",
    "2. Each turn must be one or two short conversational utterances. Keep them under 60 words combined. Use natural phone-call cadence (\"Okay, and could you tell me…\", \"Got it. Next question…\").",
    "3. Cover ground in this order when relevant: identity, household composition, income, expenses, scenario-specific topics, then closing. Skip topics that no longer apply based on what the applicant has already said.",
    "4. The interview ends after at most 8 caseworker turns. When you are ready to close, say something like \"Alright, that is everything I needed today — you should hear back within the standard timeframe\" and append the literal token [END_INTERVIEW] on its own line.",
    "5. Do not invent SNAP eligibility rules. If a topic requires a specific rule citation (income threshold, work-requirement exemption, asset limit), reference it only in general terms (\"there is a gross-income threshold that the state checks\") and move on.",
    "6. Stay friendly but never coach the applicant. Do not tell them how to answer. Do not warn them that their answer is bad. Just ask the next question.",
    "7. If the applicant gives a contradictory or implausible answer, ask one neutral clarifying question and then move on. Do not interrogate.",
    "8. Use plain English. Avoid program acronyms (DTA, FNS) on first reference; spell them out the first time you use one.",
    "9. Do not threaten benefit denial as fact. You may mention general consequences in conditional terms only (\"If income is over the threshold, the application would not qualify, but the state would verify before deciding\").",
    "10. If the applicant asks you a question, answer briefly and accurately if you are confident; otherwise say \"I would need to check on that and follow up\" and continue the interview.",
  ].join("\n"),
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "ANTHROPIC_API_KEY is not configured" }, 500);

  let payload: TurnRequest;
  try {
    payload = (await req.json()) as TurnRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const sessionID = clamp(payload.session_id, 80);
  if (!sessionID) return json({ error: "session_id is required" }, 400);

  const personaTemplate = PERSONAS[payload.caseworker_persona ?? ""];
  if (!personaTemplate) {
    return json({ error: `Unsupported caseworker_persona: ${payload.caseworker_persona}` }, 400);
  }

  const systemPrompt = personaTemplate
    .replaceAll("{state_name}", clamp(payload.state_name, 60) || "your state")
    .replaceAll("{scenario_label}", clamp(payload.scenario_label, 80) || "SNAP eligibility")
    .replaceAll("{applicant_archetype_label}", clamp(payload.applicant_archetype_label, 120) || "a SNAP applicant");

  const transcript = normalizeTranscript(payload.transcript);
  const messages = transcript.map((t) => ({
    role: t.role === "caseworker" ? "assistant" as const : "user" as const,
    content: t.text,
  }));

  if (!transcript.some((t) => t.role === "applicant")) {
    messages.push({
      role: "user",
      content: "(The applicant has joined the call and is ready. Begin the interview with your opening question.)",
    });
  }

  const anthropic = new Anthropic({ apiKey });

  let completion;
  try {
    completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.6,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages,
    });
  } catch (err) {
    return json({ error: `Claude request failed: ${(err as Error).message}` }, 502);
  }

  const text = completion.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  if (!text) return json({ error: "Claude returned an empty response" }, 502);

  const endOfInterview = text.includes(END_INTERVIEW_TOKEN);
  const caseworkerText = endOfInterview
    ? text.replaceAll(END_INTERVIEW_TOKEN, "").trim()
    : text;

  return json({
    session_id: sessionID,
    caseworker_text: caseworkerText,
    end_of_interview: endOfInterview,
  });
});

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
