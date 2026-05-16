import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "./supabase.js";
import type { Env } from "../types.js";

/**
 * Resolves the applicant record for the authenticated user.
 * Creates a new applicant row if none exists (first sign-in after auth).
 * Returns { applicant_id, state_code, preferred_language }.
 */
export async function getOrCreateApplicant(
  env: Env,
  jwt: string,
  authUid: string,
  defaultStateCode: "CA" | "MA" = "CA"
) {
  const db = makeAnonClient(env, jwt);

  const { data: existing, error: fetchErr } = await db
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id, state_code, preferred_language")
    .eq("auth_uid", authUid)
    .maybeSingle();

  if (fetchErr) throw new HTTPException(500, { message: fetchErr.message });
  if (existing) return existing;

  // First sign-in — create applicant record using service role to bypass RLS
  const serviceDb = makeServiceClient(env);
  const { data: created, error: createErr } = await serviceDb
    .schema("snap_enrollment")
    .from("applicants")
    .insert({ auth_uid: authUid, state_code: defaultStateCode, preferred_language: "en" })
    .select("applicant_id, state_code, preferred_language")
    .single();

  if (createErr) throw new HTTPException(500, { message: createErr.message });
  return created;
}
