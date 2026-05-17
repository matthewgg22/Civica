import { createMiddleware } from "hono/factory";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

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
