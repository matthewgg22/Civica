/**
 * Civica Submitter browser extension routes.
 *
 * Two endpoints expose the prepared packet payload + a confirmation
 * write-back path to the extension running in a partner CBO assister's
 * browser. Auth: a single shared bearer token (EXTENSION_BEARER_TOKEN).
 *
 * Mounted under /v1/enrollment/extension/* in apps/enrollment-api/src/index.ts.
 *
 * Scope (MVP, "sideload-only, one assister, no Web Store"):
 *   - Single shared secret auth (per-CBO tokens come later).
 *   - Returns the same Phase-1 payload shape as POST /benefitscal/prepare-export
 *     (PII columns stay ciphertext). The extension content script today is
 *     gated on TODO-14 (selectors unverified) AND PII decryption (also TODO);
 *     both unblock together when CBO Manager access lands.
 *   - Confirm endpoint updates the latest benefitscal_submissions row by
 *     packet_id, status='succeeded', captures the confirmation number.
 */

import { Hono } from "hono";
import payloadRouter from "./payload.js";
import confirmRouter from "./confirm.js";
import type { Env } from "../../types.js";

const extension = new Hono<{ Bindings: Env }>();

extension.route("/", payloadRouter);
extension.route("/", confirmRouter);

export default extension;
