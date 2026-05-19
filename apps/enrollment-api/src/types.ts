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
}

export interface Variables {
  log: import("./lib/logger.js").Logger;
  requestId: string;
}

export type ActorKind = "applicant" | "navigator" | "admin" | "system" | "api_key";

export interface Actor {
  kind: ActorKind;
  id: string;
  orgId?: string;
}
