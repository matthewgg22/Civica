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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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

  const userMessage = (payload.user_message ?? "").trim();
  if (!userMessage) {
    return json({ error: "user_message is required" }, 400);
  }

  const reps = Array.isArray(payload.reps) ? payload.reps : [];
  if (reps.length === 0) {
    return json({ error: "No representatives in context. Load My Reps first." }, 400);
  }

  const zip = normalizeZip(payload.zip ?? "");
  const allowedRepIDs = new Set(reps.map((r) => r.rep_id).filter(Boolean));
  const allowedDestinationIDs = new Set(
    (payload.reporting_destinations ?? []).map((d) => d.id).filter(Boolean),
  );

  const compactRepsContext = reps.slice(0, 80).map((rep) => ({
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

  const compactDestinationContext = (payload.reporting_destinations ?? []).map((d) => ({
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

  const history = (payload.conversation ?? [])
    .slice(-10)
    .map((turn) => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: [{ type: "input_text", text: String(turn.content ?? "") }],
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
  });

  if (!openAIResponse.ok) {
    const failureText = await openAIResponse.text();
    return json({ error: `OpenAI request failed: ${failureText}` }, 502);
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
