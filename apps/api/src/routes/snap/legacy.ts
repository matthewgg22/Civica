// Stubs for the Flask SNAP conversational pipeline (/snap/*).
// These wrap the on-device + session-based flow that already ships in iOS.
// Port priority: LOWER than the new readiness-packet routes below.
import { Hono } from "hono";

const NOT_PORTED = (name: string) => ({
  code: "not_implemented",
  message: `${name} not yet ported from Flask SNAP pipeline.`,
});

export const snapLegacyRouter = new Hono();

snapLegacyRouter.post("/snap/sessions", (c) =>
  c.json(NOT_PORTED("POST /snap/sessions"), 501),
);
snapLegacyRouter.post("/snap/sessions/:sessionId/turns", (c) =>
  c.json(NOT_PORTED("POST /snap/sessions/:id/turns"), 501),
);
snapLegacyRouter.post("/snap/sessions/recover", (c) =>
  c.json(NOT_PORTED("POST /snap/sessions/recover"), 501),
);
snapLegacyRouter.get("/snap/sessions/:sessionId/transcript", (c) =>
  c.json(NOT_PORTED("GET /snap/sessions/:id/transcript"), 501),
);
snapLegacyRouter.get("/snap/documents/:documentId", (c) =>
  c.json(NOT_PORTED("GET /snap/documents/:id"), 501),
);
snapLegacyRouter.post("/snap/sessions/:sessionId/application/pdf", (c) =>
  c.json(NOT_PORTED("POST /snap/sessions/:id/application/pdf"), 501),
);
snapLegacyRouter.get("/snap/healthz", (c) => c.json({ ok: true }));
