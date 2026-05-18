export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  SNAP_FERNET_KEY: string;
  SENTRY_DSN: string;
  /** Temporary: set to "1" to enable /debug/sentry-check — remove before prod. */
  SENTRY_CHECK_ENABLED?: string;
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
