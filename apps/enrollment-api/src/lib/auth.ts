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
