import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import type { Env, Actor } from "../types.js";

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
    const metaRole = (user.app_metadata as Record<string, unknown> | null)?.role as string | undefined;
    if (metaRole === "buddy") {
      c.set("actor", { kind: "buddy", id: user.id });
    } else if (metaRole === "operator") {
      c.set("actor", { kind: "operator", id: user.id });
    } else {
      c.set("actor", { kind: "applicant", id: user.id });
    }
  }

  c.set("jwt", jwt);
  await next();
}
