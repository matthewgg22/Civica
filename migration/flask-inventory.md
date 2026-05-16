# Flask → Hono Migration Inventory

**Source:** `backend/civic_api/api.py` (FastAPI, ~69KB) + root `api.py` (~45KB, legacy)  
**Deployed:** `https://votenow-botr.onrender.com`  
**Target:** `apps/api` (Hono, Node.js)  
**Strategy:** Hard cutover (Plan B). Port routes iteratively; iOS flips `CIVIC_API_BASE_URL` once all Tier A routes pass contract tests.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented in Hono |
| 🔧 | Stub (501) — contract test written, not yet ported |
| ⬛ | Not started |
| ➕ | Net-new (no Flask equivalent) |

---

## Tier A — iOS-calling today (must port before cutover)

| Status | Method | Path | Auth | Flask handler | Notes |
|--------|--------|------|------|---------------|-------|
| ✅ | GET | `/` | none | `root_status` | Implemented |
| ✅ | GET | `/healthz` | none | `healthz` | Implemented |
| ✅ | GET | `/api/v1/civic/examples` | optional | `get_examples` | Queries civic_example_templates — ported |
| ✅ | POST | `/api/v1/civic/assistant/resolve` | required | `post_assistant_resolve` | OpenAI chat completions — ported |
| ✅ | POST | `/api/issue-classify` | required | `post_issue_classify` | Token-overlap classify on issue_core — ported |
| ✅ | POST | `/api/issue-brief` | required | `post_issue_brief` | Classify + OpenAI brief + Supabase write — ported |
| ✅ | POST | `/api/v1/civic/calls/log` | required | `post_calls_log` | Supabase write — ported |
| ✅ | POST | `/api/v1/civic/calls/launch` | required | `post_calls_launch` | Supabase write — ported |
| ✅ | POST | `/api/v1/civic/calls/confirm` | required | `post_calls_confirm` | Supabase write + eligibility — ported |
| ✅ | GET | `/api/v1/civic/history` | required | `get_history` | Supabase read — ported |
| ✅ | GET | `/api/v1/civic/call-score/summary` | required | `get_call_score_summary` | Supabase read — ported |
| ✅ | GET | `/api/v1/civic/call-score/breakdown` | required | `get_call_score_breakdown` | Supabase read — ported |
| ✅ | GET | `/api/v1/civic/call-score/history` | required | `get_call_score_history` | Supabase read — ported |
| ✅ | POST | `/api/v1/civic/call-score/recompute` | required | `post_call_score_recompute` | Algorithm ported from Python |
| ✅ | GET | `/api/v1/civic/leaderboard` | required | `get_leaderboard` | Supabase read — ported |
| ✅ | GET | `/api/v1/civic/leaderboard/me` | required | `get_leaderboard_me` | Supabase read — ported |
| ✅ | GET | `/api/v1/openstates/people.geo` | optional | `get_openstates_people_geo` | Fetch proxy — ported |

---

## Tier A — SNAP conversational pipeline (iOS SNAP tab)

| Status | Method | Path | Auth | Flask handler | Notes |
|--------|--------|------|------|---------------|-------|
| 🔧 | POST | `/snap/sessions` | ? | `build_snap_router` → session start | Creates in-memory session |
| 🔧 | POST | `/snap/sessions/:id/turns` | ? | turn handler | Core conversational pipeline |
| 🔧 | POST | `/snap/sessions/recover` | ? | recover handler | Recover dropped session |
| 🔧 | GET | `/snap/sessions/:id/transcript` | ? | transcript | Full session transcript |
| 🔧 | GET | `/snap/documents/:id` | ? | document status | Document processing status |
| 🔧 | POST | `/snap/sessions/:id/application/pdf` | ? | PDF generation | Generates pre-app PDF |
| ✅ | GET | `/snap/healthz` | none | healthz | Implemented |

**Note:** SNAP pipeline uses in-memory session cache. Port requires Redis or Supabase-backed session store — coordinate with Phase 4 (OCR worker).

---

## Tier B — VoteNow engagement (iOS VoteNow tab)

| Status | Method | Path | Auth | Flask handler | Notes |
|--------|--------|------|------|---------------|-------|
| 🔧 | POST | `/api/v1/civic/script-package` | optional | `post_script_package` | MAPC script generation |
| 🔧 | POST | `/api/v1/civic/script-feedback` | optional | `post_script_feedback` | Feedback on generated script |
| 🔧 | POST | `/api/v1/civic/script-chat-turn` | optional | `post_script_chat_turn` | Chat within script session |
| 🔧 | POST | `/api/v2/civic/mapc/interpret` | optional | `post_mapc_v3_interpret` | MAPC v2 pipeline |
| 🔧 | POST | `/api/v2/civic/mapc/ask-options` | optional | `post_mapc_v3_ask_options` | |
| 🔧 | POST | `/api/v2/civic/mapc/background` | optional | `post_mapc_v3_background` | Background research |
| 🔧 | POST | `/api/v2/civic/mapc/script` | optional | `post_mapc_v3_script` | |
| 🔧 | POST | `/api/v2/civic/mapc/revise` | optional | `post_mapc_v3_revise` | |
| 🔧 | POST | `/api/v2/civic/mapc/pending` | optional | `post_mapc_v3_pending` | |
| 🔧 | GET | `/api/v2/civic/mapc/health` | optional | `get_mapc_v3_health` | |

---

## Tier C — Share cards (VoteNow social sharing, no iOS app dependency)

| Status | Method | Path | Auth | Flask handler | Notes |
|--------|--------|------|------|---------------|-------|
| 🔧 | GET | `/share/preview/:cardType.svg` | none | `share_preview_svg` | SVG OG image |
| 🔧 | GET | `/share/:cardType` | none | `share_landing_page` | HTML landing page with deep link |

---

## Net-new routes (no Flask equivalent)

| Status | Method | Path | Auth | Notes |
|--------|--------|------|------|-------|
| ✅ | GET | `/api/v1/snap/packets` | required | List user's packets |
| ✅ | POST | `/api/v1/snap/packets` | required | Create packet |
| ✅ | GET | `/api/v1/snap/packets/:id` | required | Get packet + documents + extraction fields |
| ✅ | POST | `/api/v1/snap/packets/:id/documents/upload-url` | required | Get signed Supabase Storage URL |
| ➕ | POST | `/api/v1/snap/packets/:id/export` | required | Generate PDF + JSON export (Phase 5) |
| ✅ | POST | `/api/v1/webhooks/ocr` | HMAC sig | Receive OCR worker results |
| ➕ | GET | `/api/v1/snap/navigators/packets` | navigator | Navigator packet queue (Phase 3) |

---

## Cutover checklist

- [ ] All Tier A rows show ✅
- [ ] Contract tests pass against both Render (Flask) and Fly (Hono) with matching response shapes
- [ ] iOS build pointing at Fly host passes manual smoke test (upload → packet → OCR)
- [ ] Render service in "suspended" state (not deleted) for 2-week soak
- [ ] `CODEBASE_HEALTH.md` updated to reflect Flask → Hono cutover date

---

## Key dependencies in Flask source

| Dependency | Purpose | Hono equivalent |
|-----------|---------|----------------|
| OpenAI Assistants API | `assistant/resolve`, `issue-classify`, `issue-brief`, MAPC, script | `openai` npm SDK |
| Supabase (service role) | Auth cache, call log writes, history reads | `@supabase/supabase-js` + Prisma |
| OpenStates API | Geo lookup for reps | Proxy fetch (same API, no lib needed) |
| In-memory session cache | SNAP conversational sessions | Needs Supabase or Redis for stateless deploy |
| Twilio (inferred) | Call launch/confirm | `twilio` npm SDK |
