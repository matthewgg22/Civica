export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  SNAP_FERNET_KEY: string;
}

export type ActorKind = "applicant" | "navigator" | "admin" | "system" | "api_key";

export interface Actor {
  kind: ActorKind;
  id: string;
  orgId?: string;
}
