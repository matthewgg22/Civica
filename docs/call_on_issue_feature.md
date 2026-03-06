# Call on an Issue (My Reps)

## Overview
This feature adds a mobile-first, neutral civic contact flow in **My Reps**.
Users explicitly choose an ask, generate concise call scripts per federal representative, place calls, and log outcomes.

## Product safeguards
- No user ideology inference from profile, district, address, or behavior.
- Location context is used only to map the correct federal representatives.
- Ask selection is explicit and required.
- Generated scripts are factual, concise, editable, and non-manipulative.

## iOS implementation
- CTA in My Reps: `Call on an issue`
- New screen: `IssueCallCenterView`
- Tabs: Assistant, Examples, History
- Rep chips: House, Senator 1, Senator 2, All
- Rep card includes:
  - rep name
  - office type
  - primary phone
  - optional local office phone
  - relevance badges
  - related bill/committee chips
  - live-call script
  - voicemail script
  - 3 talking points
  - outcome buttons
- After call log, view model advances to the next rep card.
- Latest briefs/history cached locally for offline view (`CivicCallBriefCacheStore`).

## Backend implementation (Python)
Package: `backend/civic_api`

### Endpoints
Defined in `backend/civic_api/api.py`:
- `GET /api/v1/civic/examples`
- `POST /api/v1/civic/assistant/resolve`
- `POST /api/v1/civic/calls/log`
- `POST /api/v1/civic/calls/launch`
- `POST /api/v1/civic/calls/confirm`
- `GET /api/v1/civic/history`
- `GET /api/v1/civic/call-score/summary`
- `GET /api/v1/civic/call-score/breakdown`
- `GET /api/v1/civic/call-score/history`
- `POST /api/v1/civic/call-score/recompute`
- `GET /api/v1/civic/leaderboard`
- `GET /api/v1/civic/leaderboard/me`

### Core modules
- `service.py`: orchestration for examples, assistant resolve, call logging, history
- `issue_catalog.py`: baseline issue-response content library with chamber targeting, script variants, placeholders, and tags
- `congress_client.py`: Congress.gov integration client with retry + timeout + normalization
- `relevance.py`: scoring engine and reason-badge mapping
- `script_composer.py`: script generation with word limits and explicit ask control
- `repository.py`: in-memory repo and Supabase PostgREST repo adapter
- `jobs/sync_congress_data.py`: scheduled sync job scaffold
- `jobs/member_statement_ingest_stub.py`: phase-2 source ingest placeholder

## Database migration
Migration file:
- `supabase/migrations/20260301_add_civic_call_on_issue.sql`

Adds tables:
- `issue_catalog`
- `issue_legislation_links`
- `rep_issue_signals`
- `call_briefs`
- `call_logs`
- `member_statement_sources` (phase-2 placeholder)
- `call_launch_events`
- `call_events`
- `call_score_snapshots`
- `leaderboard_call_rollups`

## Testing
Python tests:
- `tests/test_civic_call_service.py`
- `tests/test_civic_api_contract.py`
- `tests/test_civic_script_rules.py`

Coverage includes:
- resolver/response schema
- scoring and no-signal path
- house-only vote enrichment
- script constraints (word limits + position fallback line)
- endpoint contract flow

Swift tests:
- `WeVote Information PageTests/IssueCallCenterViewModelTests.swift`
- `WeVote Information PageTests/IssueCallCenterViewSnapshotTests.swift`
- `WeVote Information PageUITests/IssueCallCenterFlowUITests.swift`

## Deployment notes
- Set `CIVIC_API_BASE_URL` in app Info.plist to target backend.
- Set backend env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CONGRESS_GOV_API_KEY`
  - `VOTENOW_ENABLE_CALL_SCORE_V1` (`true`/`false`, defaults to `true`)
- Run scheduled sync job to pre-cache member/bill metadata and reduce runtime fanout.

## Rollout plan (safe)
1. Deploy migration + backend endpoints with `VOTENOW_ENABLE_CALL_SCORE_V1=false`.
2. Enable internal QA users first via app-side toggle (`feature.call_score_v1_enabled`) and backend flag.
3. Verify duplicate suppression + score stability + leaderboard period totals.
4. Enable for all users after monitoring call completion and scoring analytics events.
