import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HTTPException) {
    return c.json({ code: "http_error", message: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ code: "validation_error", message: "Invalid request", details: err.issues }, 422);
  }
  console.error(err);
  return c.json({ code: "internal_error", message: "Internal server error" }, 500);
}
