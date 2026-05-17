/**
 * Creates isolated test applicant + staff users for each E2E run.
 *
 * All created resources are tagged with runId so cleanup is precise.
 * Requires: E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

export interface TestApplicant {
  authUserId: string;
  applicantId: string | null; // populated after first me/packets call triggers getOrCreateApplicant
  jwt: string;
  email: string;
}

export interface TestStaff {
  authUserId: string;
  staffId: string;
  orgId: string;
  roleId: string;
  jwt: string;
  email: string;
}

export interface TestContext {
  runId: string;
  applicant: TestApplicant;
  staff: TestStaff;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function makeAdminClient() {
  return createClient(
    requireEnv("E2E_SUPABASE_URL"),
    requireEnv("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function makeAnonClient() {
  return createClient(
    requireEnv("E2E_SUPABASE_URL"),
    requireEnv("E2E_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function signInForJwt(email: string, password: string): Promise<string> {
  const supabaseUrl = requireEnv("E2E_SUPABASE_URL");
  const anonKey = requireEnv("E2E_SUPABASE_ANON_KEY");

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase sign-in failed for ${email}: ${res.status} ${body}`);
  }
  const session = await res.json() as { access_token: string };
  return session.access_token;
}

export async function createTestContext(runId: string): Promise<TestContext> {
  const admin = makeAdminClient();
  const se = () => admin.schema("snap_enrollment");

  const password = `E2eTest!${runId}`;

  // ── Applicant auth user ─────────────────────────────────────────────────────

  const applicantEmail = `e2e_test_${runId}_applicant@civica-e2e.invalid`;
  const { data: applicantUser, error: aErr } = await admin.auth.admin.createUser({
    email: applicantEmail,
    password,
    email_confirm: true,
  });
  if (aErr || !applicantUser.user) {
    throw new Error(`Failed to create applicant auth user: ${aErr?.message}`);
  }

  // ── Staff org + role + user ─────────────────────────────────────────────────

  const staffEmail = `e2e_test_${runId}_staff@civica-e2e.invalid`;
  const { data: staffUser, error: sErr } = await admin.auth.admin.createUser({
    email: staffEmail,
    password,
    email_confirm: true,
    // apps/api's requireStaffJwt checks app_metadata.role; enrollment-api
    // uses the staff_users row instead. Both are satisfied by setting the
    // metadata here.
    app_metadata: { role: "navigator" },
  });
  if (sErr || !staffUser.user) {
    throw new Error(`Failed to create staff auth user: ${sErr?.message}`);
  }

  const { data: org, error: orgErr } = await se()
    .from("staff_orgs")
    .insert({
      name: `e2e_test_${runId}_org`,
      state_code: "CA",
    })
    .select("org_id")
    .single();
  if (orgErr || !org) throw new Error(`Failed to create test org: ${orgErr?.message}`);

  const { data: role, error: roleErr } = await se()
    .from("staff_roles")
    .insert({
      org_id: org.org_id,
      role_kind: "navigator",
      label: `e2e_test_${runId}_navigator`,
      can_export: true,
    })
    .select("role_id")
    .single();
  if (roleErr || !role) throw new Error(`Failed to create test role: ${roleErr?.message}`);

  const { data: staffRow, error: staffRowErr } = await se()
    .from("staff_users")
    .insert({
      auth_uid: staffUser.user.id,
      org_id: org.org_id,
      role_id: role.role_id,
      display_name: `e2e_test_${runId}_nav`,
      email: staffEmail,
    })
    .select("staff_id")
    .single();
  if (staffRowErr || !staffRow) {
    throw new Error(`Failed to create test staff_user: ${staffRowErr?.message}`);
  }

  // ── Sign in both users to get JWTs ──────────────────────────────────────────

  const [applicantJwt, staffJwt] = await Promise.all([
    signInForJwt(applicantEmail, password),
    signInForJwt(staffEmail, password),
  ]);

  return {
    runId,
    applicant: {
      authUserId: applicantUser.user.id,
      applicantId: null, // filled in by the spec after first API call
      jwt: applicantJwt,
      email: applicantEmail,
    },
    staff: {
      authUserId: staffUser.user.id,
      staffId: staffRow.staff_id,
      orgId: org.org_id,
      roleId: role.role_id,
      jwt: staffJwt,
      email: staffEmail,
    },
  };
}
