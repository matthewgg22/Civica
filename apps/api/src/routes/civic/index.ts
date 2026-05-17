// Stubs for Flask → Hono port. Each returns 501 until ported.
// Track port status in migration/flask-inventory.md.
import { Hono } from "hono";
import { requireAuth, optionalAuth } from "../../middleware/auth.js";

const NOT_PORTED = (name: string) => ({
  code: "not_implemented",
  message: `${name} not yet ported from Flask. Use the Render endpoint during transition.`,
});

export const civicRouter = new Hono();

// ── Examples ──────────────────────────────────────────────────────────────────
civicRouter.get("/api/v1/civic/examples", optionalAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/examples"), 501),
);

// ── Assistant ─────────────────────────────────────────────────────────────────
civicRouter.post("/api/v1/civic/assistant/resolve", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/assistant/resolve"), 501),
);

// ── Issue classify / brief ────────────────────────────────────────────────────
civicRouter.post("/api/issue-classify", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/issue-classify"), 501),
);
civicRouter.post("/api/issue-brief", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/issue-brief"), 501),
);

// ── Script package ────────────────────────────────────────────────────────────
civicRouter.post("/api/v1/civic/script-package", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/script-package"), 501),
);
civicRouter.post("/api/v1/civic/script-feedback", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/script-feedback"), 501),
);
civicRouter.post("/api/v1/civic/script-chat-turn", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/script-chat-turn"), 501),
);

// ── MAPC v2 ───────────────────────────────────────────────────────────────────
civicRouter.post("/api/v2/civic/mapc/interpret", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/interpret"), 501),
);
civicRouter.post("/api/v2/civic/mapc/ask-options", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/ask-options"), 501),
);
civicRouter.post("/api/v2/civic/mapc/background", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/background"), 501),
);
civicRouter.post("/api/v2/civic/mapc/script", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/script"), 501),
);
civicRouter.post("/api/v2/civic/mapc/revise", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/revise"), 501),
);
civicRouter.post("/api/v2/civic/mapc/pending", optionalAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v2/civic/mapc/pending"), 501),
);
civicRouter.get("/api/v2/civic/mapc/health", optionalAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v2/civic/mapc/health"), 501),
);

// ── Calls ─────────────────────────────────────────────────────────────────────
civicRouter.post("/api/v1/civic/calls/log", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/calls/log"), 501),
);
civicRouter.post("/api/v1/civic/calls/launch", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/calls/launch"), 501),
);
civicRouter.post("/api/v1/civic/calls/confirm", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/calls/confirm"), 501),
);
civicRouter.get("/api/v1/civic/history", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/history"), 501),
);

// ── Call score ────────────────────────────────────────────────────────────────
civicRouter.get("/api/v1/civic/call-score/summary", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/call-score/summary"), 501),
);
civicRouter.get("/api/v1/civic/call-score/breakdown", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/call-score/breakdown"), 501),
);
civicRouter.get("/api/v1/civic/call-score/history", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/call-score/history"), 501),
);
civicRouter.post("/api/v1/civic/call-score/recompute", requireAuth, (c) =>
  c.json(NOT_PORTED("POST /api/v1/civic/call-score/recompute"), 501),
);

// ── Leaderboard ───────────────────────────────────────────────────────────────
civicRouter.get("/api/v1/civic/leaderboard", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/leaderboard"), 501),
);
civicRouter.get("/api/v1/civic/leaderboard/me", requireAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/civic/leaderboard/me"), 501),
);

// ── OpenStates ────────────────────────────────────────────────────────────────
civicRouter.get("/api/v1/openstates/people.geo", optionalAuth, (c) =>
  c.json(NOT_PORTED("GET /api/v1/openstates/people.geo"), 501),
);
