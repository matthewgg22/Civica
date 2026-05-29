/**
 * Extension auth resolver — accepts EITHER auth method on /extension/* routes:
 *
 *   1. Legacy shared bearer token (EXTENSION_BEARER_TOKEN). DEPRECATED — kept
 *      working for back-compat until the extension fully migrates to device-
 *      flow tokens. A shared-token request is org-AGNOSTIC: it may touch any
 *      packet (the original MVP posture).
 *
 *   2. Per-CBO device-flow access token (issue #317 / RFC 8628). Org-SCOPED:
 *      the resolved org_id pins which packets the request may read/write. Any
 *      packet outside that org is invisible (404), never leaked.
 *
 * Resolution order: try the device token first (a real per-CBO credential),
 * fall back to the shared token. Returns a discriminated result the route uses
 * to (a) set the right audit actor and (b) decide whether to enforce org
 * scoping on the target packet.
 *
 * SECURITY: this is the auth boundary for the extension surface. The device-
 * token path delegates to resolveDeviceAccessToken (hash + expiry + revocation
 * checks). The shared-token path is a constant-time-ish exact compare. Neither
 * path logs the presented secret.
 */

import { makeServiceClient } from "../../lib/supabase.js";
import { resolveDeviceAccessToken } from "../../lib/device-token.js";
import type { Actor, Env } from "../../types.js";

export type ExtensionAuth =
  | {
      method: "device_token";
      actor: Actor;
      /** Hard org scope — the request may only touch packets in this org. */
      orgId: string;
      staffId: string;
    }
  | {
      method: "shared_token";
      actor: Actor;
      /** null = no org scope (legacy shared token may touch any packet). */
      orgId: null;
    };

export type ExtensionAuthError = "unconfigured" | "unauthorized";

// Legacy shared-token actor for audit attribution.
const SHARED_TOKEN_ACTOR: Actor = { kind: "extension", id: "civica-submitter-ext" };

/**
 * Resolve the Authorization header to an ExtensionAuth, or an error code.
 *
 * - Returns "unconfigured" only when NEITHER auth method is available
 *   (no shared token configured AND the bearer isn't a valid device token).
 *   Practically: if a device token validates, we never report unconfigured.
 * - Returns "unauthorized" when a bearer is present but matches neither method.
 */
export async function resolveExtensionAuth(
  env: Env,
  authorizationHeader: string | undefined,
): Promise<ExtensionAuth | ExtensionAuthError> {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    // No credential at all. If the shared token isn't configured either, the
    // feature is dark (503); otherwise it's a plain 401.
    return env.EXTENSION_BEARER_TOKEN ? "unauthorized" : "unconfigured";
  }

  const presented = authorizationHeader.slice("Bearer ".length);

  // 1. Per-CBO device token (preferred). Validates hash + expiry + revocation.
  const serviceDb = makeServiceClient(env);
  const scope = await resolveDeviceAccessToken(serviceDb, presented);
  if (scope) {
    return {
      method: "device_token",
      actor: { kind: "cbo_assister", id: scope.staff_id, orgId: scope.org_id },
      orgId: scope.org_id,
      staffId: scope.staff_id,
    };
  }

  // 2. Legacy shared token (deprecated). Exact match against the env secret.
  if (env.EXTENSION_BEARER_TOKEN && presented === env.EXTENSION_BEARER_TOKEN) {
    return { method: "shared_token", actor: SHARED_TOKEN_ACTOR, orgId: null };
  }

  // A bearer was presented but matched nothing. If no shared token is even
  // configured the surface is dark; surface 503 so the operator knows.
  return env.EXTENSION_BEARER_TOKEN ? "unauthorized" : "unconfigured";
}
