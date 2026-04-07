# Civic Premade Scripts Ops (No App Update)

## What changed
- Premade script cards are now read from Supabase table `public.civic_example_templates`.
- Backend endpoint `GET /api/v1/civic/examples` prefers active DB rows first.
- Code-based baseline variants are used only when DB has no active rows and fallback is enabled.

## Publish / Unpublish workflow
1. Open Supabase Dashboard -> Table Editor -> `civic_example_templates`.
2. Add or edit a row.
3. To publish now:
   - `is_active = true`
   - `starts_at = null` (or a past timestamp)
   - `ends_at = null` (or a future timestamp)
4. To take down:
   - Set `is_active = false`
   - or set `ends_at` to a past timestamp

## Key columns
- `issue_id`: stable unique id (required)
- `slug`: optional display slug (defaults to `issue_id` in API output)
- `title`, `summary`, `live_script`, `voicemail_script`: required display/script content
- `target_chambers`: JSON array, e.g. `["house","senate"]` or `["senate"]`
- `primary_ask`: one of `support|oppose|cosponsor|vote_yes|vote_no|seek_oversight|ask_public_statement|ask_amendment`
- `template_asks`, `related_bills`, `placeholders`, `tags`: JSON arrays
- `display_order`: lower shows first

## Fallback behavior
- Env var: `VOTENOW_ENABLE_BASELINE_EXAMPLE_FALLBACK`
  - `true` (default): if DB has no active rows, use hardcoded baseline variants.
  - `false`: if DB has no active rows, return no premade cards.

Set to `false` if you never want retired hardcoded scripts to reappear.
