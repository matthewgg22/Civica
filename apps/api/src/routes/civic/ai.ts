// POST /api/issue-classify | /api/issue-brief | /api/v1/civic/assistant/resolve
import { Hono } from "hono";
import { createHash } from "node:crypto";
import { z } from "zod";
import OpenAI from "openai";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const aiRouter = new Hono<AuthEnv>();

// ── OpenAI client (lazy — safe to import even when key is absent) ──────────
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
  return _openai;
}

const model = () => process.env["VOTENOW_OPENAI_MODEL"] ?? "gpt-4o-mini";

// ── Safety identifier ──────────────────────────────────────────────────────
function safetyId(userId: string): string {
  const salt = process.env["VOTENOW_SAFETY_SALT"] ?? "civic";
  return createHash("sha256").update(`${salt}:${userId}`).digest("hex").slice(0, 16);
}

// ── Text classification helpers ────────────────────────────────────────────
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "my", "i", "we", "our", "their",
  "about", "that", "this", "be", "are", "was", "were", "have", "has", "had",
  "will", "would", "can", "could", "should", "do", "does", "did", "not", "no",
  "me", "us", "you", "he", "she", "they", "what", "which", "who", "how",
  "when", "where", "why", "if", "then", "so", "as", "up", "out", "than",
  "more", "just", "also", "get", "any", "all", "its",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  );
}

type IssueCore = {
  canonical_issue: string;
  title: string;
  category: string | null;
  overview: string | null;
  tags: string[];
  synonyms: string[];
};

function scoreIssue(concernTokens: Set<string>, concernText: string, issue: IssueCore): number {
  const candidateTokens = tokenize(
    [issue.canonical_issue, issue.title, ...(issue.tags ?? []), ...(issue.synonyms ?? [])].join(" "),
  );

  let score = 0;
  for (const t of concernTokens) {
    if (candidateTokens.has(t)) score += 1;
  }

  // Phrase hits: +2 per matching phrase (title or synonym substring)
  const normConcern = concernText.toLowerCase();
  for (const phrase of [issue.title, ...(issue.synonyms ?? [])]) {
    if (phrase && normConcern.includes(phrase.toLowerCase())) score += 2;
  }

  return score;
}

async function classifyIssue(concernText: string): Promise<{
  status: "ok" | "needs_clarification" | "refused";
  canonical_issue: string;
  confidence: number;
  clarification_question: string | null;
  candidate_issues: string[];
  policy_flags: string[];
}> {
  const { data: issues, error } = await supabaseAdmin
    .from("issue_core")
    .select("canonical_issue, title, category, overview, tags, synonyms");

  if (error || !issues?.length) {
    return {
      status: "needs_clarification",
      canonical_issue: "general-civic-issue",
      confidence: 0,
      clarification_question: "Could you tell me more about the specific policy issue you'd like to address?",
      candidate_issues: [],
      policy_flags: [],
    };
  }

  const concernTokens = tokenize(concernText);
  const scored = (issues as IssueCore[])
    .map((issue) => ({ issue, score: scoreIssue(concernTokens, concernText, issue) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runner = scored[1];

  const topScore = top?.score ?? 0;

  if (topScore <= 1 || (runner && runner.score >= topScore * 0.75)) {
    return {
      status: "needs_clarification",
      canonical_issue: top?.issue.canonical_issue ?? "general-civic-issue",
      confidence: 0,
      clarification_question: "Could you clarify which specific policy area you're most focused on?",
      candidate_issues: scored.slice(0, 3).map((s) => s.issue.canonical_issue),
      policy_flags: [],
    };
  }

  const confidence = Math.min(topScore / (topScore + 5), 0.99);

  return {
    status: "ok",
    canonical_issue: top!.issue.canonical_issue,
    confidence: Math.round(confidence * 100) / 100,
    clarification_question: null,
    candidate_issues: scored.slice(0, 3).map((s) => s.issue.canonical_issue),
    policy_flags: [],
  };
}

// ── POST /api/issue-classify ───────────────────────────────────────────────
const ClassifySchema = z.object({
  concern_text: z.string().default(""),
  requested_output: z.string().optional(),
});

aiRouter.post("/api/issue-classify", requireAuth, async (c) => {
  const body = ClassifySchema.parse(await c.req.json());
  const result = await classifyIssue(body.concern_text);
  return c.json(result);
});

// ── POST /api/issue-brief ──────────────────────────────────────────────────
const BriefSchema = z.object({
  concern_text: z.string().default(""),
  requested_output: z.string().optional(),
  allow_revision: z.boolean().default(true),
});

aiRouter.post("/api/issue-brief", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = BriefSchema.parse(await c.req.json());
  const sid = safetyId(userId);

  // Persist the request
  const { data: reqRow } = await supabaseAdmin
    .from("brief_request")
    .insert({
      user_id: userId,
      safety_identifier: sid,
      concern_text: body.concern_text,
      requested_output: body.requested_output ?? null,
      allow_revision: body.allow_revision,
    })
    .select("id")
    .single();

  const requestId = reqRow?.id;

  // Classify
  const classification = await classifyIssue(body.concern_text);

  if (classification.status === "refused") {
    return c.json({ status: "refused", policy_flags: classification.policy_flags });
  }

  if (classification.status === "needs_clarification" && !body.allow_revision) {
    return c.json({
      status: "needs_clarification",
      clarification_question: classification.clarification_question,
      candidate_issues: classification.candidate_issues,
      policy_flags: [],
    });
  }

  const canonicalIssue = classification.canonical_issue;

  // Load evidence
  const { data: evidence } = await supabaseAdmin
    .from("issue_evidence_item")
    .select("evidence_id, source_name, source_url, published_at, claim, evidence_type, supports_view")
    .eq("canonical_issue", canonicalIssue)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(8);

  const evidencePacket = (evidence ?? [])
    .map((e, i) => `[${i + 1}] ${e.claim} (${e.source_name}${e.published_at ? ", " + e.published_at.slice(0, 10) : ""})`)
    .join("\n");

  // Call OpenAI
  type BriefResult = {
    summary_neutral: string;
    current_status: string;
    key_facts: Array<{ fact: string; source_name: string; source_url: string | null; published_at: string | null }>;
    arguments_by_view: Array<{ view: string; argument: string }>;
    unknowns: string[];
    questions_to_consider: string[];
  };

  let briefResult: BriefResult | null = null;
  let llmModel = "";
  let llmUsage: Record<string, number> = {};

  const apiKey = process.env["OPENAI_API_KEY"];
  const briefEnabled = process.env["VOTENOW_ENABLE_OPENAI_ISSUE_BRIEF"] !== "false";

  if (apiKey && briefEnabled) {
    try {
      const completion = await getOpenAI().chat.completions.create({
        model: model(),
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Create source-grounded issue briefings. Output strict JSON only.",
          },
          {
            role: "user",
            content: [
              `Concern: ${body.concern_text}`,
              `Canonical issue: ${canonicalIssue}`,
              `Evidence packet:\n${evidencePacket || "No evidence available."}`,
              "",
              'Return a JSON object with keys: "summary_neutral" (max 800 chars), ' +
              '"current_status" (max 500 chars), ' +
              '"key_facts" (array of {fact, source_name, source_url, published_at}, 1-6 items), ' +
              '"arguments_by_view" (array of {view, argument}, 2-4 items), ' +
              '"unknowns" (string array, 1-6 items), ' +
              '"questions_to_consider" (string array, 2-6 items).',
            ].join("\n"),
          },
        ],
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      briefResult = JSON.parse(raw) as BriefResult;
      llmModel = completion.model;
      llmUsage = {
        prompt_tokens: completion.usage?.prompt_tokens ?? 0,
        completion_tokens: completion.usage?.completion_tokens ?? 0,
        total_tokens: completion.usage?.total_tokens ?? 0,
      };
    } catch (err) {
      console.error("issue-brief OpenAI call failed", err);
    }
  }

  // Deterministic fallback
  if (!briefResult) {
    const topEvidence = (evidence ?? []).slice(0, 3);
    briefResult = {
      summary_neutral: `This briefing covers the policy area: ${canonicalIssue}.`,
      current_status: "Status information is currently unavailable.",
      key_facts: topEvidence.map((e) => ({
        fact: e.claim,
        source_name: e.source_name,
        source_url: e.source_url ?? null,
        published_at: e.published_at ?? null,
      })),
      arguments_by_view: [
        { view: "Supporters' perspective", argument: "Proponents argue this policy benefits constituents." },
        { view: "Skeptics' perspective", argument: "Critics raise concerns about implementation and cost." },
      ],
      unknowns: ["Long-term fiscal impact", "Implementation timeline"],
      questions_to_consider: [
        "How does this affect your district specifically?",
        "What local resources are available?",
      ],
    };
  }

  const responseJson = {
    status: classification.status === "needs_clarification" ? "needs_clarification" : "ok",
    canonical_issue: canonicalIssue,
    policy_flags: classification.policy_flags,
    clarification_question: classification.clarification_question,
    ...briefResult,
  };

  if (requestId) {
    await supabaseAdmin.from("brief_response").insert({
      request_id: requestId,
      user_id: userId,
      safety_identifier: sid,
      status: responseJson.status.toUpperCase(),
      canonical_issue: canonicalIssue,
      response_json: responseJson,
      llm_model: llmModel || null,
      llm_usage: llmUsage,
    });
  }

  return c.json(responseJson);
});

// ── POST /api/v1/civic/assistant/resolve ──────────────────────────────────
const ResolveSchema = z.object({
  concern_text: z.string().min(1),
  selected_ask: z.string().min(1),
  target_reps: z.array(z.string()).optional(),
  optional_bill_ref: z.string().nullable().optional(),
});

const REQUIRED_TOKENS = ["{OFFICE_TYPE}", "{REP_NAME}"];

aiRouter.post("/api/v1/civic/assistant/resolve", requireAuth, async (c) => {
  const body = ResolveSchema.parse(await c.req.json());

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    return c.json(
      { code: "service_unavailable", message: "AI service not configured" },
      503,
    );
  }

  const repNames = body.target_reps?.join(", ") ?? "your representatives";
  const billRef = body.optional_bill_ref ? `Bill reference: ${body.optional_bill_ref}` : "";

  const scriptInstruction = body.optional_bill_ref
    ? `Generate scripts specifically referencing ${body.optional_bill_ref}. Keep messaging focused on this bill.`
    : `Generate scripts addressing the broad concern. Keep messaging accessible and action-oriented.`;

  type Draft = {
    issue_title: string;
    issue_summary: string;
    background: string;
    live_script_template: string;
    voicemail_script_template: string;
    talking_points: string[];
  };

  let draft: Draft;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: model(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a U.S. civic call assistant. Return strict JSON only, no markdown. " +
            "Write plain-language content at about a 6th-8th grade reading level. " +
            "Keep scripts concise and phone-ready.",
        },
        {
          role: "user",
          content: [
            "Generate a civic call draft from this user request.",
            `Concern: ${body.concern_text}`,
            `Explicit ask: ${body.selected_ask}`,
            `Primary targets: ${repNames}`,
            billRef,
            "",
            scriptInstruction,
            "",
            "Return a JSON object with these keys:",
            '- "issue_title": short title (≤ 9 words)',
            '- "issue_summary": 2-4 plain sentences',
            '- "background": 2-4 factual context sentences',
            '- "live_script_template": include placeholders {OFFICE_TYPE}, {REP_NAME}, {ASK_ACTION}, {LOCATION}, {BILL_OR_ISSUE}. Min 35 words, max 120 words.',
            '- "voicemail_script_template": same placeholders. Min 18 words, max 75 words.',
            '- "talking_points": array of exactly 4 short bullets (max 16 words each)',
            "",
            "Do not use placeholders outside the exact tokens listed above.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    draft = JSON.parse(raw) as Draft;

    // Validate required template tokens
    for (const token of REQUIRED_TOKENS) {
      if (!draft.live_script_template?.includes(token)) {
        draft.live_script_template = `${token} — ${draft.live_script_template ?? ""}`;
      }
      if (!draft.voicemail_script_template?.includes(token)) {
        draft.voicemail_script_template = `${token} — ${draft.voicemail_script_template ?? ""}`;
      }
    }
  } catch (err) {
    console.error("assistant/resolve OpenAI call failed", err);
    return c.json({ code: "internal_error", message: "Failed to generate draft" }, 500);
  }

  return c.json({ status: "ok", ...draft });
});
