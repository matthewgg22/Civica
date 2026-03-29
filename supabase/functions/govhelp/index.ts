const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GovHelpRole = "user" | "assistant";

type GovHelpConversationTurn = {
  role: GovHelpRole;
  content: string;
};

type GovHelpRepPayload = {
  rep_id: string;
  name: string;
  section_title: string;
  level: string;
  party?: string | null;
  district?: string | null;
  official_phone?: string | null;
  website_url?: string | null;
  contact_form_url?: string | null;
  reporting_destination_ids?: string[];
};

type GovHelpReportingDestination = {
  id: string;
  label: string;
  url: string;
};

type GovHelpRequest = {
  zip: string;
  user_message: string;
  conversation: GovHelpConversationTurn[];
  reps: GovHelpRepPayload[];
  reporting_destinations: GovHelpReportingDestination[];
};

type GovHelpStructuredResponse = {
  assistant_message: string;
  recommended_rep_ids: string[];
  reporting_destination_ids: string[];
};

type AuthUser = {
  id: string;
  isAnonymous: boolean;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistant_message: { type: "string" },
    recommended_rep_ids: {
      type: "array",
      items: { type: "string" },
    },
    reporting_destination_ids: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["assistant_message", "recommended_rep_ids", "reporting_destination_ids"],
};

const MODEL = "gpt-4.1-mini";
const MAX_USER_MESSAGE_CHARS = 1200;
const MAX_TURN_CHARS = 800;
const MAX_CONVERSATION_TURNS = 10;
const MAX_REPS = 80;
const MAX_REPORTING_DESTINATIONS = 40;
const RATE_LIMIT_WINDOW_SECONDS = envInt("GOVHELP_RATE_LIMIT_WINDOW_SECONDS", 3600, 60, 86400);
const RATE_LIMIT_USER_MAX = envInt("GOVHELP_RATE_LIMIT_USER_MAX", 20, 1, 500);
const RATE_LIMIT_IP_MAX = envInt("GOVHELP_RATE_LIMIT_IP_MAX", 60, 1, 2000);
const REQUIRE_NON_ANON = envFlag("GOVHELP_REQUIRE_NON_ANON", false);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authorization = req.headers.get("authorization") ?? "";
  const accessToken = extractBearerToken(authorization);
  if (!accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const authUser = await verifySupabaseAuth(accessToken);
  if (!authUser) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (REQUIRE_NON_ANON && authUser.isAnonymous) {
    return json({ error: "GovHelp requires a non-anonymous account." }, 403);
  }

  const clientIP = extractClientIP(req.headers);
  const rateLimit = await consumeGovHelpRateLimit(authUser.id, clientIP);
  if (!rateLimit.ok) {
    return json({ error: "Rate limit unavailable" }, 500);
  }
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, rateLimit.retryAfterSeconds);
    return json(
      {
        error: "Rate limit exceeded. Please try again shortly.",
        retry_after_seconds: retryAfter,
      },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured" }, 500);
  }

  let payload: GovHelpRequest;
  try {
    payload = (await req.json()) as GovHelpRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const userMessage = clampText(payload.user_message, MAX_USER_MESSAGE_CHARS);
  if (!userMessage) {
    return json({ error: "user_message is required" }, 400);
  }

  const reps = normalizeReps(payload.reps);
  if (reps.length === 0) {
    return json({ error: "No representatives in context. Load My Reps first." }, 400);
  }

  const conversation = normalizeConversation(payload.conversation);
  const reportingDestinations = normalizeReportingDestinations(payload.reporting_destinations);
  const zip = normalizeZip(payload.zip ?? "");
  const allowedRepIDs = new Set(reps.map((r) => r.rep_id).filter(Boolean));
  const allowedDestinationIDs = new Set(
    reportingDestinations.map((d) => d.id).filter(Boolean),
  );

  const compactRepsContext = reps.map((rep) => ({
    rep_id: rep.rep_id,
    name: rep.name,
    section_title: rep.section_title,
    level: rep.level,
    party: rep.party ?? null,
    district: rep.district ?? null,
    has_phone: !!rep.official_phone,
    has_website: !!rep.website_url,
    has_contact_form: !!rep.contact_form_url,
  }));

  const compactDestinationContext = reportingDestinations.map((d) => ({
    id: d.id,
    label: d.label,
    url: d.url,
  }));

  const systemPrompt = [
    "You are VoteNow GovHelp assistant.",
    "Rules:",
    "1) Do NOT invent phone numbers, emails, names, offices, or URLs.",
    "2) Recommend representatives ONLY by rep_id from the provided reps context.",
    "3) Recommend reporting destinations ONLY by id from provided reporting_destinations.",
    "4) Keep responses concise, practical, and civic-neutral.",
    "5) Always reinforce that casework is typically for constituents in the official's district.",
    "6) Always ask the user to confirm the ZIP used for this representatives lookup.",
    "7) If the issue is unclear, ask one clarifying question and provide 1-3 likely rep_id options.",
  ].join("\n");

  const history = conversation
    .map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: [{ type: "input_text", text: turn.content }],
    }));

  const contextMessage = [
    `ZIP in context: ${zip || "unknown"}`,
    "Representatives context JSON:",
    JSON.stringify(compactRepsContext),
    "Reporting destinations JSON:",
    JSON.stringify(compactDestinationContext),
    "Latest user request:",
    userMessage,
  ].join("\n");

  const openAIRequestBody = {
    model: MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      ...history,
      {
        role: "user",
        content: [{ type: "input_text", text: contextMessage }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "govhelp_response",
        strict: true,
        schema: responseSchema,
      },
    },
  };

  const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(openAIRequestBody),
    signal: AbortSignal.timeout(15000),
  });

  if (!openAIResponse.ok) {
    return json({ error: "OpenAI request failed" }, 502);
  }

  let openAIJson: Record<string, unknown>;
  try {
    openAIJson = (await openAIResponse.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "OpenAI returned non-JSON response" }, 502);
  }

  const outputText = extractOutputText(openAIJson);
  if (!outputText) {
    return json({ error: "OpenAI structured output missing" }, 502);
  }

  let parsed: GovHelpStructuredResponse;
  try {
    parsed = JSON.parse(outputText) as GovHelpStructuredResponse;
  } catch {
    return json({ error: "Failed to parse structured output" }, 502);
  }

  const recommendedRepIDs = uniqueStrings(parsed.recommended_rep_ids)
    .filter((id) => allowedRepIDs.has(id))
    .slice(0, 6);

  const reportingDestinationIDs = uniqueStrings(parsed.reporting_destination_ids)
    .filter((id) => allowedDestinationIDs.has(id))
    .slice(0, 4);

  const caseworkNotice = "Casework is typically handled only for constituents in that official's district.";
  const zipPrompt = zip
    ? `Please confirm you're using ZIP ${zip} for this lookup.`
    : "Please confirm the ZIP used to retrieve your representatives.";

  const baseAssistantMessage = String(parsed.assistant_message ?? "").trim();
  const mergedAssistantMessage = enforceGuidance(baseAssistantMessage, caseworkNotice, zipPrompt);

  return json({
    assistant_message: mergedAssistantMessage,
    recommended_rep_ids: recommendedRepIDs,
    reporting_destination_ids: reportingDestinationIDs,
  });
});

function extractBearerToken(rawAuthorization: string): string | null {
  const trimmed = String(rawAuthorization ?? "").trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function verifySupabaseAuth(accessToken: string): Promise<AuthUser | null> {
  const supabaseURL = String(Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = String(Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  if (!supabaseURL || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseURL}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;

  let payload: Record<string, unknown>;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!id) return null;
  const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
  const provider = typeof appMetadata?.provider === "string"
    ? appMetadata.provider.toLowerCase()
    : "";
  const isAnonymous = payload.is_anonymous === true || provider === "anonymous";
  return { id, isAnonymous };
}

function extractOutputText(openAIJson: Record<string, unknown>): string | null {
  const direct = openAIJson.output_text;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct;
  }

  const output = openAIJson.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

function normalizeZip(raw: string): string {
  const digits = String(raw ?? "").replace(/\D+/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

function clampText(value: string | undefined | null, maxChars: number): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, maxChars);
}

function normalizeConversation(input: GovHelpConversationTurn[] | undefined): GovHelpConversationTurn[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(-MAX_CONVERSATION_TURNS)
    .map((turn) => ({
      role: turn?.role === "assistant" ? "assistant" : "user",
      content: clampText(turn?.content, MAX_TURN_CHARS),
    }))
    .filter((turn) => turn.content.length > 0);
}

function normalizeReps(input: GovHelpRepPayload[] | undefined): GovHelpRepPayload[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_REPS)
    .map((rep) => ({
      rep_id: clampText(rep?.rep_id, 120),
      name: clampText(rep?.name, 120),
      section_title: clampText(rep?.section_title, 120),
      level: clampText(rep?.level, 40),
      party: clampText(rep?.party ?? undefined, 40) || null,
      district: clampText(rep?.district ?? undefined, 40) || null,
      official_phone: clampText(rep?.official_phone ?? undefined, 40) || null,
      website_url: clampText(rep?.website_url ?? undefined, 240) || null,
      contact_form_url: clampText(rep?.contact_form_url ?? undefined, 240) || null,
      reporting_destination_ids: Array.isArray(rep?.reporting_destination_ids)
        ? rep.reporting_destination_ids.map((id) => clampText(id, 80)).filter(Boolean).slice(0, 20)
        : [],
    }))
    .filter((rep) => rep.rep_id.length > 0 && rep.name.length > 0);
}

function normalizeReportingDestinations(
  input: GovHelpReportingDestination[] | undefined,
): GovHelpReportingDestination[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_REPORTING_DESTINATIONS)
    .map((destination) => ({
      id: clampText(destination?.id, 80),
      label: clampText(destination?.label, 120),
      url: clampText(destination?.url, 240),
    }))
    .filter((destination) => destination.id.length > 0 && destination.url.length > 0);
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function enforceGuidance(baseMessage: string, caseworkNotice: string, zipPrompt: string): string {
  const lower = baseMessage.toLowerCase();
  const lines: string[] = [];

  if (!lower.includes("constituent")) {
    lines.push(caseworkNotice);
  }

  if (!lower.includes("zip")) {
    lines.push(zipPrompt);
  }

  if (baseMessage.trim().length > 0) {
    lines.push(baseMessage.trim());
  }

  return lines.join("\n\n");
}

type GovHelpRateLimitResult = {
  ok: boolean;
  allowed: boolean;
  retryAfterSeconds: number;
};

async function consumeGovHelpRateLimit(
  userID: string,
  ipAddress: string | null,
): Promise<GovHelpRateLimitResult> {
  const supabaseURL = String(Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseURL || !serviceRoleKey) {
    return { ok: false, allowed: false, retryAfterSeconds: 0 };
  }

  const response = await fetch(`${supabaseURL}/rest/v1/rpc/consume_govhelp_rate_limit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      p_user_id: userID,
      p_ip: ipAddress,
      p_user_limit: RATE_LIMIT_USER_MAX,
      p_ip_limit: RATE_LIMIT_IP_MAX,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return { ok: false, allowed: false, retryAfterSeconds: 0 };
  }

  let rawPayload: unknown;
  try {
    rawPayload = await response.json();
  } catch {
    return { ok: false, allowed: false, retryAfterSeconds: 0 };
  }

  const payload = normalizeRateLimitPayload(rawPayload);
  if (!payload) {
    return { ok: false, allowed: false, retryAfterSeconds: 0 };
  }

  return {
    ok: true,
    allowed: payload.allowed === true,
    retryAfterSeconds: Math.max(0, Number(payload.retry_after_seconds ?? 0) || 0),
  };
}

function normalizeRateLimitPayload(rawPayload: unknown): Record<string, unknown> | null {
  if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
    return rawPayload as Record<string, unknown>;
  }

  if (Array.isArray(rawPayload)) {
    const first = rawPayload[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
  }

  return null;
}

function extractClientIP(headers: Headers): string | null {
  const candidates = [
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("cf-connecting-ip"),
  ];

  for (const rawValue of candidates) {
    if (!rawValue) continue;
    const first = rawValue.split(",")[0]?.trim() ?? "";
    const normalized = normalizeIPAddress(first);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeIPAddress(raw: string): string | null {
  let value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  } else if (value.includes(".") && value.split(":").length === 2) {
    value = value.split(":")[0].trim();
  }

  value = value.split("%")[0].trim();
  if (!value) return null;
  if (isIPv4(value) || isLikelyIPv6(value)) return value;
  return null;
}

function isIPv4(value: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  return value.split(".").every((part) => {
    const number = Number(part);
    return Number.isInteger(number) && number >= 0 && number <= 255;
  });
}

function isLikelyIPv6(value: string): boolean {
  return value.includes(":") && /^[0-9a-fA-F:]+$/.test(value);
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const rawValue = String(Deno.env.get(name) ?? "").trim().toLowerCase();
  if (!rawValue) return defaultValue;
  if (["1", "true", "yes", "on"].includes(rawValue)) return true;
  if (["0", "false", "no", "off"].includes(rawValue)) return false;
  return defaultValue;
}

function envInt(name: string, defaultValue: number, min: number, max: number): number {
  const rawValue = String(Deno.env.get(name) ?? "").trim();
  if (!rawValue) return defaultValue;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
