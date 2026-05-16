import { Hono } from "hono";
import { optionalAuth } from "../../middleware/auth.js";

export const openstatesRouter = new Hono();

openstatesRouter.get("/api/v1/openstates/people.geo", optionalAuth, async (c) => {
  const lat = parseFloat(c.req.query("lat") ?? "");
  const lng = parseFloat(c.req.query("lng") ?? "");

  if (!isFinite(lat) || !isFinite(lng)) {
    return c.json({ status: "error", error_code: "invalid_coordinates", message: "lat and lng must be finite numbers.", results: [] }, 400);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return c.json({ status: "error", error_code: "invalid_coordinates", message: "Coordinates out of range.", results: [] }, 400);
  }

  const apiKey = (process.env["OPENSTATES_API_KEY"] ?? "").trim();
  if (!apiKey || apiKey === "YOUR_OPENSTATES_API_KEY") {
    return c.json({ status: "error", error_code: "openstates_not_configured", message: "OpenStates API key is not configured.", results: [] });
  }

  const params = new URLSearchParams({ lat: lat.toFixed(6), lng: lng.toFixed(6), include: "links" });
  try {
    const res = await fetch(`https://v3.openstates.org/people.geo?${params}`, {
      headers: { Accept: "application/json", "X-API-KEY": apiKey },
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await res.json() as Record<string, unknown>;
    const results = Array.isArray(payload["results"]) ? payload["results"] : [];
    return c.json({ status: "ok", error_code: null, message: null, results });
  } catch (err) {
    console.error("OpenStates lookup failed", err);
    return c.json({ status: "error", error_code: "openstates_upstream_failure", message: "OpenStates request failed.", results: [] });
  }
});
