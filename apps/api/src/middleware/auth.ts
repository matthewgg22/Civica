import { createMiddleware } from "hono/factory";
import { createClient } from "@supabase/supabase-js";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { User } from "@supabase/supabase-js";
import { makeAnonClient } from "../lib/supabase.js";
import type { Env, Actor } from "../types.js";

// ── Civic routes auth ──────────────────────────────────────────────────────
// Uses process.env and sets userId/user into Hono Variables.

type AuthEnv = { Variables: { user: User; userId: string } };

const supabaseAnon = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_ANON_KEY"] ?? "",
);

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/, "");
  if (!token) return c.json({ code: "unauthorized", message: "Missing Authorization header" }, 401);

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return c.json({ code: "unauthorized", message: "Invalid or expired token" }, 401);
  }

  c.set("user", data.user);
  c.set("userId", data.user.id);
  await next();
});

export const optionalAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/, "");
  if (token) {
    const { data } = await supabaseAnon.auth.getUser(token);
    if (data.user) {
      c.set("user", data.user);
      c.set("userId", data.user.id);
    }
  }
  await next();
});

// ── Enrollment routes auth ─────────────────────────────────────────────────
// Validates JWT, resolves actor kind (applicant vs staff), sets actor + jwt
// into Hono context. Works with CF Workers Bindings and Node.js process.env.

declare module "hono" {
  interface ContextVariableMap {
    actor: Actor;
    jwt: string;
  }
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing Bearer token" });
  }
  const jwt = authHeader.slice(7);

  // c.env may be empty in Node.js — makeAnonClient falls back to process.env
  const supabase = makeAnonClient(c.env, jwt);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  const { data: staff } = await supabase
    .schema("snap_enrollment")
    .from("staff_users")
    .select("staff_id, org_id, role_id, staff_roles(role_kind)")
    .eq("auth_uid", user.id)
    .is("deleted_at", null)
    .single();

  if (staff) {
    const roleKind = (staff.staff_roles as { role_kind: string } | null)?.role_kind ?? "navigator";
    c.set("actor", {
      kind: roleKind as Actor["kind"],
      id: staff.staff_id,
      orgId: staff.org_id,
    });
  } else {
    c.set("actor", { kind: "applicant", id: user.id });
  }

  c.set("jwt", jwt);
  await next();
}
