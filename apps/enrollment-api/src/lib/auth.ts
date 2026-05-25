import { HTTPException } from "hono/http-exception";
import type { ActorKind } from "../types.js";

/** Allows navigator and admin. Rejects applicant, buddy, system, api_key. */
export function requireNavigator(actorKind: ActorKind): void {
  if (actorKind !== "navigator" && actorKind !== "admin") {
    throw new HTTPException(403, { message: "Navigator role required" });
  }
}

/** Allows applicant only. */
export function requireApplicant(actorKind: ActorKind): void {
  if (actorKind !== "applicant") {
    throw new HTTPException(403, { message: "This endpoint is for applicants only" });
  }
}

/** Allows buddy only. */
export function requireBuddy(actorKind: ActorKind): void {
  if (actorKind !== "buddy") {
    throw new HTTPException(403, { message: "Buddy role required" });
  }
}

/**
 * Allows operator only.
 *
 * Operator is Civica's corporate/internal role for /ops dashboard access.
 * Set via app_metadata.role = 'operator' through the Supabase Admin API.
 * Membership is managed manually (no self-serve); see ceo-plans/
 * 2026-05-25-ebt-monetization-dashboard.md.
 *
 * Every /ops/* endpoint must call this before any service-role query runs.
 * The dashboard middleware also gates /ops/* routes; this is the second layer.
 */
export function requireOperator(actorKind: ActorKind): void {
  if (actorKind !== "operator") {
    throw new HTTPException(403, { message: "Operator role required" });
  }
}
