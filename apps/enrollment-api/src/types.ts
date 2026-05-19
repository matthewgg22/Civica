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
