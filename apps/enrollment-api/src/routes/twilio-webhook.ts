import { Hono } from "hono";
import { makeServiceClient } from "../lib/supabase.js";
import type { Env, Variables } from "../types.js";
import {
  LiveTwilioAdapter,
  NoopTwilioAdapter,
  TwilioWebhookBodySchema,
} from "@civica/recert-engine/outreach";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// POST /webhooks/twilio/sms
//
// Receives inbound SMS from Twilio. Validates the Twilio signature, parses
// the keyword (STOP / START / HELP), updates the opt-out registry, and
// returns TwiML <Response/> (empty response — Twilio handles carrier-level
// STOP/HELP replies automatically).
//
// This route is intentionally NOT behind authMiddleware — Twilio webhooks
// carry their own HMAC signature instead of a Supabase JWT.
// ---------------------------------------------------------------------------

/**
 * Build the TwiML empty response that tells Twilio: "we got it, no reply."
 * For STOP, Twilio's carrier-level opt-out handles the confirmatory reply.
 */
function emptyTwiML(): Response {
  return new Response("<Response/>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

app.post("/webhooks/twilio/sms", async (c) => {
  // Parse form body sent by Twilio
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (err) {
    c.get("log")?.error("twilio webhook parse failed", {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
      stage: "formData",
    });
    return c.text("Bad Request: expected form body", 400);
  }

  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") raw[key] = value;
  });

  const parseResult = TwilioWebhookBodySchema.safeParse(raw);
  if (!parseResult.success) {
    return c.text("Bad Request: invalid webhook payload", 400);
  }
  const webhookBody = parseResult.data;

  // Validate Twilio signature when running in production mode.
  // In development (RECERT_TWILIO_ENABLED !== 'true') we skip validation so
  // local testing doesn't require a real Twilio account.
  if (c.env.RECERT_TWILIO_ENABLED === "true") {
    const accountSid = c.env.TWILIO_ACCOUNT_SID;
    const authToken = c.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return c.text("Server misconfiguration: missing Twilio credentials", 500);
    }

    // Lazy import twilio for signature validation (same lazy pattern as LiveTwilioAdapter).
    const { validateRequest } = await import("twilio").then((m) => m.default ?? m);

    const twilioSignature = c.req.header("X-Twilio-Signature") ?? "";
    const url = c.req.url;

    const isValid = validateRequest(authToken, twilioSignature, url, raw);
    if (!isValid) {
      return c.text("Forbidden: invalid Twilio signature", 403);
    }
  }

  // Route keyword to adapter
  const useLive = c.env.RECERT_TWILIO_ENABLED === "true";

  if (useLive) {
    const fromNumber = c.env.TWILIO_FROM_NUMBER;
    if (!c.env.TWILIO_ACCOUNT_SID || !c.env.TWILIO_AUTH_TOKEN || !fromNumber) {
      return c.text("Server misconfiguration: missing Twilio env vars", 500);
    }

    const db = makeServiceClient(c.env);
    const adapter = new LiveTwilioAdapter(
      {
        accountSid: c.env.TWILIO_ACCOUNT_SID,
        authToken: c.env.TWILIO_AUTH_TOKEN,
        fromNumber: fromNumber as `+${string}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
    );
    await adapter.handleWebhook(webhookBody);
  } else {
    // Dev/test: NoopAdapter — just log, no side effects
    const noop = new NoopTwilioAdapter();
    const keyword = webhookBody.Body.trim().toUpperCase();
    if (keyword === "STOP" || keyword === "STOPALL" || keyword === "UNSUBSCRIBE" || keyword === "CANCEL" || keyword === "END" || keyword === "QUIT") {
      await noop.recordOptOut(webhookBody.From as `+${string}`);
    } else if (keyword === "START" || keyword === "UNSTOP" || keyword === "YES") {
      await noop.recordOptIn(webhookBody.From as `+${string}`);
    }
  }

  return emptyTwiML();
});

export default app;
