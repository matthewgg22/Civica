export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  SNAP_FERNET_KEY: string;
  SENTRY_DSN: string;
  // T9: address-validation integration stub. Off unless explicitly "true".
  ENABLE_ADDRESS_VALIDATION?: string;
  USPS_CLIENT_ID?: string;
  USPS_CLIENT_SECRET?: string;
  // T14: Twilio recertification outreach. Off unless RECERT_TWILIO_ENABLED="true".
  RECERT_TWILIO_ENABLED?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  // T15: AI-powered recert practice interview. Off unless RECERT_AI_ENABLED="true".
  RECERT_AI_ENABLED?: string;
  ANTHROPIC_API_KEY?: string;
  // T-DR3-8: Argyle webhook signature verification (optional; skip if absent in dev).
  ARGYLE_WEBHOOK_SECRET?: string;
  // T-DR3-9: Canvas LMS OAuth integration (optional; 503 if absent).
  CANVAS_CLIENT_ID?: string;
  CANVAS_CLIENT_SECRET?: string;
  CANVAS_INSTANCE_URL?: string;
  CANVAS_REDIRECT_URI?: string;
  // Session M1: BenefitsCal Phase 2 CBO Manager portal credentials.
  // Optional in types so dev/test can run without them. The submitter
  // throws cleanly at runtime if either is missing in production.
  BENEFITSCAL_CBO_USERNAME?: string;
  BENEFITSCAL_CBO_PASSWORD?: string;
  BENEFITSCAL_BASE_URL?: string;
  // TODO-15: Browserless.io driver for Phase 2 BenefitsCal submission.
  // When set, the route auto-builds a browserlessDriverFactory and the
  // submitter drives the portal via Browserless. When absent, the route
  // marks newly queued rows failed with DRIVER_NOT_WIRED (graceful degrade).
  BROWSERLESS_API_KEY?: string;
  // Verification API integrations (Phase 1). Optional — features degrade
  // gracefully to null when keys are absent.
  HUD_TOKEN?: string;
  SMARTY_AUTH_ID?: string;
  SMARTY_AUTH_TOKEN?: string;
  // Buddy Add feature (BUDDY_ADD_ENABLED). Off unless "true".
  BUDDY_ADD_ENABLED?: string;
  // Dedicated signing key for buddy invite JWTs (separate from SNAP_FERNET_KEY).
  // Set via: wrangler secret put BUDDY_JWT_SECRET
  BUDDY_JWT_SECRET?: string;
  // Rate-limit bindings (TODO-2). 10/min for token/account-sensitive endpoints,
  // 60/min for mutating applicant endpoints. See wrangler.toml + lib/rate-limit.ts.
  // Optional in the type so vitest mocks and pre-deploy environments don't have
  // to stub them. lib/rate-limit.ts no-ops cleanly when a binding is absent.
  RL_STRICT?: RateLimit;
  RL_STANDARD?: RateLimit;
}

export interface Variables {
  log: import("./lib/logger.js").Logger;
  requestId: string;
}

export type ActorKind = "applicant" | "navigator" | "admin" | "system" | "api_key" | "buddy";

export interface Actor {
  kind: ActorKind;
  id: string;
  orgId?: string;
  buddy_relationship_id?: string;
}
